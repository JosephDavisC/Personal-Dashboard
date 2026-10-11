import { prisma } from "@/lib/prisma";
import { createLinkSchema } from "@/lib/validations/link";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const pinned = searchParams.get("pinned");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (category) where.category = category;
  if (pinned === "true") where.pinned = true;

  const links = await prisma.link.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { order: "asc" }],
  });

  return NextResponse.json({ data: links });
}

export async function POST(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const count = await prisma.link.count();
  const link = await prisma.link.create({
    data: { ...parsed.data, order: parsed.data.order ?? count },
  });

  return NextResponse.json({ data: link }, { status: 201 });
}
