"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GoogleCalendar } from "@/lib/google-calendar";
import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";

export function CalendarSidebar() {
  const { data: calendars = [], isLoading } = useQuery<GoogleCalendar[]>({
    queryKey: ["calendars"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/list");
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const json = (await res.json()) as { data: GoogleCalendar[] };
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { isVisible, toggleCalendar, initializeFrom } = useCalendarVisibility();

  useEffect(() => {
    if (calendars.length > 0) {
      initializeFrom(calendars.map((c) => c.id));
    }
  }, [calendars, initializeFrom]);

  const myCalendars = calendars.filter((c) => c.accessRole === "owner");
  const otherCalendars = calendars.filter((c) => c.accessRole !== "owner");

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto">
      <CalendarGroup
        label="My calendars"
        calendars={myCalendars}
        isVisible={isVisible}
        onToggle={toggleCalendar}
      />
      {otherCalendars.length > 0 && (
        <CalendarGroup
          label="Other calendars"
          calendars={otherCalendars}
          isVisible={isVisible}
          onToggle={toggleCalendar}
        />
      )}
    </div>
  );
}

function CalendarGroup({
  label,
  calendars,
  isVisible,
  onToggle,
}: {
  label: string;
  calendars: GoogleCalendar[];
  isVisible: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent/30 active:bg-accent/40"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
      {open && (
        <div className="space-y-0.5 pl-1">
          {calendars.map((cal) => (
            <label
              key={cal.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/20 active:bg-accent/30"
              )}
            >
              <input
                type="checkbox"
                checked={isVisible(cal.id)}
                onChange={() => onToggle(cal.id)}
                className="h-4 w-4 rounded border-border accent-current"
                style={{ accentColor: cal.backgroundColor }}
              />
              <div
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="flex-1 truncate text-sm text-foreground">
                {cal.summary}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
