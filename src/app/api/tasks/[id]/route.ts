import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTaskSchema } from "@/lib/validations/task";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { dueDate, links, ...rest } = parsed.data;

  // Track status changes for diary context
  let statusFields = {};
  if (rest.status) {
    const current = await prisma.task.findUnique({ where: { id }, select: { status: true } });
    if (current && current.status !== rest.status) {
      const now = new Date();
      statusFields = {
        statusChangedAt: now,
        ...(rest.status === "DONE" ? { completedAt: now } : {}),
        // Clear completedAt if moving away from DONE
        ...(current.status === "DONE" && rest.status !== "DONE" ? { completedAt: null } : {}),
      };
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...statusFields,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      ...(links !== undefined
        ? { links: links ?? undefined }
        : {}),
    },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ data: task });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
