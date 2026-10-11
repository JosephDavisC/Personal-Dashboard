"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Clock, ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isToday, isTomorrow, startOfDay, addDays, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Shift } from "@/generated/prisma/client";
import { shiftLocationLabel } from "@/config/shifts";

function getShiftStatus(start: Date, end: Date): { label: string; color: string } {
  const now = new Date();
  if (now >= end) {
    const minsAgo = differenceInMinutes(now, end);
    if (minsAgo < 60) return { label: `Done ${minsAgo}m ago`, color: "bg-muted text-muted-foreground" };
    const hrsAgo = Math.floor(minsAgo / 60);
    return { label: `Done ${hrsAgo}h ago`, color: "bg-muted text-muted-foreground" };
  }
  if (now >= start && now < end) {
    const minsLeft = differenceInMinutes(end, now);
    if (minsLeft < 60) return { label: `Now · ${minsLeft}m left`, color: "bg-blue-500/15 text-blue-400" };
    const hrsLeft = Math.round(minsLeft / 60 * 10) / 10;
    return { label: `Now · ${hrsLeft}h left`, color: "bg-blue-500/15 text-blue-400" };
  }
  const minsUntil = differenceInMinutes(start, now);
  if (minsUntil < 60) return { label: `In ${minsUntil}m`, color: "bg-orange-500/15 text-orange-400" };
  const hrsUntil = Math.round(minsUntil / 60 * 10) / 10;
  if (hrsUntil < 24) return { label: `In ${hrsUntil}h`, color: "bg-muted text-muted-foreground" };
  return { label: "Upcoming", color: "bg-muted text-muted-foreground" };
}

function formatLocation(location: string): string {
  return shiftLocationLabel(location);
}

export function UpcomingShifts() {
  const now = new Date();
  const from = startOfDay(now).toISOString();
  const to = addDays(startOfDay(now), 2).toISOString();

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["shifts", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
    refetchInterval: 5_000,
  });

  const todayShifts = shifts.filter((s) => isToday(new Date(s.date)));
  const tomorrowShifts = shifts.filter((s) => isTomorrow(new Date(s.date)));

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <p className="text-center text-sm text-muted-foreground/60">
            Loading shifts...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (todayShifts.length === 0 && tomorrowShifts.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          Shifts
        </CardTitle>
        <Link
          href="/dashboard/shifts"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          All shifts
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {todayShifts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
              Today
            </p>
            <div className="space-y-2">
              {todayShifts.map((shift) => (
                <ShiftRow key={shift.id} shift={shift} />
              ))}
            </div>
          </div>
        )}
        {tomorrowShifts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
              Tomorrow
            </p>
            <div className="space-y-2">
              {tomorrowShifts.map((shift) => (
                <ShiftRow key={shift.id} shift={shift} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShiftRow({ shift }: { shift: Shift }) {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const status = getShiftStatus(start, end);

  return (
    <Link
      href="/dashboard/shifts"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-4 py-3 transition-all hover:border-border/60 hover:bg-accent/50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">
            {formatLocation(shift.location)}
          </p>
          <Badge variant="secondary" className={cn("shrink-0 text-[10px] font-medium", status.color)}>
            {status.label}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {format(start, "h:mm a")} – {format(end, "h:mm a")}
        </p>
        {shift.label && (
          <p className="truncate text-xs text-muted-foreground/70">
            {shift.label}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {shift.hours}h
        </p>
        <p className="text-xs tabular-nums text-emerald-500">
          ${shift.netPay.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
