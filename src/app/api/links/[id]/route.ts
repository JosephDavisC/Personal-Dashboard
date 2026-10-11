import { prisma } from "@/lib/prisma";
import { updateLinkSchema } from "@/lib/validations/link";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await req.json();
  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const link = await prisma.link.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ data: link });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  await prisma.link.delete({ where: { id } });
  return NextResponse.json({ data: { success: true } });
}
