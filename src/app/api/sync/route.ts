import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSyncVersion } from "@/lib/sync";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ v: getSyncVersion() });
}
