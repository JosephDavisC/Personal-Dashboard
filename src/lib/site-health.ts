import type { SiteHealth } from "@/types/site";

export async function checkSiteHealth(
  url: string,
  label: string
): Promise<SiteHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const start = Date.now();
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    const responseTime = Date.now() - start;

    return {
      url,
      label,
      status: res.ok ? "up" : "down",
      statusCode: res.status,
      responseTime,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      url,
      label,
      status: "down",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
