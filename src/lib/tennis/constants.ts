export const TENNIS_STAGES = [
  { number: 1, label: "Beginner",          utrRange: "1.0 - 3.0", color: "text-zinc-400",   bgColor: "bg-zinc-500/20",    borderColor: "border-zinc-500/30"   },
  { number: 2, label: "Intermediate",      utrRange: "3.0 - 5.0", color: "text-green-400",  bgColor: "bg-green-500/20",   borderColor: "border-green-500/30"  },
  { number: 3, label: "High Intermediate", utrRange: "5.0 - 7.0", color: "text-blue-400",   bgColor: "bg-blue-500/20",    borderColor: "border-blue-500/30"   },
  { number: 4, label: "Advanced",          utrRange: "7.0 - 9.0", color: "text-purple-400", bgColor: "bg-purple-500/20",  borderColor: "border-purple-500/30" },
  { number: 5, label: "Elite",             utrRange: "9.0 - 11.0", color: "text-amber-400", bgColor: "bg-amber-500/20",   borderColor: "border-amber-500/30"  },
  { number: 6, label: "Competitive",       utrRange: "11.0 - 13.0", color: "text-red-400",  bgColor: "bg-red-500/20",     borderColor: "border-red-500/30"    },
] as const;

export const STROKES = [
  { key: "forehand",  label: "Forehand",    shortLabel: "FH"  },
  { key: "bhTopspin", label: "BH Topspin",  shortLabel: "BHT" },
  { key: "bhSlice",   label: "BH Slice",    shortLabel: "BHS" },
  { key: "serve",     label: "Serve",       shortLabel: "SRV" },
  { key: "volley",    label: "Volley",      shortLabel: "VOL" },
  { key: "overhead",  label: "Overhead",    shortLabel: "OH"  },
  { key: "returnOf",  label: "Return",      shortLabel: "RET" },
] as const;

export type StrokeKey = (typeof STROKES)[number]["key"];

export interface Rater {
  key: string;
  label: string;
}

export const DEFAULT_RATERS: Rater[] = [
  { key: "self",    label: "Self"    },
  { key: "claude",  label: "Claude"  },
  { key: "coach",   label: "Coach"   },
];

const RATER_STORAGE_KEY = "tennis-custom-raters";

/** Get rater list from localStorage (falls back to defaults) */
export function getCustomRaters(): Rater[] {
  if (typeof window === "undefined") return DEFAULT_RATERS;
  try {
    const stored = localStorage.getItem(RATER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Rater[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_RATERS;
}

/** Save rater list to localStorage */
export function saveCustomRaters(raters: Rater[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RATER_STORAGE_KEY, JSON.stringify(raters));
}

/** Get display label for a rater key */
export function getRaterLabel(raterKey: string): string {
  if (raterKey.startsWith("coach:")) return raterKey.replace("coach:", "Coach ");
  const raters = getCustomRaters();
  return raters.find((r) => r.key === raterKey)?.label || raterKey;
}

/** Backward compat — components that haven't migrated yet */
export const RATERS = DEFAULT_RATERS;

export const STAGE_ADVANCE_THRESHOLD = 9.0;

export const NEW_STAGE_BASE_RATINGS: Record<number, number> = {
  1: 1.0,
  2: 4.0,
  3: 4.5,
  4: 5.0,
  5: 5.5,
  6: 6.0,
};

export const RATER_COLORS: Record<string, string> = {
  self: "#60A5FA",
  claude: "#8b5cf6",
  coach: "#f59e0b",
};

const COLOR_POOL = [
  "#60A5FA", "#8b5cf6", "#f59e0b", "#10b981",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

/** Get color for a rater key (static lookup first, then hash-based from pool) */
export function getRaterColor(raterKey: string): string {
  if (RATER_COLORS[raterKey]) return RATER_COLORS[raterKey];
  let hash = 0;
  for (let i = 0; i < raterKey.length; i++) {
    hash = (hash * 31 + raterKey.charCodeAt(i)) | 0;
  }
  return COLOR_POOL[Math.abs(hash) % COLOR_POOL.length]!;
}

export const STROKE_COLORS: Record<string, string> = {
  forehand:  "#3b82f6",
  bhTopspin: "#8b5cf6",
  bhSlice:   "#a855f7",
  serve:     "#ef4444",
  volley:    "#10b981",
  overhead:  "#f59e0b",
  returnOf:  "#06b6d4",
};
