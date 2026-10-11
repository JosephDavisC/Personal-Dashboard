"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckSquare,
  CalendarDays,
  Clock,
  DollarSign,
} from "lucide-react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/generated/prisma/client";
import type { Shift } from "@/generated/prisma/client";
import type { CalendarEvent } from "@/lib/google-calendar";

export function QuickStats() {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      const json = (await res.json()) as { data: Task[] };
      return json.data;
    },
  });

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", todayStart, todayEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ start: todayStart, end: todayEnd });
      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: CalendarEvent[] };
      return json.data;
    },
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts", weekStart, weekEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ from: weekStart, to: weekEnd });
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
  });

  const activeTasks = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "ARCHIVED"
  ).length;

  const eventsToday = events.length;

  const weekHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const weekPay = shifts.reduce((sum, s) => sum + s.netPay, 0);

  const stats = [
    { icon: CheckSquare, label: "Active tasks", value: String(activeTasks), zero: activeTasks === 0 },
    { icon: CalendarDays, label: "Events today", value: String(eventsToday), zero: eventsToday === 0 },
    { icon: Clock, label: "Hours this week", value: weekHours.toFixed(1), zero: weekHours === 0 },
    { icon: DollarSign, label: "Pay this week", value: `$${weekPay.toFixed(0)}`, zero: weekPay === 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3",
            stat.zero && "opacity-50"
          )}
        >
          <stat.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-3xl font-extrabold tabular-nums leading-none tracking-tight text-foreground">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
