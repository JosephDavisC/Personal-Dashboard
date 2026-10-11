import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { unlink } from "fs/promises";
import { join } from "path";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { videoId } = await params;
    const body = (await request.json()) as { label?: string };

    const video = await prisma.sessionVideo.update({
      where: { id: videoId },
      data: { label: body.label ?? null },
    });

    return NextResponse.json({ data: video });
  } catch (error) {
    console.error("PATCH session video error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { videoId } = await params;
    const video = await prisma.sessionVideo.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.mediaId) {
      const media = await prisma.mediaFile.findUnique({ where: { id: video.mediaId } });
      if (media) {
        const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
        try {
          await unlink(join(uploadDir, media.storedName));
          if (media.thumbnail) await unlink(join(uploadDir, media.thumbnail)).catch(() => {});
        } catch {}
        await prisma.mediaFile.delete({ where: { id: media.id } });
      }
    }

    await prisma.sessionVideo.delete({ where: { id: videoId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE session video error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
