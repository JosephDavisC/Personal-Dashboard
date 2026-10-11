import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getThumbPath } from "@/lib/media-utils";
import { MEDIA_THUMBS_DIR } from "@/lib/constants";
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const imageFile = formData.get("file") as File | null;

  if (!imageFile || !imageFile.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Image file required" },
      { status: 400 }
    );
  }

  // Delete old thumbnail if exists
  if (file.thumbnail) {
    const oldPath = getThumbPath(file.thumbnail);
    if (existsSync(oldPath)) unlinkSync(oldPath);
  }

  // Save new thumbnail
  if (!existsSync(MEDIA_THUMBS_DIR)) {
    mkdirSync(MEDIA_THUMBS_DIR, { recursive: true });
  }

  const ext = imageFile.type === "image/png" ? ".png" : ".jpg";
  const thumbName = file.storedName.replace(/\.[^.]+$/, `_custom${ext}`);
  const thumbPath = join(MEDIA_THUMBS_DIR, thumbName);

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  writeFileSync(thumbPath, buffer);

  await prisma.mediaFile.update({
    where: { id },
    data: { thumbnail: thumbName },
  });

  return NextResponse.json({ data: { thumbnail: thumbName } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({
    where: { id },
    select: { thumbnail: true },
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (file.thumbnail) {
    const thumbPath = getThumbPath(file.thumbnail);
    if (existsSync(thumbPath)) unlinkSync(thumbPath);
  }

  await prisma.mediaFile.update({
    where: { id },
    data: { thumbnail: null },
  });

  return NextResponse.json({ data: { removed: true } });
}
