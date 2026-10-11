import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { reorderTopicsSchema } from "@/lib/validations/important";

export async function PATCH(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = reorderTopicsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.importantTopic.update({
        where: { id },
        data: { order: index },
      })
    )
  );

  return NextResponse.json({ data: { success: true } });
}
