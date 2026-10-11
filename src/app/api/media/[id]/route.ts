import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateMediaSchema } from "@/lib/validations/media";
import {
  deleteFile,
  deleteThumbnail,
  hashPassword,
} from "@/lib/media-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({ where: { id } });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: file });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateMediaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { password, expiresAt, ...rest } = parsed.data;

  const file = await prisma.mediaFile.update({
    where: { id },
    data: {
      ...rest,
      ...(password !== undefined
        ? { password: password ? hashPassword(password) : null }
        : {}),
      ...(expiresAt !== undefined
        ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
        : {}),
    },
  });

  return NextResponse.json({ data: file });
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
    select: { storedName: true, thumbnail: true },
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from filesystem
  deleteFile(file.storedName);
  if (file.thumbnail) deleteThumbnail(file.thumbnail);

  // Clean up linked diary/task photo records
  await prisma.diaryPhoto.deleteMany({ where: { mediaId: id } });
  await prisma.taskPhoto.deleteMany({ where: { mediaId: id } });

  // Delete from database
  await prisma.mediaFile.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
