import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRacketSchema } from "@/lib/validations/tennis";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const rackets = await prisma.tennisRacket.findMany({
      orderBy: { order: "asc" },
      include: {
        photos: { orderBy: { order: "asc" }, take: 6 },
        restrings: { orderBy: { date: "desc" }, take: 5 },
        _count: { select: { sessions: true, restrings: true } },
      },
    });

    const data = rackets.map((r) => ({
      ...r,
      daysSinceStrung: r.lastStrung
        ? Math.floor((Date.now() - r.lastStrung.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/tennis/rackets error:", error);
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
    const parsed = createRacketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { lastStrung, ...rest } = parsed.data;
    const racket = await prisma.tennisRacket.create({
      data: {
        ...rest,
        lastStrung: lastStrung ? new Date(lastStrung) : null,
      },
      include: {
        photos: { orderBy: { order: "asc" } },
        _count: { select: { sessions: true, restrings: true } },
      },
    });

    return NextResponse.json({ data: racket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tennis/rackets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
