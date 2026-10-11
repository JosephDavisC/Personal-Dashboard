import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createDiarySchema } from "@/lib/validations/diary";
import { TIMEZONE } from "@/lib/constants";
import { fromZonedTime } from "date-fns-tz";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50);
    const tag = searchParams.get("tag");
    const mood = searchParams.get("mood");
    const month = searchParams.get("month"); // format: 2026-02

    const where: Record<string, unknown> = {};
    if (tag) where.tags = { has: tag };
    if (mood) where.mood = mood;
    if (month) {
      const [year, m] = month.split("-");
      if (year && m) {
        const start = fromZonedTime(`${year}-${m.padStart(2, "0")}-01T00:00:00`, TIMEZONE);
        const nextMonth = Number(m) === 12 ? 1 : Number(m) + 1;
        const nextYear = Number(m) === 12 ? Number(year) + 1 : Number(year);
        const end = fromZonedTime(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`, TIMEZONE);
        where.date = { gte: start, lt: end };
      }
    }

    const entries = await prisma.diaryEntry.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        photos: {
          orderBy: { order: "asc" },
          take: 4,
        },
        links: {
          orderBy: { order: "asc" },
        },
      },
    });

    const hasMore = entries.length > limit;
    const items = hasMore ? entries.slice(0, limit) : entries;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    // Batch-fetch mimeType from MediaFile for all photos
    const allMediaIds = items
      .flatMap((e) => e.photos)
      .filter((p) => p.mediaId)
      .map((p) => p.mediaId!);
    const mediaFiles =
      allMediaIds.length > 0
        ? await prisma.mediaFile.findMany({
            where: { id: { in: allMediaIds } },
            select: { id: true, mimeType: true },
          })
        : [];
    const mimeMap = new Map(mediaFiles.map((m) => [m.id, m.mimeType]));

    const enrichedItems = items.map((e) => ({
      ...e,
      photos: e.photos.map((p) => ({
        ...p,
        mimeType: p.mediaId ? (mimeMap.get(p.mediaId) ?? null) : null,
      })),
    }));

    return NextResponse.json({ entries: enrichedItems, nextCursor });
  } catch (error) {
    console.error("GET /api/diary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const parsed = createDiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { date, content, mood, tags } = parsed.data;
    const dateObj = fromZonedTime(`${date}T00:00:00`, TIMEZONE);

    const entry = await prisma.diaryEntry.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        content: content ?? null,
        mood: mood ?? null,
        tags: tags ?? [],
      },
      update: {
        content: content ?? null,
        mood: mood ?? null,
        tags: tags ?? [],
      },
      include: {
        photos: { orderBy: { order: "asc" } },
        links: { orderBy: { order: "asc" } },
      },
    });

    // Enrich photos with mimeType
    if (entry.photos?.length) {
      const mediaIds = entry.photos.filter((p) => p.mediaId).map((p) => p.mediaId!);
      const mediaFiles =
        mediaIds.length > 0
          ? await prisma.mediaFile.findMany({
              where: { id: { in: mediaIds } },
              select: { id: true, mimeType: true },
            })
          : [];
      const mimeMap = new Map(mediaFiles.map((m) => [m.id, m.mimeType]));
      return NextResponse.json({
        data: {
          ...entry,
          photos: entry.photos.map((p) => ({
            ...p,
            mimeType: p.mediaId ? (mimeMap.get(p.mediaId) ?? null) : null,
          })),
        },
      }, { status: 201 });
    }

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/diary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
