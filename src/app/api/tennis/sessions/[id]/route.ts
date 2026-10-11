import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateSessionSchema } from "@/lib/validations/tennis";
import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const session = await prisma.tennisSession.findUnique({
      where: { id },
      include: {
        racket: { select: { id: true, name: true, brand: true, model: true } },
        photos: { orderBy: { order: "asc" } },
        videos: { orderBy: { createdAt: "asc" } },
        strokeRatings: { orderBy: { stroke: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    console.error("GET /api/tennis/sessions/[id] error:", error);
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
    const parsed = updateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { date, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (date) updateData.date = fromZonedTime(`${date}T12:00:00`, TIMEZONE);

    const session = await prisma.tennisSession.update({
      where: { id },
      data: updateData,
      include: {
        racket: { select: { id: true, name: true, brand: true, model: true } },
        photos: { orderBy: { order: "asc" } },
        videos: { orderBy: { createdAt: "asc" } },
        strokeRatings: { orderBy: { stroke: "asc" } },
      },
    });

    return NextResponse.json({ data: session });
  } catch (error) {
    console.error("PATCH /api/tennis/sessions/[id] error:", error);
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
    await prisma.tennisSession.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/tennis/sessions/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
