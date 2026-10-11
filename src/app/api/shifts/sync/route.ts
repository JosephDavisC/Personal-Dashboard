import { NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { listEvents, listCalendars } from "@/lib/google-calendar";
import { TIMEZONE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";
import {
  isWorkShift,
  detectLocation,
  calculateHours,
  calculateGrossPay,
  calculateNetPay,
} from "@/lib/shift-utils";

export interface DetectedShift {
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  label: string;
  hours: number;
  grossPay: number;
  netPay: number;
  isDuplicate: boolean;
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = searchParams.get("from") ?? thirtyDaysAgo.toISOString();
  const to = searchParams.get("to") ?? now.toISOString();

  try {
    // Fetch events from ALL calendars to catch scheduling-app + personal calendars
    const calendars = await listCalendars();
    const allEvents = await Promise.all(
      calendars.map((cal) =>
        listEvents(from, to, cal.id).catch(() => [])
      )
    );
    const events = allEvents.flat();

    const shiftEvents = events.filter(
      (e) => e.summary && e.start.dateTime && e.end.dateTime && isWorkShift(e.summary)
    );

    // Deduplicate by start time — prefer shorter labels (scheduling-app labels like
    // "Cafe - Open" over verbose "Opening shift at the cafe")
    const shiftMap = new Map<string, (typeof shiftEvents)[number]>();
    for (const event of shiftEvents) {
      const key = event.start.dateTime!;
      const existing = shiftMap.get(key);
      if (!existing || event.summary.length < existing.summary.length) {
        shiftMap.set(key, event);
      }
    }
    const uniqueShifts = Array.from(shiftMap.values());

    // Fetch existing shifts in range for duplicate detection
    const existingShifts = await prisma.shift.findMany({
      where: {
        date: { gte: new Date(from), lte: new Date(to) },
      },
      select: { date: true, startTime: true },
    });

    const existingSet = new Set(
      existingShifts.map(
        (s) => `${formatInTimeZone(s.date, TIMEZONE, "yyyy-MM-dd")}_${s.startTime.toISOString()}`
      )
    );

    const detected: DetectedShift[] = uniqueShifts.map((event) => {
      const startUtc = new Date(event.start.dateTime!);
      const endUtc = new Date(event.end.dateTime!);
      const dateStr = formatInTimeZone(startUtc, TIMEZONE, "yyyy-MM-dd");
      const dateUtc = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
      const summary = event.summary;
      const location = detectLocation(summary);
      const hours = calculateHours(startUtc, endUtc);
      const grossPay = calculateGrossPay(hours);
      const netPay = calculateNetPay(grossPay);

      const dateKey = `${dateStr}_${startUtc.toISOString()}`;
      const isDuplicate = existingSet.has(dateKey);

      return {
        summary,
        date: dateUtc.toISOString(),
        startTime: startUtc.toISOString(),
        endTime: endUtc.toISOString(),
        location,
        label: summary,
        hours,
        grossPay,
        netPay,
        isDuplicate,
      };
    });

    return NextResponse.json({ data: { shifts: detected } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync";
    if (message.includes("re-login")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const importSchema = z.object({
  shifts: z.array(
    z.object({
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      location: z.string().min(1).max(50),
      label: z.string().optional().nullable(),
    })
  ),
});

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json();
  const parsed = importSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { shifts } = parsed.data;
  let imported = 0;
  let skipped = 0;

  for (const shift of shifts) {
    // Check for duplicate
    const existing = await prisma.shift.findFirst({
      where: {
        date: new Date(shift.date),
        startTime: new Date(shift.startTime),
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const hours = calculateHours(
      new Date(shift.startTime),
      new Date(shift.endTime)
    );
    const grossPay = calculateGrossPay(hours);
    const netPay = calculateNetPay(grossPay);

    await prisma.shift.create({
      data: {
        date: new Date(shift.date),
        startTime: new Date(shift.startTime),
        endTime: new Date(shift.endTime),
        location: shift.location,
        label: shift.label,
        hours,
        grossPay,
        netPay,
      },
    });

    imported++;
  }

  return NextResponse.json({ data: { imported, skipped } });
}
