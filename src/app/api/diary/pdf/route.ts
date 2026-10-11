import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateFullDiaryPdf } from "@/lib/diary-pdf";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const entries = await prisma.diaryEntry.findMany({
    orderBy: { date: "desc" },
    include: { photos: { orderBy: { order: "asc" } }, links: true },
  });

  // Batch-fetch media data for photos to get mimeType/thumbnail for video detection
  const mediaIds = entries.flatMap(e => e.photos.map(p => p.mediaId).filter(Boolean)) as string[];
  const mediaMap = new Map<string, { mimeType: string; thumbnail: string | null }>();
  if (mediaIds.length > 0) {
    const mediaFiles = await prisma.mediaFile.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, mimeType: true, thumbnail: true },
    });
    for (const m of mediaFiles) mediaMap.set(m.id, { mimeType: m.mimeType, thumbnail: m.thumbnail });
  }

  const enrichedEntries = entries.map(e => ({
    ...e,
    photos: e.photos.map(p => {
      const media = p.mediaId ? mediaMap.get(p.mediaId) : null;
      return { ...p, mimeType: media?.mimeType ?? null, thumbnail: media?.thumbnail ?? null };
    }),
  }));

  const html = generateFullDiaryPdf(enrichedEntries, baseUrl);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
