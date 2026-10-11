import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createJobSchema } from "@/lib/validations/job";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const company = searchParams.get("company");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (company) where.company = company;

  const jobs = await prisma.jobApplication.findMany({
    where,
    orderBy: [{ dateApplied: "desc" }, { order: "desc" }],
  });

  return NextResponse.json({ data: jobs });
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json();
  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { dateApplied, ...rest } = parsed.data;

  const job = await prisma.jobApplication.create({
    data: {
      ...rest,
      dateApplied: new Date(dateApplied),
      history: {
        create: {
          toStatus: rest.status ?? "APPLIED",
          note: "Application created",
        },
      },
    },
  });

  return NextResponse.json({ data: job }, { status: 201 });
}
