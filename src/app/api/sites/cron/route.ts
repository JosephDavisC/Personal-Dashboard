import { NextResponse } from "next/server";
import { runSiteChecks } from "@/lib/site-ping";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  // An unset secret must never authorize a request (undefined === undefined).
  if (!process.env.SITES_CRON_SECRET || token !== process.env.SITES_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const checked = await runSiteChecks();
    return NextResponse.json({ checked, timestamp: new Date() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
