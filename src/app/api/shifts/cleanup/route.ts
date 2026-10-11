import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  // Find all shifts, grouped by date+startTime
  const allShifts = await prisma.shift.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, date: true, startTime: true },
  });

  const seen = new Map<string, string>(); // key -> first id
  const duplicateIds: string[] = [];

  for (const shift of allShifts) {
    const key = `${shift.date.toISOString()}_${shift.startTime.toISOString()}`;
    const existing = seen.get(key);
    if (existing) {
      duplicateIds.push(shift.id);
    } else {
      seen.set(key, shift.id);
    }
  }

  if (duplicateIds.length > 0) {
    await prisma.shift.deleteMany({
      where: { id: { in: duplicateIds } },
    });
  }

  return NextResponse.json({
    data: { removed: duplicateIds.length },
  });
}
