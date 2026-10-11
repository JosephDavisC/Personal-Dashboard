import { SITE } from "@/config/site";
import { HOURLY_WAGE, PAY_DEDUCTION_RATE } from "@/config/shifts";

export { HOURLY_WAGE };
export const TAX_DEDUCTION_RATE = PAY_DEDUCTION_RATE;
export const NET_PAY_RATE = 1 - TAX_DEDUCTION_RATE;
export const TIMEZONE = SITE.timezone;
export const STALE_JOB_THRESHOLD_DAYS = 14;

export const EXPENSE_CATEGORIES = [
  "food",
  "coffee",
  "groceries",
  "transport",
  "subscriptions",
  "entertainment",
  "school",
  "other",
] as const;

export const APPLICATION_STATUSES = [
  "APPLIED",
  "PHONE_SCREEN",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  PHONE_SCREEN: "Phone Screen",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  APPLIED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  PHONE_SCREEN: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  INTERVIEW: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  OFFER: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/20",
  WITHDRAWN: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export const WORK_LOCATION_LABELS: Record<string, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ON_SITE: "On Site",
};

export const WORK_LOCATION_COLORS: Record<string, string> = {
  REMOTE: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  HYBRID: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  ON_SITE: "bg-green-500/15 text-green-400 border-green-500/20",
};

export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  NONE: "No assessment",
  CODING: "Coding assessment",
  TAKE_HOME: "Take-home project",
  SYSTEM_DESIGN: "System design",
  OTHER: "Other",
};

export const ASSESSMENT_TYPE_COLORS: Record<string, string> = {
  NONE: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  CODING: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  TAKE_HOME: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  SYSTEM_DESIGN: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20",
  OTHER: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

// ============ IMPORTANT CATEGORIES ============

export const IMPORTANT_CATEGORIES = [
  { value: "work", label: "Work", color: "#60A5FA" },
  { value: "school", label: "School", color: "#F472B6" },
  { value: "personal", label: "Personal", color: "#34D399" },
  { value: "reference", label: "Reference", color: "#FBBF24" },
  { value: "project", label: "Project", color: "#A78BFA" },
] as const;

export const IMPORTANT_CATEGORY_COLORS: Record<string, string> = {
  work: "#60A5FA",
  school: "#F472B6",
  personal: "#34D399",
  reference: "#FBBF24",
  project: "#A78BFA",
};

// ============ MEDIA STORAGE ============

export const MEDIA_STORAGE_LIMIT_GB = Number(
  process.env.MEDIA_STORAGE_LIMIT_GB || "50"
);
export const MEDIA_STORAGE_LIMIT_BYTES =
  MEDIA_STORAGE_LIMIT_GB * 1024 * 1024 * 1024;
export const MEDIA_MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB
export const MEDIA_UPLOAD_DIR =
  process.env.NODE_ENV === "production" ? "/data/media" : "./data/media";
export const MEDIA_THUMBS_DIR =
  process.env.NODE_ENV === "production"
    ? "/data/media/thumbs"
    : "./data/media/thumbs";

export const MEDIA_ACCEPTED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  all: "All",
  video: "Videos",
  image: "Images",
  document: "Documents",
};

export const MEDIA_TYPE_COLORS: Record<string, string> = {
  video: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  image: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  document: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export const CDN_BASE_URL =
  process.env.CDN_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
