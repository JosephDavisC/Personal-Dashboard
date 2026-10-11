import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TIMEZONE } from "@/lib/constants";
import { fromZonedTime } from "date-fns-tz";

function parseDateParam(dateStr: string): Date {
  return fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
}

interface RouteParams {
  params: Promise<{ date: string }>;
}

/** Add a task ID to this diary entry's manualTaskIds */
export async function POST(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { date } = await params;
    const dateObj = parseDateParam(date);
    const { taskId } = (await request.json()) as { taskId?: string };

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // Verify task exists
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Upsert entry and add task ID if not already present
    const existing = await prisma.diaryEntry.findUnique({
      where: { date: dateObj },
      select: { manualTaskIds: true },
    });

    const currentIds = existing?.manualTaskIds ?? [];
    if (currentIds.includes(taskId)) {
      return NextResponse.json({ data: { added: false, message: "Task already linked" } });
    }

    const entry = await prisma.diaryEntry.upsert({
      where: { date: dateObj },
      create: { date: dateObj, manualTaskIds: [taskId] },
      update: { manualTaskIds: [...currentIds, taskId] },
    });

    return NextResponse.json({ data: { added: true, manualTaskIds: entry.manualTaskIds } });
  } catch (error) {
    console.error("POST /api/diary/[date]/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add task" },
      { status: 500 }
    );
  }
}

/** Remove a task ID from this diary entry's manualTaskIds */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const { date } = await params;
    const dateObj = parseDateParam(date);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const existing = await prisma.diaryEntry.findUnique({
      where: { date: dateObj },
      select: { manualTaskIds: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const updated = existing.manualTaskIds.filter((id) => id !== taskId);

    await prisma.diaryEntry.update({
      where: { date: dateObj },
      data: { manualTaskIds: updated },
    });

    return NextResponse.json({ data: { removed: true, manualTaskIds: updated } });
  } catch (error) {
    console.error("DELETE /api/diary/[date]/tasks error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove task" },
      { status: 500 }
    );
  }
}
