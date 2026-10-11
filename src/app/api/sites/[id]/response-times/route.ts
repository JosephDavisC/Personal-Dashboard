import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);

  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const pings = await prisma.sitePing.findMany({
      where: { siteId: id, checkedAt: { gte: cutoff } },
      orderBy: { checkedAt: "asc" },
      select: { checkedAt: true, responseTime: true, isUp: true },
    });

    const data = pings.map((p) => ({
      time: p.checkedAt.toISOString(),
      responseTime: p.responseTime,
      isUp: p.isUp,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
