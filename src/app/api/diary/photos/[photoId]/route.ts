import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updatePhotoSchema } from "@/lib/validations/diary";
import { deleteFile, deleteThumbnail } from "@/lib/media-utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { photoId } = await params;
  const body = await request.json();
  const parsed = updatePhotoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const photo = await prisma.diaryPhoto.update({
      where: { id: photoId },
      data: { caption: parsed.data.caption ?? null },
    });
    return NextResponse.json({ data: photo });
  } catch {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { photoId } = await params;

  try {
    const photo = await prisma.diaryPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete the diary photo record
    await prisma.diaryPhoto.delete({ where: { id: photoId } });

    // Also delete the underlying media file if linked
    if (photo.mediaId) {
      const media = await prisma.mediaFile.findUnique({
        where: { id: photo.mediaId },
        select: { storedName: true, thumbnail: true },
      });
      if (media) {
        deleteFile(media.storedName);
        if (media.thumbnail) deleteThumbnail(media.thumbnail);
        await prisma.mediaFile.delete({ where: { id: photo.mediaId } });
      }
    }
  } catch {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { deleted: true } });
}
