"use client";

import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from "date-fns";
import type { Shift } from "@/generated/prisma/client";

export function PaySummaryCard() {
  const now = new Date();
  const monthStart = startOfDay(startOfMonth(now)).toISOString();
  const monthEnd = endOfDay(endOfMonth(now)).toISOString();

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts", monthStart, monthEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ from: monthStart, to: monthEnd });
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
  });

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const weekShifts = shifts.filter((s) => {
    const d = new Date(s.date);
    return d >= weekStart && d <= weekEnd;
  });

  const weekHours = weekShifts.reduce((sum, s) => sum + s.hours, 0);
  const weekNet = weekShifts.reduce((sum, s) => sum + s.netPay, 0);
  const monthHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const monthNet = shifts.reduce((sum, s) => sum + s.netPay, 0);

  if (shifts.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground/60" />
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Pay Summary
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground/50">This week</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            ${weekNet.toFixed(0)}
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground/50">
            {weekHours.toFixed(1)}h
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/50">This month</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            ${monthNet.toFixed(0)}
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground/50">
            {monthHours.toFixed(1)}h
          </p>
        </div>
      </div>
    </div>
  );
}
