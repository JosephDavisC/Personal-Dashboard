import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const updatePinnedMediaSchema = z.object({
  category: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = updatePinnedMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const pinnedMedia = await prisma.pinnedMedia.update({
    where: { id },
    data: parsed.data,
    include: { media: true },
  });

  return NextResponse.json({ data: pinnedMedia });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  await prisma.pinnedMedia.delete({ where: { id } });

  return NextResponse.json({ data: { success: true } });
}
