"use client";

import { useQuery } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  startOfDay,
  endOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { Shift } from "@/generated/prisma/client";
import { shiftLocationShort } from "@/config/shifts";

function formatLocation(location: string): string {
  return shiftLocationShort(location);
}

export function WeeklyHeatmap() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const start = startOfDay(weekStart).toISOString();
  const end = endOfDay(weekEnd).toISOString();

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts", start, end],
    queryFn: async () => {
      const params = new URLSearchParams({ from: start, to: end });
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
  });

  const dayData = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayShifts = shifts.filter(
      (s) => format(new Date(s.date), "yyyy-MM-dd") === dayStr
    );
    const hours = dayShifts.reduce((sum, s) => sum + s.hours, 0);
    return { day, shifts: dayShifts, hours };
  });

  const hasAnyShifts = shifts.length > 0;
  if (!hasAnyShifts) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Shifts this week
      </p>
      <div className="grid grid-cols-7 gap-1">
        {dayData.map(({ day, shifts: dayShifts, hours }) => (
          <div key={day.toISOString()} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "text-[10px]",
                isToday(day) ? "font-medium text-primary" : "text-muted-foreground/60"
              )}
            >
              {format(day, "EEE")}
            </span>
            <div
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-md py-1.5 text-center transition-colors",
                dayShifts.length > 0
                  ? "bg-emerald-500/15"
                  : "bg-muted/30",
                isToday(day) && "ring-1 ring-primary/50"
              )}
            >
              {dayShifts.length > 0 ? (
                <>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {hours.toFixed(1)}h
                  </span>
                  <span className="text-[9px] text-muted-foreground/60">
                    {dayShifts.map((s) => formatLocation(s.location)).join(", ")}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground/30">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
