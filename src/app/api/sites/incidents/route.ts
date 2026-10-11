import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "90", 10);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const incidents = await prisma.siteIncident.findMany({
      where: { startedAt: { gte: cutoff } },
      include: { site: { select: { label: true } } },
      orderBy: [{ resolvedAt: "asc" }, { startedAt: "desc" }],
    });

    const data = incidents.map((inc) => ({
      id: inc.id,
      siteId: inc.siteId,
      siteName: inc.site.label,
      title: inc.title,
      startedAt: inc.startedAt.toISOString(),
      resolvedAt: inc.resolvedAt?.toISOString() ?? null,
      duration: inc.duration,
      isOngoing: inc.resolvedAt === null,
    }));

    // ongoing first, then by startedAt desc
    data.sort((a, b) => {
      if (a.isOngoing && !b.isOngoing) return -1;
      if (!a.isOngoing && b.isOngoing) return 1;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
