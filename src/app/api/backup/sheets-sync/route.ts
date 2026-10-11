import { NextResponse } from "next/server";
import { refreshAccessTokenFromEnv, updateBackupSpreadsheet } from "@/lib/google-sheets";
import { buildBackupSheetData } from "@/lib/sheets-data";
import { requireAuth } from "@/lib/auth";

/** GET: cron-triggered sync (token auth) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  // An unset secret must never authorize a request (undefined === undefined).
  if (!process.env.SHEETS_SYNC_SECRET || token !== process.env.SHEETS_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spreadsheetId = process.env.SHEETS_SYNC_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({ error: "SHEETS_SYNC_SPREADSHEET_ID not configured" }, { status: 400 });
  }

  try {
    const accessToken = await refreshAccessTokenFromEnv();
    const sheets = await buildBackupSheetData();
    await updateBackupSpreadsheet(spreadsheetId, sheets, accessToken);
    return NextResponse.json({ data: { synced: true, tabs: sheets.length, timestamp: new Date().toISOString() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Sheets sync cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: manual sync (session auth) */
export async function POST() {
  const { unauthorized, session } = await requireAuth();
  if (unauthorized) return unauthorized;

  const spreadsheetId = process.env.SHEETS_SYNC_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({ error: "SHEETS_SYNC_SPREADSHEET_ID not configured. Run setup first." }, { status: 400 });
  }

  try {
    // Use session token for manual sync (no need for env refresh token)
    const accessToken = session.accessToken;
    if (!accessToken) {
      return NextResponse.json({ error: "No access token. Please re-login." }, { status: 401 });
    }

    const sheets = await buildBackupSheetData();
    await updateBackupSpreadsheet(spreadsheetId, sheets, accessToken);
    return NextResponse.json({ data: { synced: true, tabs: sheets.length, timestamp: new Date().toISOString() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
