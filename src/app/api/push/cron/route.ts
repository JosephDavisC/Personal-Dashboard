import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification, isPushConfigured, getPreferences } from "@/lib/push";
import { formatInTimeZone } from "date-fns-tz";
import { shiftLocationLabel } from "@/config/shifts";
import { TIMEZONE } from "@/lib/constants";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!process.env.PUSH_CRON_SECRET || token !== process.env.PUSH_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ data: { skipped: true, reason: "VAPID not configured" } });
  }

  const subCount = await prisma.pushSubscription.count();
  if (subCount === 0) {
    return NextResponse.json({ data: { skipped: true, reason: "No subscriptions" } });
  }

  const prefs = await getPreferences();
  const now = new Date();
  const results: string[] = [];

  // 1. Shift reminders (30 min before)
  if (prefs.shiftReminders) {
    const sent = await checkShiftReminders(now);
    if (sent) results.push(sent);
  }

  // 2. Task due reminders (9 AM check)
  if (prefs.taskDue) {
    const sent = await checkTaskDueReminders(now);
    if (sent) results.push(sent);
  }

  // 3. Diary reminder (9 AM check, if no entry in 2+ days)
  if (prefs.diaryReminder) {
    const sent = await checkDiaryReminder(now);
    if (sent) results.push(sent);
  }

  // 4. String age alerts (9 AM check, 60-day warning + 90-day overdue)
  if (prefs.stringAge) {
    const sent = await checkStringAgeAlerts(now);
    results.push(...sent);
  }

  return NextResponse.json({ data: { checked: true, notifications: results } });
}

async function checkShiftReminders(now: Date): Promise<string | null> {
  const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Find shifts starting within the next 30 minutes
  const upcomingShifts = await prisma.shift.findMany({
    where: {
      startTime: { gte: fiveMinAgo, lte: thirtyMinLater },
    },
  });

  for (const shift of upcomingShifts) {
    const logKey = `shift-${shift.id}`;
    const existing = await prisma.notificationLog.findUnique({
      where: { type_refId: { type: "shift_reminder", refId: logKey } },
    });
    if (existing) continue;

    const time = formatInTimeZone(shift.startTime, TIMEZONE, "h:mm a");
    const location = shiftLocationLabel(shift.location);

    await sendPushNotification({
      title: "Shift Starting Soon",
      body: `${location} shift at ${time}`,
      url: "/dashboard/shifts",
      tag: `shift-${shift.id}`,
    }, { type: "shift_reminder", refId: logKey });

    return `shift_reminder: ${location} at ${time}`;
  }

  return null;
}

async function checkTaskDueReminders(now: Date): Promise<string | null> {
  // Only send task reminders around 9 AM local time
  const localHour = Number(formatInTimeZone(now, TIMEZONE, "H"));
  if (localHour !== 9) return null;
  const localMinute = Number(formatInTimeZone(now, TIMEZONE, "m"));
  if (localMinute >= 10) return null; // only in first 10 minutes of 9 AM

  const todayStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const dayStart = new Date(`${todayStr}T00:00:00`);
  const dayEnd = new Date(`${todayStr}T23:59:59`);

  const dueTasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: dayStart, lte: dayEnd },
      status: { not: "DONE" },
    },
  });

  if (dueTasks.length === 0) return null;

  const logKey = `tasks-due-${todayStr}`;
  const existing = await prisma.notificationLog.findUnique({
    where: { type_refId: { type: "task_due", refId: logKey } },
  });
  if (existing) return null;

  const body = dueTasks.length === 1
    ? `Due today: ${dueTasks[0]!.title}`
    : `${dueTasks.length} tasks due today`;

  await sendPushNotification({
    title: "Tasks Due Today",
    body,
    url: "/dashboard/tasks",
    tag: "task-due",
  }, { type: "task_due", refId: logKey });

  return `task_due: ${dueTasks.length} tasks`;
}

async function checkDiaryReminder(now: Date): Promise<string | null> {
  // Only send diary reminder around 9 AM local time (same window as task due)
  const localHour = Number(formatInTimeZone(now, TIMEZONE, "H"));
  if (localHour !== 9) return null;
  const localMinute = Number(formatInTimeZone(now, TIMEZONE, "m"));
  if (localMinute >= 10) return null;

  const todayStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const logKey = `diary-reminder-${todayStr}`;
  const existing = await prisma.notificationLog.findUnique({
    where: { type_refId: { type: "diary_reminder", refId: logKey } },
  });
  if (existing) return null;

  // Check last diary entry
  const lastEntry = await prisma.diaryEntry.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!lastEntry) return null; // no entries yet, don't nag

  const daysSince = Math.floor((now.getTime() - lastEntry.date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince < 2) return null;

  await sendPushNotification({
    title: "Diary Reminder",
    body: `You haven't written a diary entry in ${daysSince} days`,
    url: "/dashboard/diary",
    tag: "diary-reminder",
  }, { type: "diary_reminder", refId: logKey });

  return `diary_reminder: ${daysSince} days`;
}

async function checkStringAgeAlerts(now: Date): Promise<string[]> {
  // Only send at 9 AM local time
  const localHour = Number(formatInTimeZone(now, TIMEZONE, "H"));
  if (localHour !== 9) return [];
  const localMinute = Number(formatInTimeZone(now, TIMEZONE, "m"));
  if (localMinute >= 10) return [];

  const todayStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const results: string[] = [];

  // Find rackets with lastStrung date
  const rackets = await prisma.tennisRacket.findMany({
    where: { lastStrung: { not: null } },
    select: { id: true, name: true, lastStrung: true },
  });

  for (const racket of rackets) {
    if (!racket.lastStrung) continue;
    const daysSince = Math.floor((now.getTime() - racket.lastStrung.getTime()) / (1000 * 60 * 60 * 24));

    let alertType: string | null = null;
    let body: string | null = null;

    if (daysSince >= 90) {
      alertType = "string_overdue";
      body = `${racket.name} strings are ${daysSince} days old — overdue for restring`;
    } else if (daysSince >= 60) {
      alertType = "string_warning";
      body = `${racket.name} strings are ${daysSince} days old — consider restringing soon`;
    }

    if (!alertType || !body) continue;

    // Dedup: one alert per racket per day per type
    const logKey = `${racket.id}-${todayStr}`;
    const existing = await prisma.notificationLog.findUnique({
      where: { type_refId: { type: alertType, refId: logKey } },
    });
    if (existing) continue;

    await sendPushNotification({
      title: daysSince >= 90 ? "String Overdue" : "String Age Warning",
      body,
      url: "/dashboard/tennis?tab=equipment",
      tag: `string-${racket.id}`,
    }, { type: alertType, refId: logKey });

    results.push(`${alertType}: ${racket.name} (${daysSince}d)`);
  }

  return results;
}
