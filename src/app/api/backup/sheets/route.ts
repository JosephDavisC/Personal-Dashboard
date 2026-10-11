import { NextResponse } from "next/server";
import { createBackupSpreadsheet } from "@/lib/google-sheets";
import { buildBackupSheetData } from "@/lib/sheets-data";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  try {
    const sheets = await buildBackupSheetData();
    const result = await createBackupSpreadsheet(sheets);
    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
