import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSiteSchema } from "@/lib/validations/site";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sites = await prisma.monitoredSite.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ data: sites });
  } catch (e) {
    console.error("[GET /api/sites]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const count = await prisma.monitoredSite.count();
    const site = await prisma.monitoredSite.create({
      data: { ...parsed.data, order: parsed.data.order ?? count },
    });

    return NextResponse.json({ data: site }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/sites]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
