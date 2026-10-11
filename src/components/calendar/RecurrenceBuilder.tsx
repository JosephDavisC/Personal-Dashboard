"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type Frequency,
  type Weekday,
  type RecurrenceRule,
  buildRRULE,
  parseRRULE,
  describeRRULE,
} from "@/lib/rrule";

interface RecurrenceBuilderProps {
  value?: string[]; // e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
  onChange: (recurrence: string[] | undefined) => void;
}

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MO", label: "M" },
  { value: "TU", label: "T" },
  { value: "WE", label: "W" },
  { value: "TH", label: "T" },
  { value: "FR", label: "F" },
  { value: "SA", label: "S" },
  { value: "SU", label: "S" },
];

type EndType = "never" | "count" | "until";

export function RecurrenceBuilder({ value, onChange }: RecurrenceBuilderProps) {
  const initial = value?.[0] ? parseRRULE(value[0]) : null;

  const [enabled, setEnabled] = useState(!!initial);
  const [freq, setFreq] = useState<Frequency>(initial?.freq ?? "WEEKLY");
  const [interval, setInterval_] = useState(initial?.interval ?? 1);
  const [byDay, setByDay] = useState<Set<Weekday>>(
    new Set(initial?.byDay ?? [])
  );
  const [endType, setEndType] = useState<EndType>(
    initial?.count ? "count" : initial?.until ? "until" : "never"
  );
  const [count, setCount] = useState(initial?.count ?? 10);
  const [until, setUntil] = useState(initial?.until ?? "");

  // Emit changes
  useEffect(() => {
    if (!enabled) {
      onChange(undefined);
      return;
    }

    const rule: RecurrenceRule = { freq, interval };

    if (freq === "WEEKLY" && byDay.size > 0) {
      rule.byDay = Array.from(byDay);
    }

    if (endType === "count") {
      rule.count = count;
    } else if (endType === "until" && until) {
      rule.until = until;
    }

    onChange([buildRRULE(rule)]);
  }, [enabled, freq, interval, byDay, endType, count, until, onChange]);

  function toggleDay(day: Weekday) {
    setByDay((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  // Build description for preview
  const previewRule: RecurrenceRule = {
    freq,
    interval,
    byDay: freq === "WEEKLY" && byDay.size > 0 ? Array.from(byDay) : undefined,
    count: endType === "count" ? count : undefined,
    until: endType === "until" ? until : undefined,
  };

  return (
    <div className="space-y-3">
      {/* Enable/disable */}
      <div className="flex items-center gap-2">
        <input
          id="event-repeat"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="event-repeat" className="text-sm font-normal">
          Repeat
        </Label>
      </div>

      {enabled && (
        <div className="space-y-3 rounded-md border border-border/50 p-3">
          {/* Frequency */}
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs">Every</Label>
            <Input
              type="number"
              min="1"
              max="99"
              value={interval}
              onChange={(e) => setInterval_(parseInt(e.target.value) || 1)}
              className="w-16 border-border bg-card text-sm"
            />
            <div className="flex gap-1">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFreq(opt.value)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    freq === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day-of-week for weekly */}
          {freq === "WEEKLY" && (
            <div>
              <Label className="text-xs">On</Label>
              <div className="mt-1 flex gap-1">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                      byDay.has(d.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <Label className="text-xs">Ends</Label>
            <div className="mt-1 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={endType === "never"}
                  onChange={() => setEndType("never")}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">Never</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={endType === "count"}
                  onChange={() => setEndType("count")}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">After</span>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  disabled={endType !== "count"}
                  className="w-16 border-border bg-card text-xs"
                />
                <span className="text-xs">occurrences</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={endType === "until"}
                  onChange={() => setEndType("until")}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs">On</span>
                <Input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endType !== "until"}
                  className="w-36 border-border bg-card text-xs"
                />
              </label>
            </div>
          </div>

          {/* Human-readable description */}
          <p className="text-xs text-muted-foreground">
            {describeRRULE(previewRule)}
          </p>
        </div>
      )}
    </div>
  );
}
