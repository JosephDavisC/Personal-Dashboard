import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const cursor = searchParams.get("cursor");

  const where = type ? { type } : {};

  const emails = await prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = emails.length > limit;
  const data = hasMore ? emails.slice(0, limit) : emails;

  return NextResponse.json({
    data,
    nextCursor: hasMore ? data[data.length - 1]?.id : null,
  });
}
