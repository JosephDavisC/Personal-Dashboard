import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importJobsSchema } from "@/lib/validations/job";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    const body: unknown = await request.json();
    const parsed = importJobsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const jobs = parsed.data.jobs.map(({ dateApplied, location, ...rest }) => ({
      ...rest,
      dateApplied: new Date(dateApplied),
      location: location || null,
    }));

    const result = await prisma.jobApplication.createMany({
      data: jobs,
    });

    return NextResponse.json(
      { data: { imported: result.count } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
