import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { reorderItemsSchema } from "@/lib/validations/important";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = reorderItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.ids.map((itemId, index) =>
      prisma.importantItem.update({
        where: { id: itemId },
        data: { order: index },
      })
    )
  );

  // Touch the topic updatedAt
  await prisma.importantTopic.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ data: { success: true } });
}
