import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const subscriptions = await prisma.pushSubscription.findMany({
    select: { id: true, device: true, createdAt: true, endpoint: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: subscriptions });
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.pushSubscription.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ data: { deleted: true } });
}
