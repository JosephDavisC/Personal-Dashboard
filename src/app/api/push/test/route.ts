import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendPushNotification, isPushConfigured } from "@/lib/push";
import { z } from "zod";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const sent = await sendPushNotification({
    title: "Test Notification",
    body: "Push notifications are working!",
    url: "/dashboard/settings",
    tag: "test",
  }, { type: "test", refId: `test-${Date.now()}` });

  return NextResponse.json({ data: { sent } });
}

const customTestSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const json = await request.json();
  const parsed = customTestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const sent = await sendPushNotification({
    title: parsed.data.title,
    body: parsed.data.body,
    url: "/dashboard/settings",
    tag: "test-custom",
  }, { type: "custom_test", refId: `custom-${Date.now()}` });

  return NextResponse.json({ data: { sent } });
}
