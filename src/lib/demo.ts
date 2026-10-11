// Read-only demo: for hosting a public showcase of the dashboard.
// DEMO_READONLY=true implies demo mode (no sign-in) and makes the API refuse
// every change, so visitors can click through everything but save nothing.

export const READ_ONLY_HEADER = "x-read-only-demo";
export const READ_ONLY_MESSAGE = "This is a read-only demo. Changes are not saved.";
export const PROJECT_REPO_URL = "https://github.com/JosephDavisC/Personal-Dashboard";

/** What the AI chat answers in the read-only demo, instead of calling Claude. */
export const DEMO_CHAT_REPLY = `This is the live demo, so the AI assistant is switched off here.

In your own copy, add an \`ANTHROPIC_API_KEY\` and the assistant can:

- answer questions about your tasks, shifts, calendar, diary and job applications
- create tasks, calendar events and diary entries for you
- give you a summary of your day or week

Get the code on [GitHub](${PROJECT_REPO_URL}) to run your own dashboard.`;

// GET endpoints that still have side effects (send email or push, write
// backups, ping sites). Everything else that only reads stays allowed.
// Backup downloads and exports are switched off in the demo. The home page's
// backup status card still reads /api/backup and /api/backup/drive/last.
const BLOCKED_GET_PREFIX = "/api/backup/";
const ALLOWED_BACKUP_GETS = ["/api/backup/drive/last"];

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
  if (pathname.startsWith(BLOCKED_GET_PREFIX) && !ALLOWED_BACKUP_GETS.includes(pathname)) return true;
  return BLOCKED_GET_PATHS.includes(pathname);
}
