import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { SITE } from "@/config/site";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape HTML then convert **bold** markers to <strong> */
function escBold(text: string): string {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${FG};font-weight:700">$1</strong>`);
}

const MOOD_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  happy: { label: "Happy", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)" },
  good: { label: "Good", color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)" },
  neutral: { label: "Neutral", color: "#facc15", bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.3)" },
  tired: { label: "Tired", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.3)" },
  sad: { label: "Sad", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  stressed: { label: "Stressed", color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.3)" },
  angry: { label: "Angry", color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
  excited: { label: "Excited", color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.3)" },
};

interface DiaryPhotoData {
  url: string;
  caption: string | null;
  mediaId: string | null;
  mimeType: string | null;
  thumbnail: string | null;
}

interface DiaryEntryData {
  date: Date;
  content: string | null;
  mood: string | null;
  tags: string[];
  photos: DiaryPhotoData[];
  links: { url: string; title: string | null }[];
  createdAt: Date;
}

// Dark theme colors matching globals.css
const BG = "#131c2e";       // background
const CARD = "#1a2540";     // card
const CARD_BORDER = "#4b5c7a"; // border
const FG = "#f1f5f9";       // foreground
const MUTED = "#94a3b8";    // muted-foreground
const PRIMARY = "#60a5fa";  // primary
const PRIMARY_BG = "rgba(96,165,250,0.1)";

const CSS = `
  @page { margin: 0; size: A4 portrait; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif;
    font-size: 13px;
    color: ${FG};
    background: ${BG};
    line-height: 1.6;
    padding: 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${PRIMARY};
  }
  .header h1 {
    font-size: 22px;
    font-weight: 800;
    color: ${FG};
    letter-spacing: -0.03em;
  }
  .header .meta {
    font-size: 12px;
    color: ${MUTED};
  }
  /* Stats bar */
  .stats {
    display: flex;
    gap: 24px;
    margin-bottom: 28px;
    padding: 16px 20px;
    background: ${CARD};
    border: 1px solid ${CARD_BORDER};
    border-radius: 10px;
  }
  .stat-item { min-width: 64px; }
  .stat-label {
    font-size: 9px;
    color: ${MUTED};
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
  }
  .stat-value {
    font-size: 18px;
    font-weight: 800;
    color: ${FG};
    margin-top: 2px;
    letter-spacing: -0.02em;
  }
  /* Entry card */
  .entry-card {
    background: ${CARD};
    border: 1px solid ${CARD_BORDER};
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .entry-card.mood-border {
    border-left: 4px solid;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .entry-date {
    font-size: 16px;
    font-weight: 800;
    color: ${FG};
    letter-spacing: -0.02em;
  }
  .entry-day {
    font-weight: 400;
    color: ${MUTED};
    font-size: 14px;
    margin-left: 8px;
  }
  .mood-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  /* Tags */
  .tag-list {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    background: ${PRIMARY_BG};
    color: ${PRIMARY};
    border: 1px solid rgba(96,165,250,0.2);
    text-transform: capitalize;
  }
  /* Content */
  .entry-content {
    font-size: 13px;
    line-height: 1.75;
    color: ${MUTED};
    white-space: pre-wrap;
    word-break: break-word;
  }
  /* Photo grid */
  .photo-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }
  .photo-grid .photo-wrapper {
    flex: 0 1 auto;
  }
  .photo-grid.single .photo-wrapper { max-width: 400px; }
  .photo-item {
    border-radius: 8px;
    overflow: hidden;
  }
  .photo-item img {
    max-height: 280px;
    height: auto;
    width: auto;
    object-fit: contain;
    display: block;
    border-radius: 8px;
  }
  .photo-caption {
    font-size: 10px;
    color: ${MUTED};
    margin-top: 4px;
    text-align: center;
  }
  /* Links */
  .entry-links {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(75,92,122,0.3);
  }
  .link-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    margin-bottom: 4px;
    border-radius: 6px;
    background: rgba(75,92,122,0.15);
    text-decoration: none;
  }
  .link-item span {
    font-size: 12px;
    color: ${PRIMARY};
  }
  /* TOC */
  .toc {
    margin-bottom: 32px;
  }
  .toc h2 {
    font-size: 15px;
    font-weight: 800;
    margin-bottom: 14px;
    color: ${FG};
    letter-spacing: -0.02em;
  }
  .toc-card {
    background: ${CARD};
    border: 1px solid ${CARD_BORDER};
    border-radius: 10px;
    overflow: hidden;
  }
  .toc-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(75,92,122,0.2);
    font-size: 12px;
  }
  .toc-item:last-child { border-bottom: none; }
  .toc-date { font-weight: 700; color: ${FG}; }
  .toc-day { color: ${MUTED}; margin-left: 8px; font-weight: 400; }
  .toc-right { display: flex; align-items: center; gap: 10px; }
  .toc-mood { font-size: 11px; }
  .toc-tags { color: ${MUTED}; font-size: 10px; }
  .toc-preview { color: ${MUTED}; font-size: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Footer */
  .footer {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid ${CARD_BORDER};
    font-size: 10px;
    color: ${MUTED};
    display: flex;
    justify-content: space-between;
    opacity: 0.6;
  }
  .page-break { page-break-before: always; }
  /* Separator line between content and photos */
  .section-divider {
    border: none;
    border-top: 1px solid rgba(75,92,122,0.2);
    margin: 16px 0;
  }
`;

function renderMoodChip(mood: string | null): string {
  if (!mood) return "";
  const m = MOOD_CONFIG[mood];
  if (!m) return "";
  return `<span class="mood-chip" style="background:${m.bg};color:${m.color};border:1px solid ${m.border}">${m.label}</span>`;
}

function renderPhotos(photos: DiaryPhotoData[], baseUrl: string): string {
  // Filter out videos without thumbnails (can't display in PDF)
  const displayable = photos.filter(p => {
    const isVideo = p.mimeType?.startsWith("video/");
    return !isVideo || p.thumbnail;
  });
  if (displayable.length === 0) return "";
  const gridClass = displayable.length === 1 ? "single" : "";
  return `
    <hr class="section-divider">
    <div class="photo-grid ${gridClass}">
      ${displayable.map((p) => {
        const isVideo = p.mimeType?.startsWith("video/");
        // Use thumbnail for videos (via media ID endpoint), original URL for images
        const rawUrl = isVideo && p.thumbnail && p.mediaId ? `/api/media/${p.mediaId}/thumb` : p.url;
        const imgUrl = rawUrl.startsWith("/") ? `${baseUrl}${rawUrl}` : rawUrl;
        const captionText = p.caption || "";
        const label = isVideo ? (captionText ? `${captionText} (Video)` : "Video") : captionText;
        return `<div class="photo-wrapper">
          <div class="photo-item">
            <img src="${esc(imgUrl)}" alt="${esc(label)}" />
          </div>
          ${label ? `<p class="photo-caption">${esc(label)}</p>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderEntry(entry: DiaryEntryData, baseUrl: string): string {
  const dateStr = formatInTimeZone(entry.date, TIMEZONE, "MMMM d, yyyy");
  const dayStr = formatInTimeZone(entry.date, TIMEZONE, "EEEE");
  const moodCfg = entry.mood ? MOOD_CONFIG[entry.mood] : null;
  const borderStyle = moodCfg ? `border-left-color: ${moodCfg.color}` : "";

  return `
    <div class="entry-card${moodCfg ? " mood-border" : ""}" style="${borderStyle}">
      <div class="entry-header">
        <div>
          <span class="entry-date">${esc(dateStr)}</span>
          <span class="entry-day">${esc(dayStr)}</span>
        </div>
        ${renderMoodChip(entry.mood)}
      </div>
      ${entry.tags.length > 0 ? `
        <div class="tag-list">
          ${entry.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </div>
      ` : ""}
      ${entry.content ? `<div class="entry-content">${escBold(entry.content)}</div>` : ""}
      ${renderPhotos(entry.photos, baseUrl)}
      ${entry.links.length > 0 ? `
        <div class="entry-links">
          ${entry.links.map((l) => `<div class="link-item"><span>${esc(l.title || l.url)}</span></div>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

export function generateFullDiaryPdf(entries: DiaryEntryData[], baseUrl: string): string {
  const now = formatInTimeZone(new Date(), TIMEZONE, "MMMM d, yyyy");
  const time = formatInTimeZone(new Date(), TIMEZONE, "h:mm a");

  const totalWords = entries.reduce((s, e) => s + (e.content?.split(/\s+/).length ?? 0), 0);
  const totalPhotos = entries.reduce((s, e) => s + e.photos.length, 0);
  const moodCounts: Record<string, number> = {};
  for (const e of entries) {
    if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] ?? 0) + 1;
  }
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  const dateRange = entries.length > 0
    ? `${formatInTimeZone(entries[entries.length - 1]!.date, TIMEZONE, "MMM d")} — ${formatInTimeZone(entries[0]!.date, TIMEZONE, "MMM d, yyyy")}`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Diary | ${SITE.ownerName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div class="header">
  <h1>Diary</h1>
  <div class="meta">${esc(now)} &middot; ${esc(time)}</div>
</div>

<div class="stats">
  <div class="stat-item">
    <div class="stat-label">Entries</div>
    <div class="stat-value">${entries.length}</div>
  </div>
  <div class="stat-item">
    <div class="stat-label">Words</div>
    <div class="stat-value">${totalWords.toLocaleString()}</div>
  </div>
  <div class="stat-item">
    <div class="stat-label">Photos</div>
    <div class="stat-value">${totalPhotos}</div>
  </div>
  ${topMood ? `<div class="stat-item">
    <div class="stat-label">Top Mood</div>
    <div class="stat-value">${MOOD_CONFIG[topMood[0]]?.label ?? topMood[0]} <span style="font-size:11px;color:${MUTED}">(${topMood[1]}x)</span></div>
  </div>` : ""}
  ${dateRange ? `<div class="stat-item">
    <div class="stat-label">Date Range</div>
    <div class="stat-value" style="font-size:12px">${esc(dateRange)}</div>
  </div>` : ""}
</div>

<div class="toc">
  <h2>Table of Contents</h2>
  <div class="toc-card">
    ${entries.map((e) => {
      const d = formatInTimeZone(e.date, TIMEZONE, "MMM d, yyyy");
      const day = formatInTimeZone(e.date, TIMEZONE, "EEE");
      const preview = (e.content ?? "").replace(/\*\*/g, "").slice(0, 50).replace(/\n/g, " ");
      const moodCfg = e.mood ? MOOD_CONFIG[e.mood] : null;
      return `<div class="toc-item">
        <div>
          <span class="toc-date">${esc(d)}</span>
          <span class="toc-day">${esc(day)}</span>
        </div>
        <div class="toc-right">
          ${e.tags.length > 0 ? `<span class="toc-tags">${e.tags.join(", ")}</span>` : ""}
          ${moodCfg ? `<span class="toc-mood" style="color:${moodCfg.color}">${moodCfg.label}</span>` : ""}
          <span class="toc-preview">${esc(preview)}${preview.length < (e.content?.length ?? 0) ? "..." : ""}</span>
        </div>
      </div>`;
    }).join("")}
  </div>
</div>

<div class="page-break"></div>

${entries.map((e, i) => `${i > 0 && i % 3 === 0 ? '<div class="page-break"></div>' : ""}${renderEntry(e, baseUrl)}`).join("")}

<div class="footer">
  <div>${SITE.ownerName} · Diary</div>
  <div>Generated ${esc(now)}</div>
</div>

</body>
</html>`;
}

export function generateSingleEntryPdf(entry: DiaryEntryData, baseUrl: string): string {
  const now = formatInTimeZone(new Date(), TIMEZONE, "MMMM d, yyyy");
  const time = formatInTimeZone(new Date(), TIMEZONE, "h:mm a");
  const wordCount = entry.content?.split(/\s+/).length ?? 0;
  const displayDate = formatInTimeZone(entry.date, TIMEZONE, "EEEE, MMMM d, yyyy");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Diary — ${esc(displayDate)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>

<div class="header">
  <h1>Diary</h1>
  <div class="meta">${esc(now)} &middot; ${esc(time)}</div>
</div>

<div class="stats">
  <div class="stat-item">
    <div class="stat-label">Words</div>
    <div class="stat-value">${wordCount}</div>
  </div>
  <div class="stat-item">
    <div class="stat-label">Photos</div>
    <div class="stat-value">${entry.photos.length}</div>
  </div>
  ${entry.mood ? `<div class="stat-item">
    <div class="stat-label">Mood</div>
    <div class="stat-value" style="color:${MOOD_CONFIG[entry.mood]?.color ?? FG}">${MOOD_CONFIG[entry.mood]?.label ?? entry.mood}</div>
  </div>` : ""}
  ${entry.tags.length > 0 ? `<div class="stat-item">
    <div class="stat-label">Tags</div>
    <div class="stat-value" style="font-size:12px;color:${PRIMARY}">${entry.tags.join(", ")}</div>
  </div>` : ""}
</div>

${renderEntry(entry, baseUrl)}

<div class="footer">
  <div>${SITE.ownerName} · Diary</div>
  <div>Generated ${esc(now)}</div>
</div>

</body>
</html>`;
}
