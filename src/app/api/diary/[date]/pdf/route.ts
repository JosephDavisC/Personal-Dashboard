import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateSingleEntryPdf } from "@/lib/diary-pdf";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { date: dateStr } = await params;
  const parsed = parseISO(dateStr);
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const dayStart = fromZonedTime(startOfDay(parsed), TIMEZONE);
  const dayEnd = fromZonedTime(endOfDay(parsed), TIMEZONE);

  const entry = await prisma.diaryEntry.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd } },
    include: { photos: { orderBy: { order: "asc" } }, links: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Fetch media data for photos to get mimeType/thumbnail for video detection
  const mediaIds = entry.photos.map(p => p.mediaId).filter(Boolean) as string[];
  const mediaMap = new Map<string, { mimeType: string; thumbnail: string | null }>();
  if (mediaIds.length > 0) {
    const mediaFiles = await prisma.mediaFile.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, mimeType: true, thumbnail: true },
    });
    for (const m of mediaFiles) mediaMap.set(m.id, { mimeType: m.mimeType, thumbnail: m.thumbnail });
  }

  const enrichedEntry = {
    ...entry,
    photos: entry.photos.map(p => {
      const media = p.mediaId ? mediaMap.get(p.mediaId) : null;
      return { ...p, mimeType: media?.mimeType ?? null, thumbnail: media?.thumbnail ?? null };
    }),
  };

  const html = generateSingleEntryPdf(enrichedEntry, baseUrl);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
