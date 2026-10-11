import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addPhotoSchema } from "@/lib/validations/diary";

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body: unknown = await request.json();
  const parsed = addPhotoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { entryId, url, caption, mediaId, order } = parsed.data;

  // Verify entry exists
  const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const photo = await prisma.diaryPhoto.create({
    data: {
      entryId,
      url,
      caption: caption ?? null,
      mediaId: mediaId ?? null,
      order: order ?? 0,
    },
  });

  return NextResponse.json({ data: photo }, { status: 201 });
}
