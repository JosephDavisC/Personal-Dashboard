import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { isReadOnlyDemo } from "@/lib/demo";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

interface PushLogOptions {
  type: string;
  refId: string;
}

export async function sendPushNotification(payload: PushPayload, log?: PushLogOptions): Promise<number> {
  if (!ensureVapid()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/icon-192.png",
          badge: "/badge-72.png",
          url: payload.url || "/dashboard",
          tag: payload.tag || "default",
        })
      );
      sent++;
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      // Remove expired/invalid subscriptions
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }

  // Log notification to audit trail
  if (sent > 0 && log) {
    await prisma.notificationLog.create({
      data: { type: log.type, refId: log.refId },
    }).catch(() => {});
  }

  return sent;
}

/** Check if push notifications are configured (VAPID keys set) */
export function isPushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY && !!VAPID_PRIVATE_KEY;
}

/** Get preferences (creates default row if missing) */
export async function getPreferences() {
  let prefs = await prisma.notificationPreferences.findUnique({ where: { id: "default" } });
  if (!prefs) {
    // The read-only demo can't create the row; show the defaults instead
    if (isReadOnlyDemo()) {
      return {
        id: "default", shiftReminders: true, taskDue: true, siteAlerts: true, weeklySummary: true,
        jobUpdates: true, diaryReminder: true, driveBackup: true, stringAge: true,
      };
    }
    prefs = await prisma.notificationPreferences.create({ data: { id: "default" } });
  }
  return prefs;
}
