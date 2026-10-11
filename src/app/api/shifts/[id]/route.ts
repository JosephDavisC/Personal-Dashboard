import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateShiftSchema } from "@/lib/validations/shift";
import { calculateHours, calculateGrossPay, calculateNetPay } from "@/lib/shift-utils";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateShiftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { startTime, endTime, date, ...rest } = parsed.data;

  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const newDate = date ? new Date(date) : existing.date;
  const newStart = startTime ? new Date(startTime) : existing.startTime;
  const newEnd = endTime ? new Date(endTime) : existing.endTime;

  // Check for duplicate (another shift with same date+startTime, excluding this one)
  if (date || startTime) {
    const conflict = await prisma.shift.findFirst({
      where: {
        date: newDate,
        startTime: newStart,
        id: { not: id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Another shift with this date and start time already exists" },
        { status: 409 }
      );
    }
  }

  const hours = calculateHours(newStart, newEnd);
  const grossPay = calculateGrossPay(hours);
  const netPay = calculateNetPay(grossPay);

  const shift = await prisma.shift.update({
    where: { id },
    data: {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
      ...(startTime ? { startTime: new Date(startTime) } : {}),
      ...(endTime ? { endTime: new Date(endTime) } : {}),
      hours,
      grossPay,
      netPay,
    },
  });

  return NextResponse.json({ data: shift });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  await prisma.shift.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
