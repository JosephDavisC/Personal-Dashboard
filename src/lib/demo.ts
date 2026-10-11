// Read-only demo: for hosting a public showcase of the dashboard.
// DEMO_READONLY=true implies demo mode (no sign-in) and makes the API refuse
// every change, so visitors can click through everything but save nothing.

export const READ_ONLY_HEADER = "x-read-only-demo";
export const READ_ONLY_MESSAGE = "This is a read-only demo. Changes are not saved.";

// GET endpoints that still have side effects (send email or push, write
// backups, ping sites). Everything else that only reads stays allowed.
const BLOCKED_GET_PATHS = [
  "/api/email/weekly-summary",
  "/api/push/cron",
  "/api/push/test",
  "/api/sites/cron",
  "/api/backup/cron",
  "/api/backup/sheets-sync",
];

export function isReadOnlyDemo(): boolean {
  return process.env.DEMO_READONLY === "true";
}

/** True when a read-only demo must refuse this API request. */
export function isBlockedInReadOnlyDemo(method: string, pathname: string): boolean {
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/auth")) return false;
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  return BLOCKED_GET_PATHS.includes(pathname);
}
