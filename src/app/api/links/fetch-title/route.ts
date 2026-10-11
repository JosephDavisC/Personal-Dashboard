import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
});

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { url } = parsed.data;
    let title: string | null = null;
    let favicon: string | null = null;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch?.[1]) {
          title = titleMatch[1].trim().slice(0, 200);
        }
        const iconMatch = html.match(
          /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i
        );
        if (iconMatch?.[1]) {
          const iconUrl = iconMatch[1];
          favicon = iconUrl.startsWith("http")
            ? iconUrl
            : new URL(iconUrl, url).href;
        }
      }
    } catch {
      // Fetch failed, continue without metadata
    }

    // Fallback favicon from Google
    if (!favicon) {
      try {
        const domain = new URL(url).hostname;
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch {
        // Invalid URL
      }
    }

    return NextResponse.json({ data: { title, favicon } });
  } catch (error) {
    console.error("POST /api/links/fetch-title error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
