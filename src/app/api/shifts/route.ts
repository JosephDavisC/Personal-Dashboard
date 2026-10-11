import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createShiftSchema } from "@/lib/validations/shift";
import { calculateHours, calculateGrossPay, calculateNetPay } from "@/lib/shift-utils";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const location = searchParams.get("location");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (location) where.location = location;

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ data: shifts });
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const body: unknown = await request.json();
  const parsed = createShiftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, startTime, endTime, location, label, notes } = parsed.data;

  // Check for duplicate (same date + startTime)
  const existing = await prisma.shift.findFirst({
    where: {
      date: new Date(date),
      startTime: new Date(startTime),
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A shift with this date and start time already exists" },
      { status: 409 }
    );
  }

  const hours = calculateHours(new Date(startTime), new Date(endTime));
  const grossPay = calculateGrossPay(hours);
  const netPay = calculateNetPay(grossPay);

  const shift = await prisma.shift.create({
    data: {
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      label,
      hours,
      grossPay,
      netPay,
      notes,
    },
  });

  return NextResponse.json({ data: shift }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params required" },
      { status: 400 }
    );
  }

  const result = await prisma.shift.deleteMany({
    where: {
      date: { gte: new Date(from), lt: new Date(to) },
    },
  });

  return NextResponse.json({ data: { deleted: result.count } });
}
