import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createBackupSpreadsheet } from "@/lib/google-sheets";
import { buildBackupSheetData } from "@/lib/sheets-data";

/** POST: one-time setup — creates persistent spreadsheet and returns config values */
export async function POST() {
  const { unauthorized, session } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const sheets = await buildBackupSheetData();
    const result = await createBackupSpreadsheet(sheets);

    return NextResponse.json({
      data: {
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        refreshToken: session.refreshToken ?? null,
        instructions: [
          `SHEETS_SYNC_SPREADSHEET_ID=${result.spreadsheetId}`,
          session.refreshToken ? `GOOGLE_REFRESH_TOKEN=${session.refreshToken}` : "GOOGLE_REFRESH_TOKEN: re-login to get refresh token",
          "SHEETS_SYNC_SECRET=<generate with: openssl rand -hex 16>",
          "Add crontab: */15 * * * * curl -sf \"http://localhost:3001/api/backup/sheets-sync?token=SECRET\"",
        ],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
