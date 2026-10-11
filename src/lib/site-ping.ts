import { prisma } from "@/lib/prisma";
import type { MonitoredSite } from "@/generated/prisma/client";
import { sendPushNotification, getPreferences } from "@/lib/push";

export interface PingResult {
  status: number;
  responseTime: number;
  isUp: boolean;
}

export async function pingSite(url: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    clearTimeout(timeout);
    return {
      status: res.status,
      responseTime: Date.now() - start,
      isUp: res.status >= 200 && res.status < 400,
    };
  } catch {
    return { status: 0, responseTime: Date.now() - start, isUp: false };
  }
}

export async function detectIncident(site: MonitoredSite, isUp: boolean) {
  const ongoingIncident = await prisma.siteIncident.findFirst({
    where: { siteId: site.id, resolvedAt: null },
  });

  if (!isUp) {
    const recentPings = await prisma.sitePing.findMany({
      where: { siteId: site.id },
      orderBy: { checkedAt: "desc" },
      take: 3,
    });
    const allDown =
      recentPings.length >= 3 && recentPings.every((p) => !p.isUp);

    if (allDown && !ongoingIncident) {
      const oldest = recentPings[recentPings.length - 1];
      await prisma.siteIncident.create({
        data: {
          siteId: site.id,
          title: `${site.label} went down`,
          startedAt: oldest?.checkedAt ?? new Date(),
        },
      });

      // Push notification for site down
      try {
        const prefs = await getPreferences();
        if (prefs.siteAlerts) {
          await sendPushNotification({
            title: `${site.label} is Down`,
            body: `${site.url} — 3 consecutive failed pings`,
            url: "/dashboard/sites",
            tag: `site-down-${site.id}`,
          }, { type: "site_down", refId: `down-${site.id}-${Date.now()}` });
        }
      } catch { /* push failure should not break monitoring */ }
    }
  } else if (ongoingIncident) {
    const duration = Math.round(
      (Date.now() - ongoingIncident.startedAt.getTime()) / 1000
    );
    await prisma.siteIncident.update({
      where: { id: ongoingIncident.id },
      data: { resolvedAt: new Date(), duration },
    });

    // Push notification for site recovery
    try {
      const prefs = await getPreferences();
      if (prefs.siteAlerts) {
        const mins = Math.round(duration / 60);
        await sendPushNotification({
          title: `${site.label} is Back Up`,
          body: `Recovered after ${mins > 0 ? `${mins} min` : `${duration}s`} downtime`,
          url: "/dashboard/sites",
          tag: `site-up-${site.id}`,
        }, { type: "site_up", refId: `up-${site.id}-${Date.now()}` });
      }
    } catch { /* push failure should not break monitoring */ }
  }
}

export async function cleanupOldPings() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  await prisma.sitePing.deleteMany({ where: { checkedAt: { lt: cutoff } } });
}

export async function runSiteChecks() {
  const sites = await prisma.monitoredSite.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });

  for (const site of sites) {
    const result = await pingSite(site.url);

    await prisma.sitePing.create({
      data: {
        siteId: site.id,
        status: result.status,
        responseTime: result.responseTime,
        isUp: result.isUp,
      },
    });

    await detectIncident(site, result.isUp);
  }

  await cleanupOldPings();

  return sites.length;
}
