import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createTennisRatingSchema } from "@/lib/validations/tennis";
import { TENNIS_STAGES, STROKES, STAGE_ADVANCE_THRESHOLD } from "@/lib/tennis/constants";
import { canAdvanceStage } from "@/lib/tennis/ratings";

// GET: legacy endpoint still works for backward compat (old StrokeRating data)
export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const allRatings = await prisma.strokeRating.findMany({
      orderBy: { date: "desc" },
    });

    const latestByStroke = new Map<string, { rating: number; date: Date }>();
    for (const r of allRatings) {
      if (!latestByStroke.has(r.stroke)) {
        latestByStroke.set(r.stroke, { rating: r.rating, date: r.date });
      }
    }

    const current = Object.fromEntries(
      Array.from(latestByStroke.entries()).map(([stroke, { rating }]) => [stroke, rating])
    );

    return NextResponse.json({ data: { current, history: allRatings } });
  } catch (error) {
    console.error("GET /api/tennis/ratings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: new staged rating system
export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const parsed = createTennisRatingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    // Find or create active stage
    let activeStage = await prisma.tennisStage.findFirst({
      where: { isActive: true },
    });

    if (!activeStage) {
      const stageConfig = TENNIS_STAGES[0]!;
      activeStage = await prisma.tennisStage.create({
        data: {
          stageNumber: 1,
          stageLabel: stageConfig.label,
          utrRange: stageConfig.utrRange,
          isActive: true,
        },
      });
    }

    const { notes, sessionId, ...strokeRatings } = parsed.data;

    const rating = await prisma.tennisRating.create({
      data: {
        stageId: activeStage.id,
        ratedBy: strokeRatings.ratedBy,
        forehand: strokeRatings.forehand,
        bhTopspin: strokeRatings.bhTopspin,
        bhSlice: strokeRatings.bhSlice,
        serve: strokeRatings.serve,
        volley: strokeRatings.volley,
        overhead: strokeRatings.overhead,
        returnOf: strokeRatings.returnOf,
        notes: notes ?? null,
        sessionId: sessionId ?? null,
      },
      include: { session: { select: { id: true, type: true, date: true } } },
    });

    // Check if advance is available after this rating
    const allStageRatings = await prisma.tennisRating.findMany({
      where: { stageId: activeStage.id },
    });
    const advanceAvailable = canAdvanceStage(allStageRatings);

    // Count strokes at threshold from self ratings
    let strokesAtThreshold = 0;
    if (strokeRatings.ratedBy === "self") {
      strokesAtThreshold = STROKES.filter(
        (s) => (strokeRatings[s.key] as number) >= STAGE_ADVANCE_THRESHOLD
      ).length;
    }

    return NextResponse.json(
      {
        data: rating,
        advanceAvailable,
        strokesAtThreshold,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/tennis/ratings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
