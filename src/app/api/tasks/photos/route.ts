import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const addPhotoSchema = z.object({
  taskId: z.string().min(1),
  url: z.string().min(1),
  caption: z.string().optional(),
  mediaId: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body: unknown = await request.json();
  const parsed = addPhotoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { taskId, url, caption, mediaId, order } = parsed.data;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const photo = await prisma.taskPhoto.create({
    data: {
      taskId,
      url,
      caption: caption ?? null,
      mediaId: mediaId ?? null,
      order: order ?? 0,
    },
  });

  return NextResponse.json({ data: photo }, { status: 201 });
}
