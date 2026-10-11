import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const stages = await prisma.tennisStage.findMany({
      orderBy: { stageNumber: "asc" },
      select: {
        id: true,
        stageNumber: true,
        stageLabel: true,
        utrRange: true,
        startedAt: true,
        completedAt: true,
        isActive: true,
        _count: { select: { ratings: true } },
      },
    });

    return NextResponse.json({
      data: stages.map((s) => ({
        ...s,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
        ratingsCount: s._count.ratings,
      })),
    });
  } catch (error) {
    console.error("GET /api/tennis/ratings/stages error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
