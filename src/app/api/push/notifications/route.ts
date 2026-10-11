import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const logs = await prisma.notificationLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ data: logs });
}
