import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reorderTaskSchema } from "@/lib/validations/task";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json();
  const parsed = reorderTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Fetch current task data to detect status changes for diary context tracking
  const taskIds = parsed.data.tasks.map((t) => t.id);
  const currentTasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, status: true, statusChangedAt: true, createdAt: true },
  });
  const currentTaskMap = new Map(currentTasks.map((t) => [t.id, t]));

  const now = new Date();
  const UNDO_GRACE = 60_000; // 60 seconds — if status was just changed, treat as accidental drag undo

  await prisma.$transaction(
    parsed.data.tasks.map((task) => {
      const current = currentTaskMap.get(task.id);
      const statusChanged = current && current.status !== task.status;
      if (!statusChanged) {
        return prisma.task.update({
          where: { id: task.id },
          data: { status: task.status, order: task.order },
        });
      }

      // Check if this is an undo of a recent accidental drag
      const wasJustChanged = current.statusChangedAt &&
        (now.getTime() - new Date(current.statusChangedAt).getTime()) < UNDO_GRACE;

      return prisma.task.update({
        where: { id: task.id },
        data: {
          status: task.status,
          order: task.order,
          // Undo: revert statusChangedAt to createdAt (removes from today's diary)
          // Normal: set statusChangedAt to now (tracks in today's diary)
          statusChangedAt: wasJustChanged ? current.createdAt : now,
          ...(task.status === "DONE" ? { completedAt: now } : {}),
          ...(current.status === "DONE" && task.status !== "DONE" ? { completedAt: null } : {}),
          ...(wasJustChanged && task.status !== "DONE" ? { completedAt: null } : {}),
        },
      });
    })
  );

  return NextResponse.json({ data: { success: true } });
}
