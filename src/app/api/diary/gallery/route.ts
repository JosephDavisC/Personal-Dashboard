import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TIMEZONE } from "@/lib/constants";
import { formatInTimeZone } from "date-fns-tz";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 100);

  const photos = await prisma.diaryPhoto.findMany({
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      entry: {
        select: { date: true, mood: true, content: true },
      },
    },
  });

  const hasMore = photos.length > limit;
  const items = hasMore ? photos.slice(0, limit) : photos;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  // Batch-fetch MediaFile data for mimeType + duration
  const mediaIds = items.filter((p) => p.mediaId).map((p) => p.mediaId!);
  const mediaFiles = mediaIds.length > 0
    ? await prisma.mediaFile.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, mimeType: true, duration: true },
      })
    : [];
  const mediaMap = new Map(mediaFiles.map((m) => [m.id, m]));

  const data = items.map((p) => {
    const media = p.mediaId ? mediaMap.get(p.mediaId) : undefined;
    return {
      id: p.id,
      url: p.url,
      caption: p.caption,
      mediaId: p.mediaId,
      date: formatInTimeZone(p.entry.date, TIMEZONE, "yyyy-MM-dd"),
      dateLabel: formatInTimeZone(p.entry.date, TIMEZONE, "MMM d"),
      mood: p.entry.mood,
      entryContent: p.entry.content,
      mimeType: media?.mimeType ?? null,
      duration: media?.duration ?? null,
    };
  });

  return NextResponse.json({ photos: data, nextCursor });
}
