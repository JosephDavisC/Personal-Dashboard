import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TIMEZONE } from "@/lib/constants";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  const start = fromZonedTime(`${year}-${month.padStart(2, "0")}-01T00:00:00`, TIMEZONE);
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const end = fromZonedTime(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`, TIMEZONE);

  const entries = await prisma.diaryEntry.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, mood: true },
  });

  const dates = entries.map((e) => ({
    date: formatInTimeZone(e.date, TIMEZONE, "yyyy-MM-dd"),
    mood: e.mood,
  }));

  return NextResponse.json({ data: dates });
}
