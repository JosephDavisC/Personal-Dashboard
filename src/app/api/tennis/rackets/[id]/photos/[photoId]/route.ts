import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateTennisPhotoSchema } from "@/lib/validations/tennis";
import { deleteMediaWithThumbnail } from "@/lib/media-storage";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { photoId } = await params;
    const body: unknown = await request.json();
    const parsed = updateTennisPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const photo = await prisma.racketPhoto.update({
      where: { id: photoId },
      data: parsed.data,
    });

    return NextResponse.json({ data: photo });
  } catch (error) {
    console.error("PATCH racket photo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { photoId } = await params;
    const photo = await prisma.racketPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete linked MediaFile + filesystem
    if (photo.mediaId) {
      const media = await prisma.mediaFile.findUnique({ where: { id: photo.mediaId } });
      if (media) {
        await deleteMediaWithThumbnail(media);
        await prisma.mediaFile.delete({ where: { id: media.id } });
      }
    }

    await prisma.racketPhoto.delete({ where: { id: photoId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE racket photo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
