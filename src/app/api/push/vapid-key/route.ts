import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    data: { key: process.env.VAPID_PUBLIC_KEY || null },
  });
}
