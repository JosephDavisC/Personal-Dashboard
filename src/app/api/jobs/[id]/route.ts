import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateJobSchema } from "@/lib/validations/job";
import { requireAuth } from "@/lib/auth";
import { sendPushNotification, getPreferences } from "@/lib/push";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { dateApplied, followUpDate, ...rest } = parsed.data;

  // Get old job before update (status + identity fields for comparison)
  const oldJob = await prisma.jobApplication.findUnique({
    where: { id },
    select: { status: true, company: true, title: true },
  });

  const statusChanged =
    rest.status !== undefined && oldJob !== null && rest.status !== oldJob.status;

  const job = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...rest,
      ...(dateApplied !== undefined
        ? { dateApplied: new Date(dateApplied) }
        : {}),
      ...(followUpDate !== undefined
        ? { followUpDate: followUpDate ? new Date(followUpDate) : null }
        : {}),
      ...(statusChanged && rest.status
        ? {
            history: {
              create: {
                fromStatus: oldJob!.status,
                toStatus: rest.status,
              },
            },
          }
        : {}),
    },
  });

  // Push notification for Interview or Offer status changes
  if (statusChanged && rest.status && (rest.status === "INTERVIEW" || rest.status === "OFFER")) {
    try {
      const prefs = await getPreferences();
      if (prefs.jobUpdates) {
        const emoji = rest.status === "OFFER" ? "Offer" : "Interview";
        await sendPushNotification({
          title: `${emoji} — ${job.company}`,
          body: `${job.title} moved to ${emoji}`,
          url: "/dashboard/jobs",
          tag: `job-${job.id}-${rest.status}`,
        }, { type: "job_update", refId: `job-${job.id}-${rest.status}-${Date.now()}` });
      }
    } catch { /* push failure should not break update */ }
  }

  return NextResponse.json({ data: job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  await prisma.jobApplication.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
