import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteMediaWithThumbnail } from "@/lib/media-storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { photoId } = await params;
    const photo = await prisma.stringPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (photo.mediaId) {
      const media = await prisma.mediaFile.findUnique({ where: { id: photo.mediaId } });
      if (media) {
        await deleteMediaWithThumbnail(media);
        await prisma.mediaFile.delete({ where: { id: media.id } });
      }
    }

    await prisma.stringPhoto.delete({ where: { id: photoId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE string photo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
