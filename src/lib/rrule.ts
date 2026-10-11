export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface RecurrenceRule {
  freq: Frequency;
  interval: number;
  byDay?: Weekday[];
  count?: number;
  until?: string; // YYYY-MM-DD
}

const WEEKDAY_ORDER: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function buildRRULE(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.freq}`];

  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.freq === "WEEKLY" && rule.byDay?.length) {
    const sorted = [...rule.byDay].sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)
    );
    parts.push(`BYDAY=${sorted.join(",")}`);
  }

  if (rule.count != null && rule.count > 0) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.until) {
    parts.push(`UNTIL=${rule.until.replace(/-/g, "")}T235959Z`);
  }

  return `RRULE:${parts.join(";")}`;
}

export function parseRRULE(rruleStr: string): RecurrenceRule | null {
  const raw = rruleStr.startsWith("RRULE:")
    ? rruleStr.slice(6)
    : rruleStr;

  const pairs = raw.split(";");
  const map = new Map<string, string>();
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    map.set(pair.slice(0, idx), pair.slice(idx + 1));
  }

  const freq = map.get("FREQ") as Frequency | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) {
    return null;
  }

  const rule: RecurrenceRule = {
    freq,
    interval: parseInt(map.get("INTERVAL") ?? "1") || 1,
  };

  const byDay = map.get("BYDAY");
  if (byDay) {
    rule.byDay = byDay.split(",").filter((d): d is Weekday =>
      WEEKDAY_ORDER.includes(d as Weekday)
    );
  }

  const count = map.get("COUNT");
  if (count) {
    rule.count = parseInt(count) || undefined;
  }

  const until = map.get("UNTIL");
  if (until) {
    // Convert YYYYMMDD or YYYYMMDDTHHmmssZ to YYYY-MM-DD
    const digits = until.replace(/[TZ]/g, "").slice(0, 8);
    if (digits.length === 8) {
      rule.until = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }
  }

  return rule;
}

const FREQ_LABELS: Record<Frequency, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export function describeRRULE(rule: RecurrenceRule): string {
  const unit = FREQ_LABELS[rule.freq];
  const plural = rule.interval > 1 ? `${unit}s` : unit;
  let text = rule.interval > 1
    ? `Every ${rule.interval} ${plural}`
    : `Every ${unit}`;

  if (rule.freq === "WEEKLY" && rule.byDay?.length) {
    const dayNames = rule.byDay
      .sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b))
      .map((d) => WEEKDAY_LABELS[d]);
    text += ` on ${dayNames.join(", ")}`;
  }

  if (rule.count) {
    text += `, ${rule.count} times`;
  } else if (rule.until) {
    text += `, until ${rule.until}`;
  }

  return text;
}
