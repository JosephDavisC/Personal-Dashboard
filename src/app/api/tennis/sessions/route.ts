import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSessionSchema } from "@/lib/validations/tennis";
import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const racketId = searchParams.get("racketId");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (racketId) where.racketId = racketId;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = fromZonedTime(`${from}T00:00:00`, TIMEZONE);
      if (to) dateFilter.lte = fromZonedTime(`${to}T23:59:59`, TIMEZONE);
      where.date = dateFilter;
    }

    const sessions = await prisma.tennisSession.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        racket: { select: { id: true, name: true, brand: true, model: true } },
        _count: { select: { photos: true, videos: true, strokeRatings: true } },
      },
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return NextResponse.json({ data: items, nextCursor });
  } catch (error) {
    console.error("GET /api/tennis/sessions error:", error);
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
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { date, tags, ...rest } = parsed.data;
    const session = await prisma.tennisSession.create({
      data: {
        ...rest,
        date: fromZonedTime(`${date}T12:00:00`, TIMEZONE),
        tags: tags ?? [],
      },
      include: {
        racket: { select: { id: true, name: true, brand: true, model: true } },
        _count: { select: { photos: true, videos: true, strokeRatings: true } },
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tennis/sessions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
