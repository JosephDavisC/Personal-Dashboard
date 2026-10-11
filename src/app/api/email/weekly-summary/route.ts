import { NextResponse } from "next/server";
import {
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfDay,
  endOfDay,
  format,
  addDays,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { sendAndLogEmail, type EmailAttachment } from "@/lib/email";
import { buildWeeklySummaryEmail, type WeeklySummaryData } from "@/lib/email-templates";
import { TIMEZONE, MEDIA_UPLOAD_DIR } from "@/lib/constants";
import { sendPushNotification, getPreferences } from "@/lib/push";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { shiftLocationLabel } from "@/config/shifts";
import { APP_URL } from "@/lib/app-url";

interface ShiftsByLocation {
  location: string;
  count: number;
  hours: number;
  netPay: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CalEvent = { summary?: string; start?: any; end?: any };

async function getCalendarEvents(from: Date, to: Date): Promise<CalEvent[]> {
  try {
    const { listCalendars, listEvents } = await import("@/lib/google-calendar");
    const calendars = await listCalendars();
    const allEvents = await Promise.all(
      calendars.map((cal) =>
        listEvents(from.toISOString(), to.toISOString(), cal.id).catch(() => [])
      )
    );
    return allEvents.flat();
  } catch {
    return [];
  }
}

function getBusiestDay(events: CalEvent[], from: Date): { day: string; count: number } | null {
  const dayCounts: Record<string, number> = {};
  for (const ev of events) {
    const dt = ev.start?.dateTime || ev.start?.date;
    if (!dt) continue;
    const dayKey = formatInTimeZone(new Date(dt), TIMEZONE, "EEEE");
    dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
  }
  let bestDay = "";
  let bestCount = 0;
  for (const [day, count] of Object.entries(dayCounts)) {
    if (count > bestCount) {
      bestDay = day;
      bestCount = count;
    }
  }
  return bestCount > 0 ? { day: bestDay, count: bestCount } : null;
}

async function getUpcomingEvents(afterDate: Date, limit: number): Promise<{ summary: string; date: string }[]> {
  try {
    const { listCalendars, listEvents } = await import("@/lib/google-calendar");
    const calendars = await listCalendars();
    const futureEnd = addDays(afterDate, 7);
    const allEvents = await Promise.all(
      calendars.map((cal) =>
        listEvents(afterDate.toISOString(), futureEnd.toISOString(), cal.id).catch(() => [])
      )
    );
    const sorted = allEvents.flat()
      .filter((ev) => ev.summary)
      .sort((a, b) => {
        const aDate = new Date(a.start?.dateTime || a.start?.date || 0);
        const bDate = new Date(b.start?.dateTime || b.start?.date || 0);
        return aDate.getTime() - bDate.getTime();
      });
    return sorted.slice(0, limit).map((ev) => ({
      summary: ev.summary || "(No title)",
      date: formatInTimeZone(
        new Date(ev.start?.dateTime || ev.start?.date || new Date()),
        TIMEZONE,
        "EEE, MMM d 'at' h:mm a"
      ),
    }));
  } catch {
    return [];
  }
}

function computeMoodBreakdown(moods: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of moods) {
    counts[m] = (counts[m] || 0) + 1;
  }
  return counts;
}

function computeDiaryStreak(entriesThisWeek: Date[]): number {
  if (entriesThisWeek.length === 0) return 0;
  // Simple: count consecutive days from most recent backwards
  const sorted = entriesThisWeek
    .map((d) => formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd"))
    .sort()
    .reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}


async function gatherWeeklyData(weekStart: Date, weekEnd: Date): Promise<WeeklySummaryData & { _attachments?: EmailAttachment[] }> {
  const from = startOfDay(weekStart);
  const to = endOfDay(weekEnd);
  const prevFrom = startOfDay(subWeeks(weekStart, 1));
  const prevTo = endOfDay(subWeeks(weekEnd, 1));

  // ===== SHIFTS =====
  const shifts = await prisma.shift.findMany({ where: { date: { gte: from, lte: to } } });
  const prevShifts = await prisma.shift.findMany({ where: { date: { gte: prevFrom, lte: prevTo } } });

  const shiftHours = shifts.reduce((s, sh) => s + sh.hours, 0);
  const shiftNetPay = shifts.reduce((s, sh) => s + sh.netPay, 0);
  const prevHours = prevShifts.reduce((s, sh) => s + sh.hours, 0);
  const prevNetPay = prevShifts.reduce((s, sh) => s + sh.netPay, 0);

  const byLocation: ShiftsByLocation[] = [];
  const locMap = new Map<string, { count: number; hours: number; netPay: number }>();
  for (const sh of shifts) {
    const loc = sh.location;
    const cur = locMap.get(loc) || { count: 0, hours: 0, netPay: 0 };
    cur.count++;
    cur.hours += sh.hours;
    cur.netPay += sh.netPay;
    locMap.set(loc, cur);
  }
  for (const [loc, stats] of locMap) {
    byLocation.push({ location: shiftLocationLabel(loc), ...stats });
  }

  // ===== TASKS =====
  const completedTasks = await prisma.task.findMany({
    where: { status: "DONE", completedAt: { gte: from, lte: to } },
    select: { title: true },
  });
  const createdCount = await prisma.task.count({ where: { createdAt: { gte: from, lte: to } } });
  const inProgressCount = await prisma.task.count({ where: { status: "IN_PROGRESS" } });
  const overdueCount = await prisma.task.count({
    where: { dueDate: { lt: new Date() }, status: { not: "DONE" } },
  });
  const prevCompleted = await prisma.task.count({
    where: { status: "DONE", completedAt: { gte: prevFrom, lte: prevTo } },
  });

  // ===== APPLICATIONS =====
  const appliedCount = await prisma.jobApplication.count({
    where: { dateApplied: { gte: from, lte: to } },
  });
  const prevApplied = await prisma.jobApplication.count({
    where: { dateApplied: { gte: prevFrom, lte: prevTo } },
  });
  // Status changes this week
  const statusChanges = await prisma.jobApplication.findMany({
    where: { updatedAt: { gte: from, lte: to } },
    select: { company: true, title: true, status: true },
  });
  const interviewCount = statusChanges.filter((a) => a.status === "INTERVIEW").length;
  const offerCount = statusChanges.filter((a) => a.status === "OFFER").length;
  const rejectedCount = statusChanges.filter((a) => a.status === "REJECTED").length;
  const totalApps = await prisma.jobApplication.count();
  const totalResponsed = await prisma.jobApplication.count({
    where: { status: { notIn: ["APPLIED"] } },
  });

  // ===== CALENDAR =====
  const events = await getCalendarEvents(from, to);
  const busiestDay = getBusiestDay(events, from);
  const upcoming = await getUpcomingEvents(to, 5);

  // ===== DIARY =====
  const diaryEntries = await prisma.diaryEntry.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, mood: true },
  });
  const diaryPhotos = await prisma.diaryPhoto.count({
    where: { entry: { date: { gte: from, lte: to } } },
  });
  const moods = diaryEntries.map((e) => e.mood).filter((m): m is string => m !== null);
  const moodBreakdown = computeMoodBreakdown(moods);
  const streak = computeDiaryStreak(diaryEntries.map((e) => e.date));

  // ===== WEEKLY PHOTOS (diary + task) — embedded as CID attachments =====
  const weeklyPhotos: WeeklySummaryData["photos"] = [];
  const photoAttachments: EmailAttachment[] = [];
  try {
    // Diary photos this week
    const diaryPhotoRows = await prisma.diaryPhoto.findMany({
      where: { entry: { date: { gte: from, lte: to } }, mediaId: { not: null } },
      select: { mediaId: true, entry: { select: { date: true } } },
      orderBy: { createdAt: "desc" },
      take: 4,
    });
    // Task photos this week
    const taskPhotoRows = await prisma.taskPhoto.findMany({
      where: { createdAt: { gte: from, lte: to }, mediaId: { not: null } },
      select: { mediaId: true, taskId: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    // Merge, dedupe, take top 4
    const allPhotoItems: { mediaId: string; source: "diary" | "task"; linkDate?: string; taskId?: string }[] = [];
    for (const dp of diaryPhotoRows) {
      if (dp.mediaId) {
        const dateStr = formatInTimeZone(dp.entry.date, TIMEZONE, "yyyy-MM-dd");
        allPhotoItems.push({ mediaId: dp.mediaId, source: "diary", linkDate: dateStr });
      }
    }
    for (const tp of taskPhotoRows) {
      if (tp.mediaId && !allPhotoItems.some((p) => p.mediaId === tp.mediaId)) {
        allPhotoItems.push({ mediaId: tp.mediaId, source: "task", taskId: tp.taskId });
      }
    }
    const top4 = allPhotoItems.slice(0, 4);

    if (top4.length > 0) {
      const mediaIds = top4.map((p) => p.mediaId);
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, storedName: true, mimeType: true, filename: true },
      });
      const fileMap = new Map(mediaFiles.map((m) => [m.id, m]));

      for (let i = 0; i < top4.length; i++) {
        const item = top4[i]!;
        const media = fileMap.get(item.mediaId);
        if (!media) continue;

        const filePath = join(MEDIA_UPLOAD_DIR, media.storedName);
        if (!existsSync(filePath)) continue;

        const cid = `photo-${i}@dashboard.local`;
        const content = readFileSync(filePath);
        photoAttachments.push({
          filename: media.filename,
          content,
          cid,
          contentType: media.mimeType,
        });

        const link = item.source === "diary"
          ? `${APP_URL}/dashboard/diary?date=${item.linkDate}`
          : `${APP_URL}/dashboard/tasks`;
        weeklyPhotos.push({ url: `cid:${cid}`, link });
      }
    }
  } catch {
    // Photos are best-effort, don't fail the summary
  }

  // ===== INFRASTRUCTURE =====
  const sites = await prisma.monitoredSite.findMany({ select: { id: true, label: true } });
  // Calculate uptime from pings
  const totalPings = await prisma.sitePing.count({
    where: { checkedAt: { gte: from, lte: to } },
  });
  const upPings = await prisma.sitePing.count({
    where: { checkedAt: { gte: from, lte: to }, isUp: true },
  });
  const uptimePct = totalPings > 0 ? (upPings / totalPings) * 100 : 100;
  const incidents = await prisma.siteIncident.findMany({
    where: { startedAt: { gte: from, lte: to } },
    select: { title: true, duration: true },
  });

  // ===== MEDIA =====
  const mediaUploaded = await prisma.mediaFile.count({
    where: { createdAt: { gte: from, lte: to } },
  });
  const mediaStats = await prisma.mediaFile.aggregate({
    _sum: { size: true },
  });
  // Breakdown by type
  const imageCount = await prisma.mediaFile.count({
    where: { createdAt: { gte: from, lte: to }, mimeType: { startsWith: "image/" } },
  });
  const videoCount = await prisma.mediaFile.count({
    where: { createdAt: { gte: from, lte: to }, mimeType: { startsWith: "video/" } },
  });
  const docCount = await prisma.mediaFile.count({
    where: { createdAt: { gte: from, lte: to }, mimeType: { startsWith: "application/" } },
  });

  const weekLabel = `${formatInTimeZone(from, TIMEZONE, "MMM d")} – ${formatInTimeZone(to, TIMEZONE, "d, yyyy")}`;

  return {
    weekLabel,
    shifts: {
      count: shifts.length,
      hours: shiftHours,
      netPay: shiftNetPay,
      byLocation,
      prevHours,
      prevNetPay,
    },
    tasks: {
      completed: completedTasks.length,
      completedTitles: completedTasks.map((t) => t.title),
      created: createdCount,
      inProgress: inProgressCount,
      overdue: overdueCount,
      prevCompleted,
    },
    applications: {
      applied: appliedCount,
      prevApplied,
      interviews: interviewCount,
      offers: offerCount,
      rejected: rejectedCount,
      total: totalApps,
      responseRate: totalApps > 0 ? Math.round((totalResponsed / totalApps) * 100) : 0,
    },
    calendar: {
      eventCount: events.length,
      busiestDay,
      upcoming,
    },
    diary: {
      entries: diaryEntries.length,
      moodBreakdown,
      streak,
      photos: diaryPhotos,
    },
    infrastructure: {
      siteCount: sites.length,
      uptimePct,
      incidents: incidents.length,
    },
    photos: weeklyPhotos,
    media: {
      uploaded: mediaUploaded,
      totalStorageBytes: mediaStats._sum.size || 0,
      byType: { images: imageCount, videos: videoCount, documents: docCount },
    },
    _attachments: photoAttachments.length > 0 ? photoAttachments : undefined,
  };
}

