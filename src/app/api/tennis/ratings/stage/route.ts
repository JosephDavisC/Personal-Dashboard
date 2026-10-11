import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TENNIS_STAGES, STROKES, STAGE_ADVANCE_THRESHOLD } from "@/lib/tennis/constants";
import { getLatestRatings, getAverageRatings, canAdvanceStage } from "@/lib/tennis/ratings";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    // Find or create active stage
    let activeStage = await prisma.tennisStage.findFirst({
      where: { isActive: true },
      include: {
        ratings: {
          orderBy: { date: "desc" },
          include: { session: { select: { id: true, type: true, date: true } } },
        },
      },
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
        include: {
          ratings: {
            orderBy: { date: "desc" },
            include: { session: { select: { id: true, type: true, date: true } } },
          },
        },
      });
    }

    const latestByRater: Record<string, Record<string, number | string>> = {};
    const latestMap = getLatestRatings(activeStage.ratings);
    const lastRated: Record<string, string> = {};

    for (const [rater, rating] of latestMap) {
      const entry: Record<string, number | string> = {};
      for (const s of STROKES) {
        entry[s.key] = rating[s.key] as number;
      }
      latestByRater[rater] = entry;
      lastRated[rater] = new Date(rating.date).toISOString().split("T")[0]!;
    }

    const averageRatings = getAverageRatings(activeStage.ratings);
    const canAdvance = canAdvanceStage(activeStage.ratings);

    // Count strokes at threshold from self ratings
    const selfLatest = latestMap.get("self");
    let strokesAtThreshold = 0;
    if (selfLatest) {
      strokesAtThreshold = STROKES.filter(
        (s) => (selfLatest[s.key] as number) >= STAGE_ADVANCE_THRESHOLD
      ).length;
    }

    return NextResponse.json({
      stage: {
        id: activeStage.id,
        stageNumber: activeStage.stageNumber,
        stageLabel: activeStage.stageLabel,
        utrRange: activeStage.utrRange,
        startedAt: activeStage.startedAt.toISOString(),
      },
      latestByRater,
      lastRated,
      averageRatings,
      canAdvance,
      strokesAtThreshold,
      totalStrokes: STROKES.length,
    });
  } catch (error) {
    console.error("GET /api/tennis/ratings/stage error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
