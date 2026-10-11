import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateRestringSchema } from "@/lib/validations/tennis";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateRestringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { date, ...rest } = parsed.data;

    const updated = await prisma.restring.update({
      where: { id },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
      },
      include: { photos: { orderBy: { order: "asc" } } },
    });

    // If this is the most recent restring for its racket, update the racket's current string info
    const latestRestring = await prisma.restring.findFirst({
      where: { racketId: updated.racketId },
      orderBy: { date: "desc" },
    });

    if (latestRestring && latestRestring.id === id) {
      const isHybrid = !!updated.crossStringName;
      const displayString = isHybrid
        ? `${updated.stringName} / ${updated.crossStringName}`
        : updated.stringName;
      const displayTension = isHybrid && updated.crossTension
        ? `${updated.tension} / ${updated.crossTension}`
        : updated.tension;

      await prisma.tennisRacket.update({
        where: { id: updated.racketId },
        data: {
          currentString: displayString,
          tension: displayTension,
          lastStrung: updated.date,
        },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH restring error:", error);
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
    await prisma.restring.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE restring error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
