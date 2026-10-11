import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateTopicSchema } from "@/lib/validations/important";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const topic = await prisma.importantTopic.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ pinned: "desc" }, { order: "asc" }] },
      _count: { select: { items: true } },
    },
  });

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Enrich media items
  const mediaIds = topic.items
    .filter((i) => i.mediaId)
    .map((i) => i.mediaId as string);

  if (mediaIds.length > 0) {
    const mediaFiles = await prisma.mediaFile.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, shareSlug: true, filename: true, mimeType: true, size: true, thumbnail: true, title: true },
    });
    const mediaMap = new Map(mediaFiles.map((m) => [m.id, m]));
    for (const item of topic.items) {
      if (item.mediaId) {
        (item as Record<string, unknown>).media = mediaMap.get(item.mediaId) ?? null;
      }
    }
  }

  return NextResponse.json({ data: topic });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const topic = await prisma.importantTopic.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({ data: topic });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  await prisma.importantTopic.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
