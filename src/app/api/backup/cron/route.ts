import { NextResponse } from "next/server";
import { createBackupSnapshot } from "../route";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  // An unset secret must never authorize a request (undefined === undefined).
  if (!process.env.BACKUP_CRON_SECRET || token !== process.env.BACKUP_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createBackupSnapshot("auto");
    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
