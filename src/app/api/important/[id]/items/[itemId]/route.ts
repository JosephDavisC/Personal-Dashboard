import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateItemSchema } from "@/lib/validations/important";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id, itemId } = await params;
  const body = await req.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Verify item belongs to topic
  const existing = await prisma.importantItem.findFirst({
    where: { id: itemId, topicId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = await prisma.importantItem.update({
    where: { id: itemId },
    data: parsed.data,
  });

  // Touch the topic updatedAt
  await prisma.importantTopic.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ data: item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id, itemId } = await params;

  // Verify item belongs to topic
  const existing = await prisma.importantItem.findFirst({
    where: { id: itemId, topicId: id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.importantItem.delete({ where: { id: itemId } });

  // Touch the topic updatedAt
  await prisma.importantTopic.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ data: { id: itemId } });
}
