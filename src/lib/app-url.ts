/** Public base URL of this dashboard, used in emails, PDFs and share links. Server only. */
export const APP_URL = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
