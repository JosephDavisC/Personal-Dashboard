import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sites = await prisma.monitoredSite.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await Promise.all(
      sites.map(async (site) => {
        const latestPing = await prisma.sitePing.findFirst({
          where: { siteId: site.id },
          orderBy: { checkedAt: "desc" },
        });

        const [totalPings, upPings] = await Promise.all([
          prisma.sitePing.count({
            where: { siteId: site.id, checkedAt: { gte: cutoff } },
          }),
          prisma.sitePing.count({
            where: {
              siteId: site.id,
              checkedAt: { gte: cutoff },
              isUp: true,
            },
          }),
        ]);

        const uptime90d =
          totalPings > 0
            ? Math.round((upPings / totalPings) * 10000) / 100
            : null;

        return {
          id: site.id,
          label: site.label,
          url: site.url,
          order: site.order,
          isUp: latestPing?.isUp ?? null,
          status: latestPing?.status ?? null,
          responseTime: latestPing?.responseTime ?? null,
          lastChecked: latestPing?.checkedAt?.toISOString() ?? null,
          uptime90d,
        };
      })
    );

    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
