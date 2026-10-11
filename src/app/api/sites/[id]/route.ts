import { prisma } from "@/lib/prisma";
import { updateSiteSchema } from "@/lib/validations/site";
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
  const parsed = updateSiteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const site = await prisma.monitoredSite.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ data: site });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  await prisma.monitoredSite.delete({ where: { id } });
  return NextResponse.json({ data: { success: true } });
}
