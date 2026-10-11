"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, ArrowRight, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfDay, endOfDay, format, parseISO, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/google-calendar";

export function TodayEvents() {
  const today = new Date();
  const start = startOfDay(today).toISOString();
  const end = endOfDay(today).toISOString();

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", start, end],
    queryFn: async () => {
      const params = new URLSearchParams({ start, end });
      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) return [];
      const json = (await res.json()) as { data: CalendarEvent[] };
      return json.data;
    },
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          Today
        </CardTitle>
        <Link
          href="/dashboard/calendar"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Full calendar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground/60">
            Loading events...
          </p>
        ) : events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground/60">
            No events today.
          </p>
        ) : (
          <div className="space-y-2.5">
            {events.map((event) => {
              const isAllDay = !event.start.dateTime;
              const startTime = event.start.dateTime
                ? parseISO(event.start.dateTime)
                : null;
              const endTime = event.end.dateTime
                ? parseISO(event.end.dateTime)
                : null;
              const past = startTime ? isPast(startTime) : false;

              return (
                <Link
                  key={event.id}
                  href={`/dashboard/calendar?date=${format(today, "yyyy-MM-dd")}${startTime ? `&time=${encodeURIComponent(startTime.toISOString())}` : ""}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-4 py-3 transition-all hover:border-border/60 hover:bg-accent/50",
                    past && "opacity-50"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <Clock className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {event.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isAllDay
                        ? "All day"
                        : startTime && endTime
                          ? `${format(startTime, "h:mm a")} – ${format(endTime, "h:mm a")}`
                          : ""}
                    </p>
                  </div>
                  {event.location && (
                    <span className="hidden max-w-[200px] shrink-0 truncate text-xs text-muted-foreground/60 sm:block">
                      {event.location}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
