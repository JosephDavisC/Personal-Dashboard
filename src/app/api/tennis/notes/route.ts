import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createTennisNoteSchema } from "@/lib/validations/tennis";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const tag = searchParams.get("tag");
    const pinned = searchParams.get("pinned");

    const where: Record<string, unknown> = {};
    if (q) where.content = { contains: q, mode: "insensitive" };
    if (tag) where.tags = { has: tag };
    if (pinned === "true") where.pinned = true;

    const notes = await prisma.tennisNote.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error("GET /api/tennis/notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const parsed = createTennisNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const note = await prisma.tennisNote.create({
      data: {
        content: parsed.data.content,
        tags: parsed.data.tags ?? [],
        pinned: parsed.data.pinned ?? false,
      },
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tennis/notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
