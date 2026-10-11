import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteFile, deleteThumbnail } from "@/lib/media-utils";
import { z } from "zod";

const updatePhotoSchema = z.object({
  caption: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { photoId } = await params;

  const body: unknown = await request.json();
  const parsed = updatePhotoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const photo = await prisma.taskPhoto.update({
    where: { id: photoId },
    data: parsed.data,
  });

  return NextResponse.json({ data: photo });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { photoId } = await params;

  const photo = await prisma.taskPhoto.findUnique({ where: { id: photoId } });
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await prisma.taskPhoto.delete({ where: { id: photoId } });

  // Also delete the underlying media file if linked
  if (photo.mediaId) {
    const media = await prisma.mediaFile.findUnique({
      where: { id: photo.mediaId },
      select: { storedName: true, thumbnail: true },
    });
    if (media) {
      await deleteFile(media.storedName);
      if (media.thumbnail) await deleteThumbnail(media.thumbnail);
      await prisma.mediaFile.delete({ where: { id: photo.mediaId } });
    }
  }

  return NextResponse.json({ data: { id: photoId } });
}
