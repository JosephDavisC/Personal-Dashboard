import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { linkId } = await params;
  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.slice(0, 500) : undefined;

  try {
    const link = await prisma.diaryLink.update({
      where: { id: linkId },
      data: { ...(title !== undefined ? { title } : {}) },
    });
    return NextResponse.json({ data: link });
  } catch {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { linkId } = await params;

  try {
    await prisma.diaryLink.delete({ where: { id: linkId } });
  } catch {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { deleted: true } });
}
