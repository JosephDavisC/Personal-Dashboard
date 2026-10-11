import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { photoId } = await params;
    const photo = await prisma.restringPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (photo.mediaId) {
      const media = await prisma.mediaFile.findUnique({ where: { id: photo.mediaId } });
      if (media) {
        const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
        try {
          await unlink(join(uploadDir, media.storedName));
          if (media.thumbnail) await unlink(join(uploadDir, media.thumbnail)).catch(() => {});
        } catch {}
        await prisma.mediaFile.delete({ where: { id: media.id } });
      }
    }

    await prisma.restringPhoto.delete({ where: { id: photoId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE restring photo error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
