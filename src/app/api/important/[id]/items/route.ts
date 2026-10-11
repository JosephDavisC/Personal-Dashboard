import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createItemSchema } from "@/lib/validations/important";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Verify topic exists
  const topic = await prisma.importantTopic.findUnique({ where: { id } });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // If mediaId provided, verify it exists
  if (parsed.data.mediaId) {
    const media = await prisma.mediaFile.findUnique({
      where: { id: parsed.data.mediaId },
    });
    if (!media) {
      return NextResponse.json({ error: "Media file not found" }, { status: 404 });
    }
  }

  const item = await prisma.importantItem.create({
    data: {
      topicId: id,
      type: parsed.data.type,
      label: parsed.data.label ?? null,
      url: parsed.data.url ?? null,
      content: parsed.data.content ?? null,
      mediaId: parsed.data.mediaId ?? null,
      pinned: parsed.data.pinned ?? false,
    },
  });

  // Touch the topic updatedAt
  await prisma.importantTopic.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  // If mediaId, enrich with media data
  if (item.mediaId) {
    const media = await prisma.mediaFile.findUnique({
      where: { id: item.mediaId },
      select: { id: true, shareSlug: true, filename: true, mimeType: true, size: true, thumbnail: true, title: true },
    });
    (item as Record<string, unknown>).media = media;
  }

  return NextResponse.json({ data: item }, { status: 201 });
}