const RECIPIENT = process.env.SUMMARY_EMAIL_TO;

// Cron endpoint: GET /api/email/weekly-summary?token=SECRET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  // An unset secret must never authorize a request (undefined === undefined).
  if (!process.env.SUMMARY_CRON_SECRET || token !== process.env.SUMMARY_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  if (!RECIPIENT) {
    return NextResponse.json({ error: "SUMMARY_EMAIL_TO is not set" }, { status: 400 });
  }

  const data = await gatherWeeklyData(lastWeekStart, lastWeekEnd);
  const emailContent = buildWeeklySummaryEmail(data);

  await sendAndLogEmail({
    to: RECIPIENT, ...emailContent,
    attachments: data._attachments,
    type: "weekly_summary",
    preview: `${data.weekLabel} — $${data.shifts.netPay.toFixed(0)} earned, ${data.tasks.completed} tasks done`,
    metadata: { weekLabel: data.weekLabel, netPay: data.shifts.netPay, tasksCompleted: data.tasks.completed },
  });

  // Push notification
  try {
    const prefs = await getPreferences();
    if (prefs.weeklySummary) {
      await sendPushNotification({
        title: "Weekly Summary Ready",
        body: `$${data.shifts.netPay.toFixed(0)} earned, ${data.tasks.completed} tasks done`,
        url: "/dashboard",
        tag: "weekly-summary",
      }, { type: "weekly_summary", refId: `summary-${Date.now()}` });
    }
  } catch { /* push failure should not break email */ }

  return NextResponse.json({ data: { sent: true, week: data.weekLabel } });
}

// Manual trigger: POST /api/email/weekly-summary?weeksAgo=0
export async function POST(req: Request) {
  const { requireAuth } = await import("@/lib/auth");
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(req.url);
  const weeksAgo = Number(searchParams.get("weeksAgo") || "0");

  const target = weeksAgo > 0 ? subWeeks(new Date(), weeksAgo) : new Date();
  const weekStart = startOfWeek(target, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(target, { weekStartsOn: 1 });

  if (!RECIPIENT) {
    return NextResponse.json({ error: "SUMMARY_EMAIL_TO is not set" }, { status: 400 });
  }

  const data = await gatherWeeklyData(weekStart, weekEnd);
  const emailContent = buildWeeklySummaryEmail(data);

  await sendAndLogEmail({
    to: RECIPIENT, ...emailContent,
    attachments: data._attachments,
    type: "weekly_summary",
    preview: `${data.weekLabel} — $${data.shifts.netPay.toFixed(0)} earned, ${data.tasks.completed} tasks done`,
    metadata: { weekLabel: data.weekLabel, netPay: data.shifts.netPay, tasksCompleted: data.tasks.completed },
  });

  return NextResponse.json({ data: { sent: true, week: data.weekLabel } });
}
