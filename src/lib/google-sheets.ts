import { auth } from "@/lib/auth";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (session?.error) {
    throw new Error("Google token expired. Please re-login.");
  }
  if (!session?.accessToken) {
    throw new Error("No access token available. Please re-login.");
  }
  return session.accessToken;
}

/** Get access token for cron endpoints without a session. Prefers the
 * DB-stored refresh token (rotated by normal logins), falls back to the
 * GOOGLE_REFRESH_TOKEN env var. */
export async function refreshAccessTokenFromEnv(): Promise<string> {
  let refreshToken: string | undefined;
  try {
    const { prisma } = await import("@/lib/prisma");
    const cred = await prisma.googleCredential.findUnique({ where: { id: "default" } });
    refreshToken = cred?.refreshToken;
  } catch (e) {
    console.error("Failed to read stored Google refresh token:", e);
  }
  refreshToken ??= process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("No stored refresh token and GOOGLE_REFRESH_TOKEN not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Failed to refresh token");
  }

  return data.access_token;
}

export interface SheetData {
  title: string;
  headers: string[];
  rows: string[][];
}

export async function createBackupSpreadsheet(
  sheets: SheetData[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();

  // 1. Create spreadsheet with sheet tabs
  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: `Dashboard Backup ${new Date().toISOString().split("T")[0]}`,
      },
      sheets: sheets.map((s) => ({
        properties: { title: s.title },
      })),
    }),
  });

  if (!createRes.ok) {
    const body = (await createRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets API error: ${createRes.status}`);
  }

  const spreadsheet = (await createRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
  };

  // 2. Batch update all sheets with data
  const data: Array<{
    range: string;
    majorDimension: string;
    values: string[][];
  }> = [];

  for (const sheet of sheets) {
    const values = [sheet.headers, ...sheet.rows];
    data.push({
      range: `'${sheet.title}'!A1`,
      majorDimension: "ROWS",
      values,
    });
  }

  const updateRes = await fetch(
    `${SHEETS_API}/${spreadsheet.spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data,
      }),
    }
  );

  if (!updateRes.ok) {
    const body = (await updateRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets API error: ${updateRes.status}`);
  }

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetUrl: spreadsheet.spreadsheetUrl,
  };
}

/** Update an existing spreadsheet: clear all tabs then write fresh data */
export async function updateBackupSpreadsheet(
  spreadsheetId: string,
  sheets: SheetData[],
  token: string
): Promise<void> {
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Get existing sheet metadata to know which tabs exist
  const metaRes = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    const body = (await metaRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets API error: ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as {
    sheets: Array<{ properties: { sheetId: number; title: string } }>;
  };
  const existingTabs = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const desiredTitles = new Set(sheets.map((s) => s.title));

  // 2. Build batch requests: add missing tabs, remove extra tabs
  const requests: Array<Record<string, unknown>> = [];

  // Add missing tabs
  for (const sheet of sheets) {
    if (!existingTabs.has(sheet.title)) {
      requests.push({ addSheet: { properties: { title: sheet.title } } });
    }
  }

  // Remove extra tabs (only if they're not in our desired set and there will be tabs left)
  for (const [title, sheetId] of existingTabs) {
    if (!desiredTitles.has(title)) {
      requests.push({ deleteSheet: { sheetId } });
    }
  }

  // Update spreadsheet title with current date
  requests.push({
    updateSpreadsheetProperties: {
      properties: { title: `Dashboard Backup ${new Date().toISOString().split("T")[0]}` },
      fields: "title",
    },
  });

  const batchRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ requests }),
  });
  if (!batchRes.ok) {
    const body = (await batchRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets tab update error: ${batchRes.status}`);
  }

  // 3. Clear all data from all sheets
  const clearRanges = sheets.map((s) => `'${s.title}'!A:ZZ`);
  const clearRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchClear`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ ranges: clearRanges }),
  });
  if (!clearRes.ok) {
    const body = (await clearRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets clear error: ${clearRes.status}`);
  }

  // 4. Write fresh data
  const data: Array<{ range: string; majorDimension: string; values: string[][] }> = [];
  for (const sheet of sheets) {
    data.push({
      range: `'${sheet.title}'!A1`,
      majorDimension: "ROWS",
      values: [sheet.headers, ...sheet.rows],
    });
  }

  const updateRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  if (!updateRes.ok) {
    const body = (await updateRes.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Sheets write error: ${updateRes.status}`);
  }
}
