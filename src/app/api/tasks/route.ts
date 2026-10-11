import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTaskSchema } from "@/lib/validations/task";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: { photos: { orderBy: { order: "asc" }, take: 4 } },
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { dueDate, links, ...rest } = parsed.data;

  const now = new Date();
  const task = await prisma.task.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
      ...(links ? { links } : {}),
      statusChangedAt: now,
      ...(rest.status === "DONE" ? { completedAt: now } : {}),
    },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}
