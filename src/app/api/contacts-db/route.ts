import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createContactSchema } from "@/lib/validations/contact";

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const url = req.nextUrl;
  const q = url.searchParams.get("q")?.trim();
  const tag = url.searchParams.get("tag")?.trim();
  const company = url.searchParams.get("company")?.trim();

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  if (tag) {
    where.tags = { has: tag };
  }

  if (company) {
    where.company = { contains: company, mode: "insensitive" };
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: contacts });
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const contact = await prisma.contact.create({ data: parsed.data });
  return NextResponse.json({ data: contact }, { status: 201 });
}
