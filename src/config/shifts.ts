// Shift tracker configuration. Edit this file to match your own job(s).
//
// Each location is a place or role you work shifts at. `key` is what gets
// stored in the database, so pick it once and avoid renaming it later.
// `keywords` drive calendar sync: an event whose title contains any keyword
// (case insensitive) is detected as a shift at that location.

// Pay used to calculate gross and net for every shift.
export const HOURLY_WAGE = 20;
// Share of gross pay withheld (taxes and deductions), 0.1 = 10%.
export const PAY_DEDUCTION_RATE = 0.1;

export interface ShiftLocationConfig {
  key: string;
  label: string;
  short: string;
  keywords: string[];
  badgeClass: string;
  borderClass: string;
  blockClass: string;
  dotClass: string;
  chartColor: string;
}

export const SHIFT_LOCATIONS: ShiftLocationConfig[] = [
  {
    key: "CAFE",
    label: "Cafe",
    short: "CF",
    keywords: ["cafe", "barista", "coffee bar"],
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    borderClass: "border-l-blue-400",
    blockClass: "border-l-blue-400 bg-blue-500/15 text-foreground",
    dotClass: "bg-blue-500/40",
    chartColor: "#60A5FA",
  },
  {
    key: "FRONT_DESK",
    label: "Front Desk",
    short: "FD",
    keywords: ["front desk", "reception"],
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    borderClass: "border-l-purple-400",
    blockClass: "border-l-purple-400 bg-purple-500/15 text-foreground",
    dotClass: "bg-purple-500/40",
    chartColor: "#A78BFA",
  },
  {
    key: "EVENTS",
    label: "Events",
    short: "EV",
    keywords: ["event setup", "catering", "event shift"],
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    borderClass: "border-l-emerald-400",
    blockClass: "border-l-emerald-400 bg-emerald-500/15 text-foreground",
    dotClass: "bg-emerald-500/40",
    chartColor: "#34D399",
  },
];

// Calendar events containing any of these are never treated as shifts.
export const SHIFT_EXCLUDED_KEYWORDS = ["personal", "errand"];

export const DEFAULT_SHIFT_LOCATION = SHIFT_LOCATIONS[0]!.key;

export function getShiftLocation(key: string): ShiftLocationConfig {
  return SHIFT_LOCATIONS.find((l) => l.key === key) ?? SHIFT_LOCATIONS[0]!;
}

export function shiftLocationLabel(key: string): string {
  return SHIFT_LOCATIONS.find((l) => l.key === key)?.label ?? key;
}

export function shiftLocationShort(key: string): string {
  return SHIFT_LOCATIONS.find((l) => l.key === key)?.short ?? key.slice(0, 2);
}

// Optional supervisor or team contacts shown under the shift tracker.
// Leave empty to hide the card. Example:
//   { name: "Alex Rivera", email: "alex@example.com", phone: "555-0100" }
export interface ShiftContact {
  name: string;
  email: string;
  phone?: string;
}

export const SHIFT_CONTACTS: ShiftContact[] = [];
