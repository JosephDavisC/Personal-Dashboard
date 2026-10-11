import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSiteHealth } from "@/lib/site-health";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    const sites = await prisma.monitoredSite.findMany({
      orderBy: { order: "asc" },
    });

    const results = await Promise.allSettled(
      sites.map((site) => checkSiteHealth(site.url, site.label))
    );

    const health = results.map((result, i) => {
      const site = sites[i];
      if (result.status === "fulfilled") {
        return result.value;
      }
      return {
        url: site?.url ?? "",
        label: site?.label ?? "Unknown",
        status: "error" as const,
        checkedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({ data: health });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
