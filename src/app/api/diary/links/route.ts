import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addDiaryLinkSchema } from "@/lib/validations/diary";

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const parsed = addDiaryLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { entryId, url, title } = parsed.data;

    // Check entry exists
    const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Enforce max 5 links per entry
    const count = await prisma.diaryLink.count({ where: { entryId } });
    if (count >= 5) {
      return NextResponse.json({ error: "Maximum 5 links per entry" }, { status: 400 });
    }

    // Try to fetch title and favicon server-side
    let fetchedTitle = title ?? null;
    let favicon: string | null = null;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DashboardBot/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const html = await res.text();
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch?.[1] && !fetchedTitle) {
          fetchedTitle = titleMatch[1].trim().slice(0, 500);
        }
        // Extract favicon
        const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
        if (iconMatch?.[1]) {
          const iconUrl = iconMatch[1];
          favicon = iconUrl.startsWith("http") ? iconUrl : new URL(iconUrl, url).href;
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

    const link = await prisma.diaryLink.create({
      data: {
        entryId,
        url,
        title: fetchedTitle,
        favicon,
        order: count,
      },
    });

    return NextResponse.json({ data: link }, { status: 201 });
  } catch (error) {
    console.error("POST /api/diary/links error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
