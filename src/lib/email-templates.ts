import { SITE } from "@/config/site";
import { APP_URL } from "@/lib/app-url";
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface MediaShareEmailData {
  senderMessage?: string;
  mediaType: "image" | "video" | "document" | "file";
  fileName: string;
  fileSize?: string;
  thumbnailUrl?: string;
  shareUrl: string;
  hasPassword?: boolean;
  sharePassword?: string;
  expiresAt?: string | null;
}

export function buildMediaShareEmail(data: MediaShareEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const typeLabel =
    data.mediaType === "image"
      ? "an image"
      : data.mediaType === "video"
        ? "a video"
        : data.mediaType === "document"
          ? "a document"
          : "a file";

  const typeButton =
    data.mediaType === "image"
      ? "Image"
      : data.mediaType === "video"
        ? "Video"
        : data.mediaType === "document"
          ? "Document"
          : "File";

  const subject = `${SITE.ownerName} shared ${typeLabel} with you`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-card { background-color: #262626 !important; border-color: #404040 !important; }
      .email-title { color: #ffffff !important; }
      .email-subtitle { color: #e0e0e0 !important; }
      .email-msg-box { background-color: #1a1a1a !important; border-color: #525252 !important; }
      .email-msg-label { color: #d4d4d4 !important; }
      .email-msg-text { color: #e5e5e5 !important; }
      .email-btn { background: #3b82f6 !important; color: #ffffff !important; }
      .email-pw-box { background-color: #1a1a1a !important; border-color: #404040 !important; }
      .email-pw-label { color: #d4d4d4 !important; }
      .email-pw-value { color: #f5f5f5 !important; background-color: #333333 !important; border-color: #525252 !important; }
      .email-expires { color: #a3a3a3 !important; }
      .email-footer { background-color: #1f1f1f !important; border-color: #404040 !important; }
      .email-footer-link { color: #60a5fa !important; }
      .email-footer-text { color: #a3a3a3 !important; }
      .email-footer-sub { color: #737373 !important; }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-body" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header with Logo -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff; border-radius: 12px 12px 0 0; padding: 40px 32px 32px 32px; text-align: center;">
              <img src="${APP_URL}/logo.png" alt="Logo" width="64" height="64" style="width: 64px; height: 64px; border-radius: 12px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #ffffff; font-size: 18px; font-weight: 600; text-align: center; letter-spacing: 0.3px;">${SITE.ownerName}</td></tr></table>
            </td>
          </tr>

          <!-- Card Body -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
              <h1 class="email-title" style="color: #18181b; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">
                ${SITE.ownerName} shared ${typeLabel} with you
              </h1>
              <p class="email-subtitle" style="color: #71717a; font-size: 14px; margin: 0 0 24px 0;">
                ${escapeHtml(data.fileName)}${data.fileSize ? ` &middot; ${escapeHtml(data.fileSize)}` : ""}
              </p>

              ${
                data.senderMessage
                  ? `<!-- Message -->
              <div class="email-msg-box" style="background-color: #f4f4f5; border-left: 3px solid #1e293b; border-radius: 0 6px 6px 0; padding: 12px 16px; margin-bottom: 24px;">
                <p class="email-msg-label" style="color: #71717a; font-size: 11px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Message from ${SITE.ownerName}</p>
                <p class="email-msg-text" style="color: #27272a; font-size: 14px; margin: 0; line-height: 1.6;">${escapeHtml(data.senderMessage)}</p>
              </div>`
                  : ""
              }

              ${
                data.thumbnailUrl
                  ? `<!-- Thumbnail -->
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="${escapeHtml(data.thumbnailUrl)}" alt="${escapeHtml(data.fileName)}" style="max-width: 100%; max-height: 280px; border-radius: 8px; border: 1px solid #e4e4e7;" />
              </div>`
                  : ""
              }

              <!-- View Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${escapeHtml(data.shareUrl)}" target="_blank" class="email-btn" style="display: inline-block; background: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                  View ${typeButton}
                </a>
              </div>

              ${
                data.hasPassword && data.sharePassword
                  ? `<!-- Password -->
              <div class="email-pw-box" style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p class="email-pw-label" style="color: #71717a; font-size: 12px; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Password</p>
                <p class="email-pw-value" style="display: inline-block; color: #18181b; font-size: 16px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; font-weight: 600; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; padding: 8px 20px; margin: 0; letter-spacing: 1px;">${escapeHtml(data.sharePassword)}</p>
              </div>`
                  : data.hasPassword
                    ? `<!-- Password Notice -->
              <div class="email-pw-box" style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p class="email-pw-label" style="color: #71717a; font-size: 13px; margin: 0; font-weight: 500;">This file is password protected. Ask the sender for the password.</p>
              </div>`
                    : ""
              }

              ${
                data.expiresAt
                  ? `<p class="email-expires" style="color: #a1a1aa; font-size: 12px; text-align: center; margin: 0 0 24px 0;">This link expires on ${escapeHtml(data.expiresAt)}</p>`
                  : ""
              }

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center;">
              <p class="email-footer-text" style="color: #a1a1aa; font-size: 12px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0 0 4px 0;">
                Sent from <a href="${APP_URL}" class="email-footer-link" style="color: #1e293b; text-decoration: none;">${SITE.appName}</a>
              </p>
              <p class="email-footer-sub" style="color: #d4d4d8; font-size: 11px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${SITE.ownerName} shared ${typeLabel} with you: ${data.fileName}`,
    data.senderMessage ? `\nMessage: ${data.senderMessage}` : "",
    `\nView it here: ${data.shareUrl}`,
    data.hasPassword && data.sharePassword
      ? `\nPassword: ${data.sharePassword}`
      : data.hasPassword
        ? `\nThis file is password protected. Ask the sender for the password.`
        : "",
    data.expiresAt ? `\nLink expires: ${data.expiresAt}` : "",
    `\n\nSent from ${SITE.appName}`,
  ]
    .filter(Boolean)
    .join("");

  return { subject, html, text };
}

// ============ WEEKLY SUMMARY EMAIL ============

export interface WeeklySummaryData {
  weekLabel: string;
  shifts: {
    count: number;
    hours: number;
    netPay: number;
    byLocation: { location: string; count: number; hours: number; netPay: number }[];
    prevHours: number;
    prevNetPay: number;
  };
  tasks: {
    completed: number;
    completedTitles: string[];
    created: number;
    inProgress: number;
    overdue: number;
    prevCompleted: number;
  };
  applications: {
    applied: number;
    prevApplied: number;
    interviews: number;
    offers: number;
    rejected: number;
    total: number;
    responseRate: number;
  };
  calendar: {
    eventCount: number;
    busiestDay: { day: string; count: number } | null;
    upcoming: { summary: string; date: string }[];
  };
  diary: {
    entries: number;
    moodBreakdown: Record<string, number>;
    streak: number;
    photos: number;
  };
  photos: { url: string; link: string }[];
  infrastructure: {
    siteCount: number;
    uptimePct: number;
    incidents: number;
  };
  media: {
    uploaded: number;
    totalStorageBytes: number;
    byType: { images: number; videos: number; documents: number };
  };
}

// ---- Styled indicator helpers (no emojis) ----

/** Colored circle indicator for section headers */
function dot(color: string): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>`;
}

/** Comparison badge: green up, red down, gray same */
function comparison(current: number, previous: number, unit = "", prefix = ""): string {
  const diff = current - previous;
  if (diff === 0 || (previous === 0 && current === 0)) return "";
  const isUp = diff > 0;
  const arrow = isUp ? "&#9650;" : "&#9660;"; // ▲ ▼
  const color = isUp ? "#22c55e" : "#ef4444";
  const sign = isUp ? "+" : "";
  const val = `${sign}${prefix}${Math.abs(diff).toFixed(unit === "h" ? 1 : 0)}${unit}`;
  return `<span style="color:${color};font-size:12px;font-weight:600;margin-left:6px;">${arrow} ${val}</span>`;
}

/** Section header with colored dot and title */
function sectionHeader(color: string, title: string): string {
  return `<tr><td style="padding:20px 0 8px 0;">
    <p class="email-section-head" style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">
      ${dot(color)}${escapeHtml(title)}
    </p>
  </td></tr>`;
}

/** Single detail row */
function detailRow(label: string, value: string, extra = ""): string {
  return `<tr><td class="email-row-border" style="padding:6px 0;border-bottom:1px solid #f0f0f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="email-title" style="color:#18181b;font-size:14px;font-weight:500;">${escapeHtml(label)}</td>
      <td class="email-subtitle" style="color:#52525b;font-size:14px;text-align:right;white-space:nowrap;">${value}${extra}</td>
    </tr></table>
  </td></tr>`;
}

/** Stat card for header grid */
function statCard(value: string, label: string): string {
  return `<td class="email-stat-box" style="background-color:#f4f4f5;border-radius:8px;padding:14px 8px;text-align:center;">
    <p class="email-stat-value" style="color:#18181b;font-size:26px;font-weight:700;margin:0;">${value}</p>
    <p class="email-stat-label" style="color:#71717a;font-size:10px;margin:4px 0 0 0;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</p>
  </td>`;
}

/** Bulleted list item */
function listItem(text: string): string {
  return `<tr><td class="email-list-item" style="padding:3px 0 3px 12px;color:#52525b;font-size:13px;">
    <span style="color:#a1a1aa;margin-right:6px;">&#8226;</span>${escapeHtml(text)}
  </td></tr>`;
}

export function buildWeeklySummaryEmail(data: WeeklySummaryData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Week in Review — ${data.weekLabel}`;

  // Build sections conditionally (skip empty)
  const sections: string[] = [];

  // ---- WORK & PAY ----
  if (data.shifts.count > 0) {
    const rows: string[] = [sectionHeader("#3b82f6", "Work & Pay")];
    rows.push(detailRow("Shifts worked", String(data.shifts.count)));
    rows.push(detailRow("Hours", `${data.shifts.hours.toFixed(1)}h`, comparison(data.shifts.hours, data.shifts.prevHours, "h")));
    rows.push(detailRow("Net pay", `$${data.shifts.netPay.toFixed(2)}`, comparison(data.shifts.netPay, data.shifts.prevNetPay, "", "$")));
    for (const loc of data.shifts.byLocation) {
      rows.push(detailRow(`  ${loc.location}`, `${loc.count} shift${loc.count !== 1 ? "s" : ""}, ${loc.hours.toFixed(1)}h, $${loc.netPay.toFixed(2)}`));
    }
    sections.push(rows.join(""));
  }

  // ---- TASKS ----
  if (data.tasks.completed > 0 || data.tasks.created > 0 || data.tasks.inProgress > 0) {
    const rows: string[] = [sectionHeader("#22c55e", "Tasks")];
    rows.push(detailRow("Completed", String(data.tasks.completed), comparison(data.tasks.completed, data.tasks.prevCompleted)));
    if (data.tasks.completedTitles.length > 0) {
      for (const title of data.tasks.completedTitles.slice(0, 10)) {
        rows.push(listItem(title));
      }
      if (data.tasks.completedTitles.length > 10) {
        rows.push(listItem(`...and ${data.tasks.completedTitles.length - 10} more`));
      }
    }
    if (data.tasks.created > 0) rows.push(detailRow("Created", String(data.tasks.created)));
    if (data.tasks.inProgress > 0) rows.push(detailRow("In progress", String(data.tasks.inProgress)));
    if (data.tasks.overdue > 0) rows.push(detailRow("Overdue", `<span style="color:#ef4444;font-weight:600;">${data.tasks.overdue}</span>`));
    sections.push(rows.join(""));
  }

  // ---- JOB APPLICATIONS ----
  if (data.applications.applied > 0 || data.applications.interviews > 0 || data.applications.offers > 0) {
    const rows: string[] = [sectionHeader("#a855f7", "Job Applications")];
    rows.push(detailRow("Applied this week", String(data.applications.applied), comparison(data.applications.applied, data.applications.prevApplied)));
    if (data.applications.interviews > 0) rows.push(detailRow("Interview updates", String(data.applications.interviews)));
    if (data.applications.offers > 0) rows.push(detailRow("Offers", `<span style="color:#22c55e;font-weight:600;">${data.applications.offers}</span>`));
    if (data.applications.rejected > 0) rows.push(detailRow("Rejected", String(data.applications.rejected)));
    rows.push(detailRow("Total applications", String(data.applications.total)));
    rows.push(detailRow("Response rate", `${data.applications.responseRate}%`));
    sections.push(rows.join(""));
  }

  // ---- CALENDAR ----
  if (data.calendar.eventCount > 0) {
    const rows: string[] = [sectionHeader("#f59e0b", "Calendar")];
    rows.push(detailRow("Events this week", String(data.calendar.eventCount)));
    if (data.calendar.busiestDay) {
      rows.push(detailRow("Busiest day", `${data.calendar.busiestDay.day} (${data.calendar.busiestDay.count} events)`));
    }
    if (data.calendar.upcoming.length > 0) {
      rows.push(`<tr><td class="email-section-head" style="padding:8px 0 4px 0;color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Coming up next week</td></tr>`);
      for (const ev of data.calendar.upcoming) {
        rows.push(listItem(`${ev.summary} — ${ev.date}`));
      }
    }
    sections.push(rows.join(""));
  }

  // ---- DIARY ----
  if (data.diary.entries > 0) {
    const rows: string[] = [sectionHeader("#ec4899", "Diary")];
    rows.push(detailRow("Days journaled", `${data.diary.entries}/7`));
    if (data.diary.streak > 1) rows.push(detailRow("Current streak", `${data.diary.streak} days`));
    if (Object.keys(data.diary.moodBreakdown).length > 0) {
      const moodLine = Object.entries(data.diary.moodBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([mood, count]) => `${mood} x${count}`)
        .join(", ");
      rows.push(detailRow("Moods", moodLine));
    }
    if (data.diary.photos > 0) rows.push(detailRow("Photos added", String(data.diary.photos)));
    sections.push(rows.join(""));
  }

  // ---- THIS WEEK IN PHOTOS ----
  if (data.photos.length > 0) {
    const photoRows: string[] = [];
    photoRows.push(`<tr><td style="padding:24px 0 8px;">
      <p class="email-section-head" style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">
        ${dot("#f472b6")}This Week in Photos
      </p>
    </td></tr>`);

    // Build 2x2 grid (or 1 row if <=2 photos)
    photoRows.push(`<tr><td><table width="100%" cellpadding="4" cellspacing="0">`);
    for (let i = 0; i < data.photos.length; i += 2) {
      const p1 = data.photos[i]!;
      const p2 = data.photos[i + 1];
      photoRows.push(`<tr>`);
      photoRows.push(`<td width="50%"><a href="${escapeHtml(p1.link)}" style="text-decoration:none;"><img src="${escapeHtml(p1.url)}" width="100%" style="border-radius:8px;display:block;max-height:200px;object-fit:cover;" /></a></td>`);
      if (p2) {
        photoRows.push(`<td width="50%"><a href="${escapeHtml(p2.link)}" style="text-decoration:none;"><img src="${escapeHtml(p2.url)}" width="100%" style="border-radius:8px;display:block;max-height:200px;object-fit:cover;" /></a></td>`);
      } else {
        photoRows.push(`<td width="50%"></td>`);
      }
      photoRows.push(`</tr>`);
    }
    photoRows.push(`</table></td></tr>`);

    // View Gallery button
    photoRows.push(`<tr><td style="text-align:center;padding:16px 0 0;">
      <a href="${APP_URL}/dashboard/diary" class="email-gallery-btn" style="display:inline-block;background:#27272a;color:#fff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">View Gallery</a>
    </td></tr>`);

    sections.push(photoRows.join(""));
  }

  // ---- INFRASTRUCTURE ----
  if (data.infrastructure.siteCount > 0) {
    const rows: string[] = [sectionHeader("#06b6d4", "Infrastructure")];
    rows.push(detailRow("Uptime", `${data.infrastructure.uptimePct.toFixed(1)}% across ${data.infrastructure.siteCount} sites`));
    if (data.infrastructure.incidents > 0) {
      rows.push(detailRow("Incidents", `<span style="color:#ef4444;font-weight:600;">${data.infrastructure.incidents}</span>`));
    }
    sections.push(rows.join(""));
  }

  // ---- MEDIA ----
  if (data.media.uploaded > 0) {
    const rows: string[] = [sectionHeader("#f97316", "Media")];
    rows.push(detailRow("Files uploaded", String(data.media.uploaded)));
    const parts: string[] = [];
    if (data.media.byType.images > 0) parts.push(`${data.media.byType.images} image${data.media.byType.images !== 1 ? "s" : ""}`);
    if (data.media.byType.videos > 0) parts.push(`${data.media.byType.videos} video${data.media.byType.videos !== 1 ? "s" : ""}`);
    if (data.media.byType.documents > 0) parts.push(`${data.media.byType.documents} doc${data.media.byType.documents !== 1 ? "s" : ""}`);
    if (parts.length > 0) rows.push(detailRow("Breakdown", parts.join(", ")));
    rows.push(detailRow("Total storage", formatSize(data.media.totalStorageBytes)));
    sections.push(rows.join(""));
  }

  const darkStyles = `
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #0a0a0a !important; }
      .email-card { background-color: #1a1a1a !important; border-color: #333 !important; }
      .email-title { color: #f0f0f0 !important; }
      .email-subtitle { color: #e0e0e0 !important; }
      .email-stat-box { background-color: #262626 !important; }
      .email-stat-label { color: #d4d4d4 !important; }
      .email-stat-value { color: #ffffff !important; }
      .email-section-head { color: #d4d4d4 !important; }
      .email-list-item { color: #d4d4d4 !important; }
      .email-row-border { border-color: #333 !important; }
      .email-btn { background: #3b82f6 !important; color: #ffffff !important; }
      .email-footer { background-color: #141414 !important; border-color: #333 !important; }
      .email-footer-link { color: #60a5fa !important; }
      .email-footer-text { color: #a3a3a3 !important; }
      .email-footer-sub { color: #737373 !important; }
      .email-signoff { color: #d4d4d4 !important; }
      .email-gallery-btn { background: #333 !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-outer-table { padding: 12px 4px !important; }
      .email-inner-table { width: 100% !important; }
      .email-card { padding-left: 12px !important; padding-right: 12px !important; }
      .email-header { padding: 28px 16px 24px 16px !important; }
      .email-stat-value { font-size: 18px !important; }
      .email-stat-label { font-size: 8px !important; }
      .email-stat-box { padding: 10px 4px !important; }
      .email-stats-row { padding: 16px 12px 0 12px !important; }
    }`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>${darkStyles}</style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-body email-outer-table" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" class="email-inner-table" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td class="email-header" bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff; border-radius: 12px 12px 0 0; padding: 40px 32px 32px 32px; text-align: center;">
              <img src="${APP_URL}/logo.png" alt="Logo" width="64" height="64" style="width: 64px; height: 64px; border-radius: 12px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #ffffff; font-size: 20px; font-weight: 700; text-align: center; letter-spacing: 0.3px;">Your Week in Review</td></tr></table>
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #cbd5e1; font-size: 14px; text-align: center; padding-top: 6px;">${escapeHtml(data.weekLabel)}</td></tr></table>
            </td>
          </tr>

          <!-- Stats Row -->
          <tr>
            <td class="email-card email-stats-row" style="background-color: #ffffff; padding: 24px 32px 0 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${statCard(`$${data.shifts.netPay.toFixed(0)}`, "Earned")}
                  <td width="6"></td>
                  ${statCard(`${data.shifts.hours.toFixed(1)}h`, "Worked")}
                  <td width="6"></td>
                  ${statCard(String(data.tasks.completed), "Tasks Done")}
                  <td width="6"></td>
                  ${statCard(`${data.diary.entries}/7`, "Journaled")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sections -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; padding: 8px 32px 32px 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${sections.join("")}
              </table>
            </td>
          </tr>

          <!-- CTA + Sign-off -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; padding: 0 32px 32px 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7; text-align: center;">
              <p class="email-signoff" style="color: #52525b; font-size: 15px; margin: 0 0 20px 0; font-weight: 500;">Have a great week!</p>
              <a href="${APP_URL}/dashboard" target="_blank" class="email-btn" style="display: inline-block; background: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                Open Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center;">
              <p class="email-footer-text" style="color: #a1a1aa; font-size: 12px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0 0 4px 0;">
                <a href="${APP_URL}" class="email-footer-link" style="color: #1e293b; text-decoration: none;">${SITE.appName}</a>
              </p>
              <p class="email-footer-sub" style="color: #d4d4d8; font-size: 11px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0;">
                Weekly summary for ${escapeHtml(data.weekLabel)}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---- Plain text fallback ----
  const lines: string[] = [`Your Week in Review — ${data.weekLabel}`, ""];

  if (data.shifts.count > 0) {
    lines.push("WORK & PAY");
    lines.push(`  Shifts: ${data.shifts.count}, ${data.shifts.hours.toFixed(1)}h, $${data.shifts.netPay.toFixed(2)}`);
    for (const loc of data.shifts.byLocation) {
      lines.push(`    ${loc.location}: ${loc.count} shifts, ${loc.hours.toFixed(1)}h, $${loc.netPay.toFixed(2)}`);
    }
    lines.push("");
  }

  if (data.tasks.completed > 0 || data.tasks.created > 0) {
    lines.push("TASKS");
    lines.push(`  Completed: ${data.tasks.completed}`);
    for (const t of data.tasks.completedTitles.slice(0, 10)) lines.push(`    - ${t}`);
    if (data.tasks.created > 0) lines.push(`  Created: ${data.tasks.created}`);
    if (data.tasks.overdue > 0) lines.push(`  Overdue: ${data.tasks.overdue}`);
    lines.push("");
  }

  if (data.applications.applied > 0) {
    lines.push("JOB APPLICATIONS");
    lines.push(`  Applied: ${data.applications.applied}, Total: ${data.applications.total}, Response rate: ${data.applications.responseRate}%`);
    lines.push("");
  }

  if (data.calendar.eventCount > 0) {
    lines.push("CALENDAR");
    lines.push(`  Events: ${data.calendar.eventCount}`);
    if (data.calendar.busiestDay) lines.push(`  Busiest: ${data.calendar.busiestDay.day} (${data.calendar.busiestDay.count})`);
    lines.push("");
  }

  if (data.diary.entries > 0) {
    lines.push("DIARY");
    lines.push(`  Journaled: ${data.diary.entries}/7, Photos: ${data.diary.photos}`);
    lines.push("");
  }

  lines.push("Have a great week!");
  lines.push(`${APP_URL}/dashboard`);

  return { subject, html, text: lines.join("\n") };
}

// ============ BACKUP COMPLETE EMAIL ============

interface BackupCompleteEmailData {
  uploaded: number;
  skipped: number;
  totalBytes: number;
  snapshotSize: number;
  folderLink: string;
  timestamp: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildBackupCompleteEmail(data: BackupCompleteEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Dashboard backup complete — ${data.uploaded} files`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-card { background-color: #262626 !important; border-color: #404040 !important; }
      .email-title { color: #ffffff !important; }
      .email-subtitle { color: #e0e0e0 !important; }
      .email-stat-box { background-color: #1a1a1a !important; border-color: #404040 !important; }
      .email-stat-label { color: #d4d4d4 !important; }
      .email-stat-value { color: #ffffff !important; }
      .email-btn { background: #3b82f6 !important; color: #ffffff !important; }
      .email-footer { background-color: #1f1f1f !important; border-color: #404040 !important; }
      .email-footer-link { color: #60a5fa !important; }
      .email-footer-text { color: #a3a3a3 !important; }
      .email-footer-sub { color: #737373 !important; }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="email-body" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; color: #ffffff; border-radius: 12px 12px 0 0; padding: 40px 32px 32px 32px; text-align: center;">
              <img src="${APP_URL}/logo.png" alt="Logo" width="64" height="64" style="width: 64px; height: 64px; border-radius: 12px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
              <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color: #ffffff; font-size: 18px; font-weight: 600; text-align: center; letter-spacing: 0.3px;">Dashboard Backup</td></tr></table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
              <h1 class="email-title" style="color: #18181b; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">
                Backup saved to Google Drive
              </h1>
              <p class="email-subtitle" style="color: #71717a; font-size: 14px; margin: 0 0 24px 0;">
                ${escapeHtml(data.timestamp)}
              </p>

              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="33%" class="email-stat-box" style="background-color: #f4f4f5; border-radius: 8px; padding: 12px 16px; text-align: center;">
                    <p class="email-stat-value" style="color: #18181b; font-size: 22px; font-weight: 700; margin: 0;">${data.uploaded}</p>
                    <p class="email-stat-label" style="color: #71717a; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Files</p>
                  </td>
                  <td width="4%"></td>
                  <td width="29%" class="email-stat-box" style="background-color: #f4f4f5; border-radius: 8px; padding: 12px 16px; text-align: center;">
                    <p class="email-stat-value" style="color: #18181b; font-size: 22px; font-weight: 700; margin: 0;">${formatSize(data.totalBytes)}</p>
                    <p class="email-stat-label" style="color: #71717a; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Media</p>
                  </td>
                  <td width="4%"></td>
                  <td width="30%" class="email-stat-box" style="background-color: #f4f4f5; border-radius: 8px; padding: 12px 16px; text-align: center;">
                    <p class="email-stat-value" style="color: #18181b; font-size: 22px; font-weight: 700; margin: 0;">${formatSize(data.snapshotSize)}</p>
                    <p class="email-stat-label" style="color: #71717a; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Snapshot</p>
                  </td>
                </tr>
              </table>

              ${data.skipped > 0 ? `<p class="email-subtitle" style="color: #71717a; font-size: 13px; text-align: center; margin: 0 0 24px 0;">${data.skipped} file(s) skipped (not on disk)</p>` : ""}

              <div style="text-align: center;">
                <a href="${escapeHtml(data.folderLink)}" target="_blank" class="email-btn" style="display: inline-block; background: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                  Open in Google Drive
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 32px; text-align: center;">
              <p class="email-footer-text" style="color: #a1a1aa; font-size: 12px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0 0 4px 0;">
                Sent from <a href="${APP_URL}" class="email-footer-link" style="color: #1e293b; text-decoration: none;">${SITE.appName}</a>
              </p>
              <p class="email-footer-sub" style="color: #d4d4d8; font-size: 11px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; margin: 0;">
                Automated backup notification
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Dashboard backup complete`,
    `Date: ${data.timestamp}`,
    `Files uploaded: ${data.uploaded}`,
    `Media size: ${formatSize(data.totalBytes)}`,
    `Snapshot size: ${formatSize(data.snapshotSize)}`,
    data.skipped > 0 ? `Skipped: ${data.skipped}` : "",
    `\nView in Drive: ${data.folderLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
