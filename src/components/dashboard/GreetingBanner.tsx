"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckSquare, Clock } from "lucide-react";
import { startOfDay, endOfDay, format, parseISO, isPast, isToday } from "date-fns";
import type { CalendarEvent } from "@/lib/google-calendar";
import type { Task } from "@/generated/prisma/client";
import type { Shift } from "@/generated/prisma/client";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

export function GreetingBanner({ name }: { name?: string }) {
  // Greeting depends on the viewer's local hour, which the server (UTC) cannot
  // know. Start empty so server and first client render match, then fill in.
  const [greeting, setGreeting] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      setGreeting(getGreeting());
      setNow(new Date());
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const today = now;
  const start = startOfDay(today).toISOString();
  const end = endOfDay(today).toISOString();

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", start, end],
    queryFn: async () => {
      const params = new URLSearchParams({ start, end });
      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: CalendarEvent[] };
      return json.data;
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      const json = (await res.json()) as { data: Task[] };
      return json.data;
    },
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await fetch("/api/shifts");
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
  });

  // Count remaining events today (not ended yet)
  const remainingEvents = events.filter((e) => {
    if (e.end.dateTime) return !isPast(parseISO(e.end.dateTime));
    // All-day events are "remaining" until end of day
    return true;
  }).length;

  // Count tasks due today that aren't done
  const tasksDueToday = tasks.filter((t) => {
    if (t.status === "DONE" || t.status === "ARCHIVED") return false;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return isToday(local);
  }).length;

  // Count shifts today
  const shiftsToday = shifts.filter((s) => {
    const d = new Date(s.date);
    return isToday(d);
  }).length;

  const segments: { icon: typeof CalendarDays; text: string }[] = [];
  if (remainingEvents > 0) {
    segments.push({
      icon: CalendarDays,
      text: `${remainingEvents} event${remainingEvents !== 1 ? "s" : ""} remaining`,
    });
  }
  if (tasksDueToday > 0) {
    segments.push({
      icon: CheckSquare,
      text: `${tasksDueToday} task${tasksDueToday !== 1 ? "s" : ""} due`,
    });
  }
  if (shiftsToday > 0) {
    segments.push({
      icon: Clock,
      text: `${shiftsToday} shift${shiftsToday !== 1 ? "s" : ""} today`,
    });
  }

  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-500/5 to-transparent p-4 -mx-4">
      {/* Server renders in UTC, client in local time, so the greeting can
          differ at hydration; the 1s interval corrects it immediately */}
      <h1
        className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        suppressHydrationWarning
      >
        {greeting ?? "Welcome back"}{name ? `, ${name}` : ""}
      </h1>
      {/* Date and clock also wait for the client, for the same reason as the greeting */}
      <p className="mt-1 min-h-5 text-sm text-muted-foreground" suppressHydrationWarning>
        {greeting !== null && (
          <>
            {format(today, "EEEE, MMMM d, yyyy")}
            <span className="ml-2 font-mono tabular-nums">
              {format(now, "h:mm:ss a")}
            </span>
          </>
        )}
      </p>
      {segments.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {segments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="mr-1.5 text-border" aria-hidden>
                  ·
                </span>
              )}
              <seg.icon className="h-3.5 w-3.5" />
              {seg.text}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground/60">
          Nothing on your plate today. Enjoy!
        </p>
      )}
    </div>
  );
}
