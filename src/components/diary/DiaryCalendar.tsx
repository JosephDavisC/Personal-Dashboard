"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMoodIcon } from "./MoodPicker";

interface CalendarDate {
  date: string;
  mood: string | null;
}

interface DiaryCalendarProps {
  onSelectDate: (date: string) => void;
}

const MOOD_DOT_COLORS: Record<string, string> = {
  happy: "bg-green-400",
  good: "bg-emerald-400",
  neutral: "bg-yellow-400",
  tired: "bg-blue-400",
  sad: "bg-purple-400",
  stressed: "bg-orange-400",
  angry: "bg-red-400",
  excited: "bg-pink-400",
};

export function DiaryCalendar({ onSelectDate }: DiaryCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const { data } = useQuery<CalendarDate[]>({
    queryKey: ["diary-calendar", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/diary/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return ((await res.json()) as { data: CalendarDate[] }).data;
    },
  });

  const entryMap = useMemo(() => {
    const map = new Map<string, string | null>();
    if (data) {
      for (const d of data) {
        map.set(d.date, d.mood);
      }
    }
    return map;
  }, [data]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="min-w-[180px] text-center font-heading text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, today);
          const hasEntry = entryMap.has(dateStr);
          const mood = entryMap.get(dateStr);
          const moodInfo = getMoodIcon(mood);
          const dotColor = mood ? (MOOD_DOT_COLORS[mood] ?? "bg-emerald-400") : "bg-emerald-400";

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-lg p-3 sm:p-4 text-sm sm:text-base transition-colors min-h-[60px] sm:min-h-[80px] ${
                !isCurrentMonth
                  ? "text-muted-foreground/30"
                  : isToday
                    ? "ring-2 ring-primary/30 bg-primary/10 text-primary font-semibold"
                    : hasEntry
                      ? "bg-muted/30 text-foreground hover:bg-muted/50"
                      : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="font-medium">{format(day, "d")}</span>
              {hasEntry && isCurrentMonth && (
                <span className="mt-1 flex items-center justify-center leading-none">
                  {moodInfo ? (
                    <moodInfo.Icon className={`h-4 w-4 ${moodInfo.color}`} />
                  ) : (
                    <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Click any date to view or create an entry
      </p>
    </div>
  );
}
