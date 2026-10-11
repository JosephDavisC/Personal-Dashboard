import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createStringInventorySchema } from "@/lib/validations/tennis";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const strings = await prisma.stringInventory.findMany({
      orderBy: { order: "asc" },
      include: { photos: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ data: strings });
  } catch (error) {
    console.error("GET /api/tennis/strings error:", error);
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
    const parsed = createStringInventorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const string = await prisma.stringInventory.create({
      data: parsed.data,
    });

    return NextResponse.json({ data: string }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tennis/strings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
