import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateConversationSchema } from "@/lib/validations/chat";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Resolve image IDs to share URLs for user messages
    const allImageIds = conversation.messages.flatMap((m) => m.imageIds);
    let imageMap: Record<string, { shareSlug: string; mimeType: string }> = {};
    if (allImageIds.length > 0) {
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: allImageIds } },
        select: { id: true, shareSlug: true, mimeType: true },
      });
      imageMap = Object.fromEntries(
        mediaFiles.map((m) => [m.id, { shareSlug: m.shareSlug, mimeType: m.mimeType }])
      );
    }

    const messagesWithImages = conversation.messages.map((m) => ({
      ...m,
      images: m.imageIds.length > 0
        ? m.imageIds
            .filter((id) => imageMap[id])
            .map((id) => ({
              mediaId: id,
              mimeType: imageMap[id]!.mimeType,
              url: `/api/media/share/${imageMap[id]!.shareSlug}`,
            }))
        : undefined,
    }));

    return NextResponse.json({
      data: { ...conversation, messages: messagesWithImages },
    });
  } catch (error) {
    console.error("GET /api/conversations/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const conversation = await prisma.chatConversation.update({
      where: { id },
      data: { title: parsed.data.title },
    });

    return NextResponse.json({ data: conversation });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await prisma.chatConversation.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
