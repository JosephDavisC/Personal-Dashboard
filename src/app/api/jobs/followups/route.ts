import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { STALE_JOB_THRESHOLD_DAYS } from "@/lib/constants";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_JOB_THRESHOLD_DAYS);

  const now = new Date();

  const jobs = await prisma.jobApplication.findMany({
    where: {
      OR: [
        // Stale: applied/phone screen with no update in 14+ days
        {
          status: { in: ["APPLIED", "PHONE_SCREEN"] },
          updatedAt: { lte: cutoff },
        },
        // Manual follow-up date is today or past
        {
          followUpDate: { lte: now },
          status: { notIn: ["REJECTED", "WITHDRAWN"] },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: 10,
  });

  return NextResponse.json({ data: jobs });
}
