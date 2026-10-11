import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const history = await prisma.jobApplicationHistory.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: history });
}
