import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getPreferences } from "@/lib/push";
import { z } from "zod";

const updateSchema = z.object({
  shiftReminders: z.boolean().optional(),
  taskDue: z.boolean().optional(),
  siteAlerts: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  jobUpdates: z.boolean().optional(),
  diaryReminder: z.boolean().optional(),
  driveBackup: z.boolean().optional(),
  stringAge: z.boolean().optional(),
  // strict: an unknown key is a UI/schema mismatch, and stripping it
  // silently turns the PATCH into a no-op that looks like it worked
}).strict();

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const prefs = await getPreferences();
  return NextResponse.json({ data: prefs });
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body: unknown = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Ensure row exists
  await getPreferences();

  const prefs = await prisma.notificationPreferences.update({
    where: { id: "default" },
    data: parsed.data,
  });

  return NextResponse.json({ data: prefs });
}
