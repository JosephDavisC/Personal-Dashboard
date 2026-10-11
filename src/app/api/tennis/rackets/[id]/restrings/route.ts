import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRestringSchema } from "@/lib/validations/tennis";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const restrings = await prisma.restring.findMany({
      where: { racketId: id },
      orderBy: { date: "desc" },
      include: { photos: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ data: restrings });
  } catch (error) {
    console.error("GET restrings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = createRestringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { date, ...rest } = parsed.data;
    const isHybrid = !!rest.crossStringName;

    // Build display string for racket
    const displayString = isHybrid
      ? `${rest.stringName} / ${rest.crossStringName}`
      : rest.stringName;
    const displayTension = isHybrid && rest.crossTension
      ? `${rest.tension} / ${rest.crossTension}`
      : rest.tension;

    // Create restring and update racket in a transaction
    const [restring] = await prisma.$transaction([
      prisma.restring.create({
        data: {
          racketId: id,
          ...rest,
          date: new Date(date),
        },
        include: { photos: true },
      }),
      prisma.tennisRacket.update({
        where: { id },
        data: {
          currentString: displayString,
          tension: displayTension,
          lastStrung: new Date(date),
        },
      }),
    ]);

    // Auto-decrement string inventory for mains
    const mainsInventory = await prisma.stringInventory.findFirst({
      where: { name: { equals: rest.stringName, mode: "insensitive" } },
    });
    if (mainsInventory && mainsInventory.quantity > 0) {
      await prisma.stringInventory.update({
        where: { id: mainsInventory.id },
        data: { quantity: mainsInventory.quantity - 1 },
      });
    }

    // Auto-decrement cross string inventory if hybrid and different string
    if (isHybrid && rest.crossStringName!.toLowerCase() !== rest.stringName.toLowerCase()) {
      const crossInventory = await prisma.stringInventory.findFirst({
        where: { name: { equals: rest.crossStringName!, mode: "insensitive" } },
      });
      if (crossInventory && crossInventory.quantity > 0) {
        await prisma.stringInventory.update({
          where: { id: crossInventory.id },
          data: { quantity: crossInventory.quantity - 1 },
        });
      }
    }

    return NextResponse.json({ data: restring }, { status: 201 });
  } catch (error) {
    console.error("POST restring error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
