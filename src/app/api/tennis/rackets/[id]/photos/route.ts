import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addTennisPhotoSchema } from "@/lib/validations/tennis";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = addTennisPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const photo = await prisma.racketPhoto.create({
      data: {
        racketId: id,
        url: parsed.data.url,
        caption: parsed.data.caption ?? null,
        mediaId: parsed.data.mediaId ?? null,
      },
    });

    return NextResponse.json({ data: photo }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tennis/rackets/[id]/photos error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
