import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const ratedBy = searchParams.get("ratedBy");
    const stageId = searchParams.get("stageId");
    const currentOnly = searchParams.get("currentOnly") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (ratedBy && ratedBy !== "all") where.ratedBy = ratedBy;
    if (stageId) where.stageId = stageId;

    if (currentOnly) {
      const activeStage = await prisma.tennisStage.findFirst({
        where: { isActive: true },
      });
      if (activeStage) where.stageId = activeStage.id;
    }

    const ratings = await prisma.tennisRating.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        stage: { select: { stageNumber: true, stageLabel: true } },
        session: { select: { id: true, type: true, date: true } },
      },
    });

    // Get stage breaks
    const stages = await prisma.tennisStage.findMany({
      where: { completedAt: { not: null } },
      orderBy: { stageNumber: "asc" },
      select: { stageNumber: true, stageLabel: true, completedAt: true },
    });

    const nextLabels: Record<number, string> = {
      1: "Intermediate", 2: "High Intermediate", 3: "Advanced",
      4: "Elite", 5: "Competitive",
    };

    const stageBreaks = stages.map((s) => ({
      stageNumber: s.stageNumber,
      completedAt: s.completedAt!.toISOString().split("T")[0],
      label: `${s.stageLabel} → ${nextLabels[s.stageNumber] || "Next"}`,
    }));

    return NextResponse.json({
      history: ratings.map((r) => ({
        id: r.id,
        date: r.date.toISOString().split("T")[0],
        stageNumber: r.stage.stageNumber,
        ratedBy: r.ratedBy,
        forehand: r.forehand,
        bhTopspin: r.bhTopspin,
        bhSlice: r.bhSlice,
        serve: r.serve,
        volley: r.volley,
        overhead: r.overhead,
        returnOf: r.returnOf,
        notes: r.notes,
        session: r.session,
      })),
      stageBreaks,
    });
  } catch (error) {
    console.error("GET /api/tennis/ratings/history error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
