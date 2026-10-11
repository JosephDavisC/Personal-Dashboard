import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";
import { SHIFT_LOCATIONS, shiftLocationLabel } from "@/config/shifts";
import { SITE } from "@/config/site";
import { APP_URL } from "@/lib/app-url";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    DONE: "Done",
    ARCHIVED: "Archived",
  };
  return map[status] ?? status;
}

function priorityDot(priority: string): string {
  const colors: Record<string, string> = {
    URGENT: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#16a34a",
  };
  const c = colors[priority] ?? "#94a3b8";
  return `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${c};display:inline-block"></span>${priority.charAt(0)}${priority.slice(1).toLowerCase()}</span>`;
}

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const [tasks, shifts, links, jobs, media, sites, loginLogs, diary, emailLogs, notificationLogs, contacts, importantTopics, tennisRackets, tennisSessions, stringInventory, tennisStages, tennisRatings] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: "desc" }, include: { photos: true } }),
    prisma.shift.findMany({ orderBy: { date: "desc" } }),
    prisma.link.findMany({ orderBy: { order: "asc" } }),
    prisma.jobApplication.findMany({ orderBy: { dateApplied: "desc" } }),
    prisma.mediaFile.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.monitoredSite.findMany({ orderBy: { order: "asc" } }),
    prisma.loginLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.diaryEntry.findMany({ orderBy: { date: "desc" }, include: { photos: true, links: true } }),
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.notificationLog.findMany({ orderBy: { sentAt: "desc" } }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
    prisma.importantTopic.findMany({ orderBy: { order: "asc" }, include: { items: true } }),
    prisma.tennisRacket.findMany({ orderBy: { createdAt: "desc" }, include: { restrings: true } }),
    prisma.tennisSession.findMany({ orderBy: { date: "desc" }, include: { racket: true } }),
    prisma.stringInventory.findMany({ orderBy: { createdAt: "desc" }, include: { photos: true } }),
    prisma.tennisStage.findMany({ orderBy: { stageNumber: "asc" } }),
    prisma.tennisRating.findMany({ orderBy: { date: "desc" }, take: 50, include: { stage: { select: { stageNumber: true, stageLabel: true } } } }),
  ]);

  const now = formatInTimeZone(new Date(), TIMEZONE, "MMMM d, yyyy");
  const time = formatInTimeZone(new Date(), TIMEZONE, "h:mm a");

  const totalHours = shifts.reduce((s, x) => s + x.hours, 0);
  const grossPay = shifts.reduce((s, x) => s + x.grossPay, 0);
  const netPay = shifts.reduce((s, x) => s + x.netPay, 0);
  const locationCounts = SHIFT_LOCATIONS.map((l) => ({
    short: l.short,
    count: shifts.filter((s) => s.location === l.key).length,
  })).filter((l) => l.count > 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dashboard Report</title>
<style>
  @page { margin: 0.9in 0.8in; size: landscape; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.55;
    padding: 24px 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 15px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.3px;
  }
  .header .meta {
    font-size: 9.5px;
    color: #666;
  }

  .divider {
    border: none;
    border-top: 1px solid #d0d0d0;
    margin: 24px 0;
  }

  /* ── Summary ── */
  .summary {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
    padding: 20px 24px;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
  }
  .summary-item {
    min-width: 0;
  }
  .summary-label {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 500;
  }
  .summary-value {
    font-size: 18px;
    font-weight: 700;
    color: #111;
    margin-top: 3px;
    letter-spacing: -0.3px;
  }
  .summary-sub {
    font-size: 9px;
    color: #999;
    margin-top: 2px;
  }

  /* ── Sections ── */
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #111;
    margin-bottom: 12px;
    letter-spacing: -0.2px;
  }
  .section-title span {
    font-weight: 400;
    color: #999;
    margin-left: 6px;
  }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
    margin-bottom: 28px;
  }
  thead th {
    color: #888;
    padding: 0 12px 8px;
    text-align: left;
    font-weight: 500;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1.5px solid #ccc;
  }
  tbody td {
    padding: 9px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
    color: #333;
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
  th.r, td.r {
    text-align: right;
  }
  td.dim {
    color: #999;
  }
  td.bold {
    font-weight: 600;
    color: #111;
  }
  td.mono {
    font-variant-numeric: tabular-nums;
  }
  td.ellipsis {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loc {
    display: inline-block;
    padding: 1.5px 7px;
    border-radius: 3px;
    font-size: 8.5px;
    font-weight: 600;
  }
  .loc-0 { background: #e8f0fe; color: #1a56db; }
  .loc-1 { background: #f0e6fe; color: #7c3aed; }
  .loc-2 { background: #d1fae5; color: #059669; }
  .dash { color: #ccc; }

  .totals td {
    border-top: 1.5px solid #ccc;
    border-bottom: none;
    font-weight: 700;
    color: #111;
    padding-top: 10px;
  }

  /* ── Links ── */
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 9.5px;
    margin-bottom: 28px;
  }
  .links a {
    color: #333;
    text-decoration: none;
  }
  .links .label {
    font-weight: 600;
  }
  .links .url {
    color: #999;
    margin-left: 4px;
  }

  .footer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    font-size: 8.5px;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }

  .page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="header">
  <h1>${SITE.appName}</h1>
  <div class="meta">${esc(now)} &middot; ${esc(time)}</div>
</div>

<div class="summary">
  <div class="summary-item">
    <div class="summary-label">Tasks</div>
    <div class="summary-value">${tasks.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Shifts</div>
    <div class="summary-value">${shifts.length}</div>
    <div class="summary-sub">${locationCounts.map((l) => `${l.count} ${l.short}`).join(" &middot; ")}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Hours</div>
    <div class="summary-value">${totalHours.toFixed(1)}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Net Pay</div>
    <div class="summary-value">$${netPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
    <div class="summary-sub">$${grossPay.toLocaleString("en-US", { minimumFractionDigits: 2 })} gross</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Applications</div>
    <div class="summary-value">${jobs.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Media</div>
    <div class="summary-value">${media.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Sites</div>
    <div class="summary-value">${sites.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Diary</div>
    <div class="summary-value">${diary.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Contacts</div>
    <div class="summary-value">${contacts.length}</div>
    <div class="summary-sub">${contacts.filter((c) => c.email).length} with email, ${contacts.filter((c) => c.photoUrl).length} with photo</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Emails</div>
    <div class="summary-value">${emailLogs.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Notifications</div>
    <div class="summary-value">${notificationLogs.length}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Topics</div>
    <div class="summary-value">${importantTopics.length}</div>
    <div class="summary-sub">${importantTopics.reduce((s, t) => s + t.items.length, 0)} items</div>
  </div>
</div>

<div class="section-title">Tasks <span>${tasks.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Status</th>
      <th>Priority</th>
      <th>Due</th>
      <th>Category</th>
      <th>Photos</th>
    </tr>
  </thead>
  <tbody>
    ${tasks.map((t) => `<tr>
      <td class="bold">${esc(t.title)}</td>
      <td>${statusText(t.status)}</td>
      <td>${priorityDot(t.priority)}</td>
      <td class="mono dim">${t.dueDate ? formatInTimeZone(t.dueDate, TIMEZONE, "MMM d") : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${t.category ? esc(t.category) : '<span class="dash">&mdash;</span>'}</td>
      <td>${t.photos?.length || '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="section-title page-break">Work Shifts <span>${shifts.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Day</th>
      <th>Time</th>
      <th>Location</th>
      <th>Label</th>
      <th class="r">Hours</th>
      <th class="r">Net</th>
    </tr>
  </thead>
  <tbody>
    ${shifts.map((s) => `<tr>
      <td class="mono">${formatInTimeZone(s.date, TIMEZONE, "MMM d, yyyy")}</td>
      <td class="dim">${formatInTimeZone(s.date, TIMEZONE, "EEE")}</td>
      <td class="mono">${formatInTimeZone(s.startTime, TIMEZONE, "h:mm a")} – ${formatInTimeZone(s.endTime, TIMEZONE, "h:mm a")}</td>
      <td><span class="loc loc-${SHIFT_LOCATIONS.findIndex((l) => l.key === s.location) % 3}">${shiftLocationLabel(s.location)}</span></td>
      <td class="dim ellipsis">${esc(s.label ?? "")}</td>
      <td class="r mono">${s.hours.toFixed(2)}</td>
      <td class="r mono bold">$${s.netPay.toFixed(2)}</td>
    </tr>`).join("")}
    <tr class="totals">
      <td colspan="5"></td>
      <td class="r mono">${totalHours.toFixed(2)}</td>
      <td class="r mono">$${netPay.toFixed(2)}</td>
    </tr>
  </tbody>
</table>

${jobs.length > 0 ? `
<div class="section-title page-break">Applications <span>${jobs.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Company</th>
      <th>Status</th>
      <th>Date Applied</th>
      <th>Salary</th>
      <th>Location</th>
    </tr>
  </thead>
  <tbody>
    ${jobs.map((j) => `<tr>
      <td class="bold">${esc(j.title)}</td>
      <td>${esc(j.company)}</td>
      <td>${j.status.replace(/_/g, " ")}</td>
      <td class="mono dim">${formatInTimeZone(j.dateApplied, TIMEZONE, "MMM d, yyyy")}</td>
      <td class="dim">${j.salary ? esc(j.salary) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${j.location ? j.location.replace(/_/g, " ") : '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${media.length > 0 ? `
<div class="section-title">Media Files <span>${media.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Filename</th>
      <th>Title</th>
      <th>Type</th>
      <th class="r">Views</th>
      <th class="r">Downloads</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    ${media.map((m) => `<tr>
      <td class="bold ellipsis">${esc(m.filename)}</td>
      <td class="ellipsis">${esc(m.title ?? "")}</td>
      <td class="dim">${esc(m.mimeType)}</td>
      <td class="r mono">${m.views}</td>
      <td class="r mono">${m.downloads}</td>
      <td class="mono dim">${formatInTimeZone(m.createdAt, TIMEZONE, "MMM d, yyyy")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${sites.length > 0 ? `
<div class="section-title">Monitored Sites <span>${sites.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Label</th>
      <th>URL</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    ${sites.map((s) => `<tr>
      <td class="bold">${esc(s.label)}</td>
      <td class="dim">${esc(s.url)}</td>
      <td class="mono dim">${formatInTimeZone(s.createdAt, TIMEZONE, "MMM d, yyyy")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${contacts.length > 0 ? `
<div class="section-title page-break">Contacts <span>${contacts.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Phone</th>
      <th>Company</th>
      <th>Tags</th>
    </tr>
  </thead>
  <tbody>
    ${contacts.map((c) => `<tr>
      <td class="bold">${esc(c.name)}</td>
      <td class="dim">${c.email ? esc(c.email) : '<span class="dash">&mdash;</span>'}</td>
      <td class="mono dim">${c.phone ? esc(c.phone) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${c.company ? esc(c.company) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${c.tags.length > 0 ? c.tags.map((t: string) => esc(t)).join(", ") : '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${links.length > 0 ? `
<div class="section-title">Links <span>${links.length}</span></div>
<div class="links">
  ${links.map((l) => `<div><span class="label">${esc(l.label)}</span><span class="url">${esc(l.url)}</span></div>`).join("")}
</div>
` : ""}

${diary.length > 0 ? `
<div class="section-title">Diary Entries <span>${diary.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Mood</th>
      <th>Tags</th>
      <th>Photos</th>
      <th>Content</th>
    </tr>
  </thead>
  <tbody>
    ${diary.map((d) => `<tr>
      <td class="mono" style="white-space:nowrap">${formatInTimeZone(d.date, TIMEZONE, "MMM d, yyyy")}</td>
      <td>${esc(d.mood ?? "")}</td>
      <td class="dim">${d.tags.map((t: string) => esc(t)).join(", ")}</td>
      <td class="mono">${d.photos.length || '<span class="dash">&mdash;</span>'}</td>
      <td style="max-width:400px;white-space:pre-wrap;word-break:break-word">${esc((d.content ?? "").slice(0, 300))}${(d.content?.length ?? 0) > 300 ? "..." : ""}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${emailLogs.length > 0 ? `
<div class="section-title">Email Logs <span>${emailLogs.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>To</th>
      <th>Subject</th>
      <th>Sent</th>
    </tr>
  </thead>
  <tbody>
    ${emailLogs.map((e) => `<tr>
      <td>${esc(e.type)}</td>
      <td class="dim">${esc(e.to)}</td>
      <td class="bold ellipsis">${esc(e.subject)}</td>
      <td class="mono dim">${formatInTimeZone(e.createdAt, TIMEZONE, "MMM d, yyyy h:mm a")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}


${notificationLogs.length > 0 ? `
<div class="section-title">Notification Logs <span>${notificationLogs.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>Reference ID</th>
      <th>Sent At</th>
    </tr>
  </thead>
  <tbody>
    ${notificationLogs.map((n) => `<tr>
      <td class="bold">${esc(n.type)}</td>
      <td class="dim">${esc(n.refId)}</td>
      <td class="mono dim">${formatInTimeZone(n.sentAt, TIMEZONE, "MMM d, yyyy h:mm a")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${loginLogs.length > 0 ? `
<div class="section-title">Recent Logins <span>${loginLogs.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Email</th>
      <th>Success</th>
      <th>IP</th>
      <th>Timestamp</th>
    </tr>
  </thead>
  <tbody>
    ${loginLogs.map((l) => `<tr>
      <td>${esc(l.email)}</td>
      <td>${l.success ? "Yes" : '<span style="color:#dc2626">No</span>'}</td>
      <td class="mono dim">${esc(l.ip ?? "")}</td>
      <td class="mono dim">${formatInTimeZone(l.createdAt, TIMEZONE, "MMM d, yyyy h:mm a")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${importantTopics.length > 0 ? `
<div class="section-title">Important Topics <span>${importantTopics.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Title</th>
      <th>Category</th>
      <th>Items</th>
      <th>Pinned</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    ${importantTopics.map((t) => `<tr>
      <td class="bold">${esc(t.icon ? `${t.icon} ${t.title}` : t.title)}</td>
      <td class="dim">${t.category ? esc(t.category) : '<span class="dash">&mdash;</span>'}</td>
      <td class="mono">${t.items.length}</td>
      <td>${t.pinned ? "Yes" : "No"}</td>
      <td class="mono dim">${formatInTimeZone(t.createdAt, TIMEZONE, "MMM d, yyyy")}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${tennisRackets.length > 0 ? `
<div class="section-title">Tennis Rackets <span>${tennisRackets.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Current String</th>
      <th>Tension</th>
      <th>Last Strung</th>
      <th>Restrings</th>
    </tr>
  </thead>
  <tbody>
    ${tennisRackets.map((r) => `<tr>
      <td class="bold">${esc(r.name)}</td>
      <td class="dim">${r.currentString ? esc(r.currentString) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${r.tension ? esc(r.tension) : '<span class="dash">&mdash;</span>'}</td>
      <td class="mono dim">${r.lastStrung ? formatInTimeZone(r.lastStrung, TIMEZONE, "MMM d, yyyy") : '<span class="dash">&mdash;</span>'}</td>
      <td class="mono">${r.restrings.length}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${tennisSessions.length > 0 ? `
<div class="section-title">Tennis Sessions <span>${tennisSessions.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Type</th>
      <th>Duration</th>
      <th>Racket</th>
      <th>Coach</th>
      <th>Location</th>
    </tr>
  </thead>
  <tbody>
    ${tennisSessions.map((s) => `<tr>
      <td class="mono">${formatInTimeZone(s.date, TIMEZONE, "MMM d, yyyy")}</td>
      <td>${esc(s.type)}</td>
      <td class="mono">${s.duration ? `${s.duration}h` : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${s.racket ? esc(s.racket.name) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${s.coach ? esc(s.coach) : '<span class="dash">&mdash;</span>'}</td>
      <td class="dim">${s.location ? esc(s.location) : '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${stringInventory.length > 0 ? `
<div class="section-title">String Inventory <span>${stringInventory.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Type</th>
      <th>Gauge</th>
      <th>Quantity</th>
      <th>Photos</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${stringInventory.map((s) => `<tr>
      <td class="bold">${esc(s.name)}</td>
      <td class="dim">${esc(s.type)}</td>
      <td class="mono dim">${s.gauge ? esc(s.gauge) : '<span class="dash">&mdash;</span>'}</td>
      <td class="mono">${s.quantity}</td>
      <td class="mono">${s.photos.length}</td>
      <td class="dim">${s.notes ? esc(s.notes) : '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${tennisStages.length > 0 ? `
<div class="section-title">Tennis Stages <span>${tennisStages.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Stage</th>
      <th>Label</th>
      <th>UTR Range</th>
      <th>Active</th>
      <th>Started</th>
      <th>Completed</th>
    </tr>
  </thead>
  <tbody>
    ${tennisStages.map((s) => `<tr>
      <td class="mono bold">${s.stageNumber}</td>
      <td class="bold">${esc(s.stageLabel)}</td>
      <td class="dim">${esc(s.utrRange)}</td>
      <td>${s.isActive ? '<span style="color:#34d399">Active</span>' : '<span class="dim">No</span>'}</td>
      <td class="mono dim">${formatInTimeZone(s.startedAt, TIMEZONE, "MMM d, yyyy")}</td>
      <td class="mono dim">${s.completedAt ? formatInTimeZone(s.completedAt, TIMEZONE, "MMM d, yyyy") : '<span class="dash">&mdash;</span>'}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

${tennisRatings.length > 0 ? `
<div class="section-title">Tennis Ratings (Recent 50) <span>${tennisRatings.length}</span></div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Stage</th>
      <th>Rater</th>
      <th>FH</th>
      <th>BHT</th>
      <th>BHS</th>
      <th>SV</th>
      <th>VL</th>
      <th>OH</th>
      <th>RT</th>
    </tr>
  </thead>
  <tbody>
    ${tennisRatings.map((r) => `<tr>
      <td class="mono">${formatInTimeZone(r.date, TIMEZONE, "MMM d")}</td>
      <td class="dim">${r.stage.stageLabel}</td>
      <td class="dim">${esc(r.ratedBy)}</td>
      <td class="mono">${r.forehand.toFixed(1)}</td>
      <td class="mono">${r.bhTopspin.toFixed(1)}</td>
      <td class="mono">${r.bhSlice.toFixed(1)}</td>
      <td class="mono">${r.serve.toFixed(1)}</td>
      <td class="mono">${r.volley.toFixed(1)}</td>
      <td class="mono">${r.overhead.toFixed(1)}</td>
      <td class="mono">${r.returnOf.toFixed(1)}</td>
    </tr>`).join("")}
  </tbody>
</table>
` : ""}

<div class="footer">
  <div>${APP_URL}</div>
  <div>Generated ${esc(now)}</div>
</div>

</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
