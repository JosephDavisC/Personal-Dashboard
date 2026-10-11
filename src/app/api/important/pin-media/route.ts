import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const pinMediaSchema = z.object({
  mediaId: z.string().min(1),
  category: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const pinnedMedia = await prisma.pinnedMedia.findMany({
    include: { media: true },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ data: pinnedMedia });
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = pinMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Check if already pinned
  const existing = await prisma.pinnedMedia.findUnique({
    where: { mediaId: parsed.data.mediaId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This file is already pinned" },
      { status: 409 }
    );
  }

  // Verify media file exists
  const media = await prisma.mediaFile.findUnique({
    where: { id: parsed.data.mediaId },
  });
  if (!media) {
    return NextResponse.json(
      { error: "Media file not found" },
      { status: 404 }
    );
  }

  const pinnedMedia = await prisma.pinnedMedia.create({
    data: {
      mediaId: parsed.data.mediaId,
      category: parsed.data.category ?? null,
      pinned: parsed.data.pinned ?? false,
    },
    include: { media: true },
  });

  return NextResponse.json({ data: pinnedMedia }, { status: 201 });
}
