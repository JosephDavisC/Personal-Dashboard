import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateDiarySchema } from "@/lib/validations/diary";
import { TIMEZONE } from "@/lib/constants";
import { fromZonedTime } from "date-fns-tz";

function parseDateParam(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
}

const entryInclude = {
  photos: { orderBy: { order: "asc" as const } },
  links: { orderBy: { order: "asc" as const } },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { date } = await params;
    const dateObj = parseDateParam(date);

    const entry = await prisma.diaryEntry.findUnique({
      where: { date: dateObj },
      include: entryInclude,
    });

    // Enrich photos with mimeType from MediaFile
    if (entry?.photos?.length) {
      const mediaIds = entry.photos.filter((p) => p.mediaId).map((p) => p.mediaId!);
      const mediaFiles =
        mediaIds.length > 0
          ? await prisma.mediaFile.findMany({
              where: { id: { in: mediaIds } },
              select: { id: true, mimeType: true },
            })
          : [];
      const mimeMap = new Map(mediaFiles.map((m) => [m.id, m.mimeType]));
      const enriched = {
        ...entry,
        photos: entry.photos.map((p) => ({
          ...p,
          mimeType: p.mediaId ? (mimeMap.get(p.mediaId) ?? null) : null,
        })),
      };
      return NextResponse.json({ data: enriched });
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    console.error("GET /api/diary/[date] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { date } = await params;
    const dateObj = parseDateParam(date);
    const body: unknown = await request.json();
    const parsed = updateDiarySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const entry = await prisma.diaryEntry.upsert({
      where: { date: dateObj },
      create: {
        date: dateObj,
        content: parsed.data.content ?? null,
        mood: parsed.data.mood ?? null,
        tags: parsed.data.tags ?? [],
      },
      update: parsed.data,
      include: entryInclude,
    });

    // Enrich photos with mimeType from MediaFile
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
      });
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    console.error("PATCH /api/diary/[date] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { date } = await params;
    const dateObj = parseDateParam(date);

    // Try exact match first, fall back to date range for timezone mismatches
    let entry = await prisma.diaryEntry.findUnique({ where: { date: dateObj } });
    if (!entry) {
      const dayStart = new Date(`${date}T00:00:00Z`);
      const dayEnd = new Date(`${date}T23:59:59Z`);
      entry = await prisma.diaryEntry.findFirst({
        where: { date: { gte: dayStart, lte: dayEnd } },
      });
    }
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    await prisma.diaryEntry.delete({ where: { id: entry.id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
}
