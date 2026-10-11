import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateRacketSchema } from "@/lib/validations/tennis";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const racket = await prisma.tennisRacket.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { order: "asc" } },
        restrings: { orderBy: { date: "desc" }, include: { photos: true } },
        sessions: { orderBy: { date: "desc" }, take: 10, select: { id: true, type: true, date: true, duration: true, location: true } },
        _count: { select: { sessions: true, restrings: true } },
      },
    });

    if (!racket) {
      return NextResponse.json({ error: "Racket not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...racket,
        daysSinceStrung: racket.lastStrung
          ? Math.floor((Date.now() - racket.lastStrung.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/tennis/rackets/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateRacketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { lastStrung, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (lastStrung !== undefined) {
      updateData.lastStrung = lastStrung ? new Date(lastStrung) : null;
    }

    const racket = await prisma.tennisRacket.update({
      where: { id },
      data: updateData,
      include: {
        photos: { orderBy: { order: "asc" } },
        _count: { select: { sessions: true, restrings: true } },
      },
    });

    return NextResponse.json({ data: racket });
  } catch (error) {
    console.error("PATCH /api/tennis/rackets/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await prisma.tennisRacket.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/tennis/rackets/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
