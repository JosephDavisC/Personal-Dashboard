import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addSessionVideoSchema } from "@/lib/validations/tennis";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = addSessionVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const video = await prisma.sessionVideo.create({
      data: {
        sessionId: id,
        url: parsed.data.url,
        label: parsed.data.label ?? null,
        mediaId: parsed.data.mediaId ?? null,
      },
    });

    return NextResponse.json({ data: video }, { status: 201 });
  } catch (error) {
    console.error("POST session video error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
