import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { STROKES } from "@/lib/tennis/constants";
import { getLatestRatings } from "@/lib/tennis/ratings";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const activeStage = await prisma.tennisStage.findFirst({
      where: { isActive: true },
      include: { ratings: { orderBy: { date: "desc" } } },
    });

    if (!activeStage) {
      return NextResponse.json({ raters: [], comparison: {}, lastRated: {} });
    }

    const latestMap = getLatestRatings(activeStage.ratings);
    const raters = Array.from(latestMap.keys());
    const lastRated: Record<string, string> = {};
    const comparison: Record<string, Record<string, number>> = {};

    for (const [rater, rating] of latestMap) {
      lastRated[rater] = new Date(rating.date).toISOString().split("T")[0]!;
    }

    for (const stroke of STROKES) {
      const entry: Record<string, number> = {};
      const values: number[] = [];

      for (const [rater, rating] of latestMap) {
        const val = rating[stroke.key] as number;
        entry[rater] = val;
        values.push(val);
      }

      entry.average = values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 2) / 2
        : 0;

      comparison[stroke.key] = entry;
    }

    return NextResponse.json({ raters, comparison, lastRated });
  } catch (error) {
    console.error("GET /api/tennis/ratings/compare error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
