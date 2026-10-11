import { prisma } from "@/lib/prisma";
import { reorderSitesSchema } from "@/lib/validations/site";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = reorderSitesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.monitoredSite.update({ where: { id }, data: { order: index } })
    )
  );

  return NextResponse.json({ data: { success: true } });
}
