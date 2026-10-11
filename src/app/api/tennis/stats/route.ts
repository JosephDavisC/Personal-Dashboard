import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const now = new Date();
    const currentMonth = formatInTimeZone(now, TIMEZONE, "yyyy-MM");
    const currentYear = formatInTimeZone(now, TIMEZONE, "yyyy");
    const monthStart = fromZonedTime(`${currentMonth}-01T00:00:00`, TIMEZONE);
    const yearStart = fromZonedTime(`${currentYear}-01-01T00:00:00`, TIMEZONE);

    const [allSessions, monthSessions, yearSessions] = await Promise.all([
      prisma.tennisSession.findMany({
        select: { type: true, duration: true, cost: true },
      }),
      prisma.tennisSession.findMany({
        where: { date: { gte: monthStart } },
        select: { type: true, duration: true, cost: true },
      }),
      prisma.tennisSession.findMany({
        where: { date: { gte: yearStart } },
        select: { type: true, duration: true, cost: true },
      }),
    ]);

    function summarize(sessions: typeof allSessions) {
      const total = sessions.length;
      const hours = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
      const lessonCost = sessions
        .filter((s) => s.type === "lesson")
        .reduce((sum, s) => sum + (s.cost ?? 0), 0);
      const byType = {
        practice: sessions.filter((s) => s.type === "practice").length,
        lesson: sessions.filter((s) => s.type === "lesson").length,
        match: sessions.filter((s) => s.type === "match").length,
      };
      return { total, hours, lessonCost, byType };
    }

    return NextResponse.json({
      data: {
        thisMonth: summarize(monthSessions),
        thisYear: summarize(yearSessions),
        allTime: summarize(allSessions),
      },
    });
  } catch (error) {
    console.error("GET /api/tennis/stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
