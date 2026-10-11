"use client";

import { useMemo, useEffect, useRef } from "react";
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  parseISO,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { getEventColor, getColorHex, getEventsForDay } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/lib/google-calendar";

const WEEK_STARTS_ON = 1;

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  scrollKey?: number;
}

export function AgendaView({ currentDate, events, onSelectEvent, scrollKey }: AgendaViewProps) {
  const todayRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  // Auto-scroll to today on mount
  useEffect(() => {
    if (didAutoScroll.current) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      didAutoScroll.current = true;
    }
  }, [events]);

  // Scroll to today when "Today" button is clicked
  useEffect(() => {
    if (scrollKey && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollKey]);
  const days = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const groupedEvents = useMemo(() => {
    return days.map((day) => ({
      day,
      events: getEventsForDay(events, day).sort((a, b) => {
        const aTime = a.start.dateTime ? parseISO(a.start.dateTime).getTime() : 0;
        const bTime = b.start.dateTime ? parseISO(b.start.dateTime).getTime() : 0;
        return aTime - bTime;
      }),
    }));
  }, [days, events]);

  return (
    <Card className="divide-y divide-border overflow-hidden border-border bg-card/50">
      {groupedEvents.map(({ day, events: dayEvents }) => (
        <div key={day.toISOString()} ref={isToday(day) ? todayRef : undefined}>
          <div
            className={cn(
              "sticky top-0 z-10 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur-sm",
              isToday(day) && "bg-accent/30"
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold",
                isToday(day) ? "text-primary" : "text-foreground"
              )}
            >
              {isToday(day)
                ? "Today"
                : isTomorrow(day)
                  ? "Tomorrow"
                  : format(day, "EEEE")}
              <span className="ml-2 font-normal text-muted-foreground">
                {format(day, "MMM d")}
              </span>
            </p>
          </div>

          {dayEvents.length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground/60">No events</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {dayEvents.map((event) => (
                <AgendaEventRow
                  key={event.id}
                  event={event}
                  onSelect={onSelectEvent}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

function AgendaEventRow({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: (e: CalendarEvent) => void;
}) {
  const isAllDay = !event.start.dateTime;
  const start = event.start.dateTime ? parseISO(event.start.dateTime) : null;
  const end = event.end.dateTime ? parseISO(event.end.dateTime) : null;
  const color = getEventColor(event.colorId);
  const eventPast = end ? isPast(end) : start ? isPast(start) : false;

  return (
    <button
      onClick={() => onSelect(event)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/20 active:bg-accent/30",
        eventPast && "opacity-40"
      )}
    >
      <div className="w-14 shrink-0 pt-0.5 text-right">
        {isAllDay ? (
          <span className="text-xs font-medium text-muted-foreground">
            All day
          </span>
        ) : (
          <div>
            <p className="text-xs font-medium text-foreground">
              {start ? format(start, "HH:mm") : ""}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {end ? format(end, "HH:mm") : ""}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", !event.colorId && color.bg)}
        style={
          event.colorId
            ? { backgroundColor: getColorHex(event.colorId) }
            : undefined
        }
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {event.summary || "(No title)"}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        )}
      </div>
    </button>
  );
}
