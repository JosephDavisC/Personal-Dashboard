import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TENNIS_STAGES, STROKES } from "@/lib/tennis/constants";
import { canAdvanceStage, generateNewStageRatings } from "@/lib/tennis/ratings";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const activeStage = await prisma.tennisStage.findFirst({
      where: { isActive: true },
      include: { ratings: true },
    });

    if (!activeStage) {
      return NextResponse.json({ error: "No active stage found" }, { status: 400 });
    }

    if (activeStage.stageNumber >= TENNIS_STAGES.length) {
      return NextResponse.json(
        { error: "You've reached the highest stage!" },
        { status: 400 }
      );
    }

    if (!canAdvanceStage(activeStage.ratings)) {
      return NextResponse.json(
        { error: "Not all self-rated strokes are at 9.0+ yet" },
        { status: 400 }
      );
    }

    const nextStageNumber = activeStage.stageNumber + 1;
    const nextConfig = TENNIS_STAGES[nextStageNumber - 1];
    if (!nextConfig) {
      return NextResponse.json({ error: "No next stage configured" }, { status: 400 });
    }

    const baseRatings = generateNewStageRatings(nextStageNumber);

    // Archive current stage and create new one in a transaction
    const [, newStage] = await prisma.$transaction([
      prisma.tennisStage.update({
        where: { id: activeStage.id },
        data: { isActive: false, completedAt: new Date() },
      }),
      prisma.tennisStage.create({
        data: {
          stageNumber: nextStageNumber,
          stageLabel: nextConfig.label,
          utrRange: nextConfig.utrRange,
          isActive: true,
        },
      }),
    ]);

    // Create initial self rating for new stage
    const ratingData: Record<string, unknown> = {
      stageId: newStage.id,
      ratedBy: "self",
      notes: `Initial ratings for Stage ${nextStageNumber}: ${nextConfig.label}`,
    };
    for (const s of STROKES) {
      ratingData[s.key] = baseRatings[s.key];
    }

    await prisma.tennisRating.create({ data: ratingData as Parameters<typeof prisma.tennisRating.create>[0]["data"] });

    return NextResponse.json({
      success: true,
      previousStage: {
        stageNumber: activeStage.stageNumber,
        stageLabel: activeStage.stageLabel,
      },
      newStage: {
        id: newStage.id,
        stageNumber: newStage.stageNumber,
        stageLabel: newStage.stageLabel,
        utrRange: newStage.utrRange,
      },
    });
  } catch (error) {
    console.error("POST /api/tennis/ratings/stage/advance error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
