import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { runSiteChecks } from "@/lib/site-ping";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checked = await runSiteChecks();
    return NextResponse.json({ data: { checked, timestamp: new Date() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
