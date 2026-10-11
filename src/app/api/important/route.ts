import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createTopicSchema } from "@/lib/validations/important";

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const includeItems = searchParams.get("include") === "items";

  const topics = await prisma.importantTopic.findMany({
    orderBy: [{ pinned: "desc" }, { order: "asc" }],
    include: {
      items: includeItems ? { orderBy: [{ pinned: "desc" }, { order: "asc" }] } : false,
      _count: { select: { items: true } },
    },
  });

  // If including items, enrich media items with MediaFile data
  if (includeItems) {
    const mediaIds = topics.flatMap((t) =>
      (t.items ?? []).filter((i) => i.mediaId).map((i) => i.mediaId as string)
    );
    if (mediaIds.length > 0) {
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, shareSlug: true, filename: true, mimeType: true, size: true, thumbnail: true, title: true },
      });
      const mediaMap = new Map(mediaFiles.map((m) => [m.id, m]));
      for (const topic of topics) {
        for (const item of topic.items ?? []) {
          if (item.mediaId) {
            (item as Record<string, unknown>).media = mediaMap.get(item.mediaId) ?? null;
          }
        }
      }
    }
  }

  return NextResponse.json({ data: topics });
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const topic = await prisma.importantTopic.create({
    data: {
      title: parsed.data.title,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      category: parsed.data.category ?? null,
      pinned: parsed.data.pinned ?? false,
    },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({ data: topic }, { status: 201 });
}
