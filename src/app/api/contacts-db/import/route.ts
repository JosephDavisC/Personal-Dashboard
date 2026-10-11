import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const importSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().min(1),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      company: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).default([]),
    })
  ),
});

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { contacts } = parsed.data;

  // Deduplicate by name+email against existing contacts
  const existing = await prisma.contact.findMany({
    select: { name: true, email: true },
  });
  const existingSet = new Set(
    existing.map((c) => `${c.name.toLowerCase()}|${(c.email ?? "").toLowerCase()}`)
  );

  const toCreate = contacts.filter(
    (c) => !existingSet.has(`${c.name.toLowerCase()}|${(c.email ?? "").toLowerCase()}`)
  );

  if (toCreate.length === 0) {
    return NextResponse.json({
      data: { imported: 0, skipped: contacts.length },
    });
  }

  await prisma.contact.createMany({
    data: toCreate.map((c) => ({
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      company: c.company ?? null,
      title: c.title ?? null,
      notes: c.notes ?? null,
      tags: c.tags,
    })),
  });

  return NextResponse.json({
    data: { imported: toCreate.length, skipped: contacts.length - toCreate.length },
  });
}
