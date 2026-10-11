import { HOURLY_WAGE, NET_PAY_RATE } from "./constants";
import { SHIFT_LOCATIONS, SHIFT_EXCLUDED_KEYWORDS, DEFAULT_SHIFT_LOCATION } from "@/config/shifts";

export function calculateHours(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

export function calculateGrossPay(hours: number): number {
  return Math.round(hours * HOURLY_WAGE * 100) / 100;
}

export function calculateNetPay(grossPay: number): number {
  return Math.round(grossPay * NET_PAY_RATE * 100) / 100;
}

const ALL_SHIFT_KEYWORDS = SHIFT_LOCATIONS.flatMap((l) => l.keywords);

export function isWorkShift(summary: string): boolean {
  const lower = summary.toLowerCase().trim();
  if (SHIFT_EXCLUDED_KEYWORDS.some((ex) => lower.includes(ex))) return false;
  return ALL_SHIFT_KEYWORDS.some((k) => lower.includes(k));
}

/** First configured location whose keywords match the label, else the default. */
export function detectLocation(label: string): string {
  const lower = label.toLowerCase().trim();
  const match = SHIFT_LOCATIONS.find((l) => l.keywords.some((k) => lower.includes(k)));
  return match?.key ?? DEFAULT_SHIFT_LOCATION;
}
