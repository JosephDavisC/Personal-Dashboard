import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TIMEZONE } from "@/lib/constants";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { listEvents, listCalendars } from "@/lib/google-calendar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { date } = await params;
  const dayStart = fromZonedTime(`${date}T00:00:00`, TIMEZONE);
  const dayEnd = fromZonedTime(`${date}T23:59:59`, TIMEZONE);

  // Fetch shifts, tasks, incidents, and manual task links in parallel
  const [shifts, tasksCompleted, tasksCreated, tasksMoved, incidents, calendarEvents, diaryEntry] = await Promise.all([
    prisma.shift.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: { startTime: "asc" },
    }),
    // Tasks completed this day
    prisma.task.findMany({
      where: { status: "DONE", completedAt: { gte: dayStart, lte: dayEnd } },
      select: { id: true, title: true },
    }),
    // Tasks created this day
    prisma.task.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      select: { id: true, title: true, status: true },
    }),
    // Tasks with status changes this day (not completed — those are above)
    prisma.task.findMany({
      where: {
        statusChangedAt: { gte: dayStart, lte: dayEnd },
        NOT: { status: "DONE", completedAt: { gte: dayStart, lte: dayEnd } },
      },
      select: { id: true, title: true, status: true },
    }),
    prisma.siteIncident.findMany({
      where: { startedAt: { gte: dayStart, lte: dayEnd } },
    }),
    fetchCalendarEvents(dayStart.toISOString(), dayEnd.toISOString()),
    prisma.diaryEntry.findUnique({
      where: { date: fromZonedTime(`${date}T00:00:00`, TIMEZONE) },
      select: { manualTaskIds: true },
    }),
  ]);

  // Fetch manually linked tasks (skip IDs that no longer exist)
  const manualTaskIds = diaryEntry?.manualTaskIds ?? [];
  const manualTasks = manualTaskIds.length > 0
    ? await prisma.task.findMany({
        where: { id: { in: manualTaskIds } },
        select: { id: true, title: true, status: true },
      })
    : [];

  const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const totalPay = shifts.reduce((sum, s) => sum + s.netPay, 0);

  return NextResponse.json({
    data: {
      shifts: shifts.map((s) => ({
        location: s.location,
        label: s.label,
        hours: s.hours,
        netPay: s.netPay,
        start: formatInTimeZone(s.startTime, TIMEZONE, "h:mm a"),
        end: formatInTimeZone(s.endTime, TIMEZONE, "h:mm a"),
      })),
      totalHours,
      totalPay,
      events: calendarEvents,
      eventsCount: calendarEvents.length,
      tasksCompleted: tasksCompleted.map((t) => ({ title: t.title })),
      tasksCreated: tasksCreated
        .filter((t) => !tasksCompleted.some((c) => c.id === t.id))
        .map((t) => ({ title: t.title, status: t.status })),
      tasksMoved: tasksMoved
        .filter((t) => !tasksCreated.some((c) => c.id === t.id))
        .map((t) => ({ title: t.title, status: t.status })),
      sitesDown: incidents.map((i) => ({ title: i.title })),
      manualTasks: manualTasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    },
  });
}

async function fetchCalendarEvents(start: string, end: string) {
  try {
    const calendars = await listCalendars();
    const visibleIds = calendars
      .filter((c) => c.selected)
      .map((c) => c.id);

    const allEvents = await Promise.all(
      visibleIds.map((calId) => listEvents(start, end, calId).catch(() => []))
    );

    const seen = new Set<string>();
    const events: { title: string; time: string; location?: string }[] = [];

    for (const batch of allEvents) {
      for (const e of batch) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);

        let time = "";
        if (e.start.dateTime) {
          time = formatInTimeZone(new Date(e.start.dateTime), TIMEZONE, "h:mm a");
          if (e.end.dateTime) {
            time += ` - ${formatInTimeZone(new Date(e.end.dateTime), TIMEZONE, "h:mm a")}`;
          }
        } else {
          time = "All day";
        }

        events.push({
          title: e.summary || "(No title)",
          time,
          ...(e.location ? { location: e.location } : {}),
        });
      }
    }

    return events;
  } catch {
    return [];
  }
}
