"use client";

import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from "react";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  format,
  isToday,
  eachDayOfInterval,
  endOfWeek,
  isSameDay,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIMEZONE } from "@/lib/constants";
import type { Shift } from "@/generated/prisma/client";
import { SHIFT_LOCATIONS, getShiftLocation, shiftLocationLabel, shiftLocationShort } from "@/config/shifts";

const HOUR_HEIGHT = 48;
const START_HOUR = 6;
const END_HOUR = 23;
const WEEK_STARTS_ON = 1; // Monday

const SM_BREAKPOINT = 640;
function subscribeToWidth(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
function getIsMobile() {
  return typeof window !== "undefined" ? window.innerWidth < SM_BREAKPOINT : false;
}
function useIsMobile() {
  return useSyncExternalStore(subscribeToWidth, getIsMobile, () => false);
}

interface ShiftWeekViewProps {
  shifts: Shift[];
  onEditShift: (shift: Shift) => void;
  mobileFilter?: "week" | "day";
  selectedDay?: Date | null;
  onSelectDay?: (day: Date | null) => void;
}

function getShiftsForDay(shifts: Shift[], day: Date): Shift[] {
  return shifts.filter((s) => {
    const shiftDate = new Date(s.date);
    return isSameDay(shiftDate, day);
  });
}

function getShiftMinutes(shift: Shift): { startMin: number; endMin: number } {
  const start = new Date(shift.startTime);
  const end = new Date(shift.endTime);
  const startLocal = formatInTimeZone(start, TIMEZONE, "H:mm").split(":");
  const endLocal = formatInTimeZone(end, TIMEZONE, "H:mm").split(":");
  const startMin = parseInt(startLocal[0]!, 10) * 60 + parseInt(startLocal[1]!, 10);
  const endMin = parseInt(endLocal[0]!, 10) * 60 + parseInt(endLocal[1]!, 10);
  return { startMin, endMin: endMin > startMin ? endMin : startMin + 60 };
}

// ─── Mobile: list view ───

function MobileShiftView({ shifts, onEditShift, mobileFilter, selectedDay, onSelectDay }: ShiftWeekViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekShifts = useMemo(() => {
    return shifts.filter((s) => {
      const d = new Date(s.date);
      return d >= weekStart && d <= weekEnd;
    });
  }, [shifts, weekStart, weekEnd]);

  // Filter to selected day if in day mode
  const displayShifts = useMemo(() => {
    if (mobileFilter === "day" && selectedDay) {
      return weekShifts.filter((s) => isSameDay(new Date(s.date), selectedDay));
    }
    return weekShifts;
  }, [weekShifts, mobileFilter, selectedDay]);

  const displayHours = displayShifts.reduce((sum, s) => sum + s.hours, 0);
  const displayNet = displayShifts.reduce((sum, s) => sum + s.netPay, 0);

  // Sort shifts by date then start time
  const sortedShifts = useMemo(() => {
    return [...displayShifts].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [displayShifts]);

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-primary">
          {format(weekStart, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week strip */}
      <div className="flex justify-between px-2">
        {days.map((day) => {
          const hasShift = getShiftsForDay(weekShifts, day).length > 0;
          const today = isToday(day);
          const isSelected = mobileFilter === "day" && selectedDay && isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              className="flex flex-col items-center gap-0.5"
              onClick={() => {
                if (isSelected) {
                  onSelectDay?.(null);
                } else {
                  onSelectDay?.(day);
                }
              }}
            >
              <span className={cn(
                "text-[11px] font-medium uppercase",
                today ? "text-primary" : isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {format(day, "EEEEE")}
              </span>
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                today && !isSelected && "bg-primary text-primary-foreground",
                isSelected && "bg-foreground text-background",
                !today && !isSelected && "text-foreground",
              )}>
                {format(day, "d")}
              </span>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                hasShift ? "bg-primary" : "bg-transparent"
              )} />
            </button>
          );
        })}
      </div>

      {/* My Hours summary */}
      <div className="flex items-center justify-between rounded-lg bg-card/80 px-4 py-2.5 border border-border/50">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          My Hours
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-medium">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {displayHours.toFixed(1)}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-400">
            <DollarSign className="h-3.5 w-3.5" />
            {displayNet.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Shift list */}
      {sortedShifts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {mobileFilter === "day" ? "No shifts today" : "No shifts this week"}
        </p>
      ) : (
        <div className="space-y-2">
          {sortedShifts.map((shift) => {
            const locColor = getShiftLocation(shift.location).borderClass;
            const locLabel = shiftLocationLabel(shift.location);
            const shiftDate = new Date(shift.date);
            return (
              <button
                key={shift.id}
                onClick={() => onEditShift(shift)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent/80"
              >
                {/* Day label */}
                <div className="flex w-12 shrink-0 flex-col items-center pt-0.5">
                  <span className="text-[11px] font-bold uppercase text-primary">
                    {formatInTimeZone(shiftDate, TIMEZONE, "EEE")}
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {formatInTimeZone(shiftDate, TIMEZONE, "d")}
                  </span>
                </div>

                {/* Color bar + details */}
                <div className={cn(
                  "flex flex-1 flex-col gap-0.5 border-l-[3px] pl-3",
                  locColor
                )}>
                  <p className="text-sm font-medium text-foreground">
                    {shift.label ?? locLabel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatInTimeZone(new Date(shift.startTime), TIMEZONE, "HH:mm")}
                    {" - "}
                    {formatInTimeZone(new Date(shift.endTime), TIMEZONE, "HH:mm")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locLabel}
                    {" · "}
                    {shift.hours}h
                    {" · "}
                    <span className="text-emerald-400">${shift.netPay.toFixed(2)}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        {SHIFT_LOCATIONS.map((loc) => (
          <span key={loc.key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", loc.dotClass)} />
            {loc.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Desktop: Time grid view ───

function DesktopShiftView({ shifts, onEditShift }: ShiftWeekViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const weekShifts = useMemo(() => {
    return shifts.filter((s) => {
      const d = new Date(s.date);
      return d >= weekStart && d <= weekEnd;
    });
  }, [shifts, weekStart, weekEnd]);

  const weekHours = weekShifts.reduce((sum, s) => sum + s.hours, 0);
  const weekNet = weekShifts.reduce((sum, s) => sum + s.netPay, 0);

  useEffect(() => {
    if (didScroll.current || !scrollRef.current) return;
    didScroll.current = true;

    let scrollToHour = 7;
    if (weekShifts.length > 0) {
      const earliest = weekShifts.reduce((min, s) => {
        const { startMin } = getShiftMinutes(s);
        return startMin < min ? startMin : min;
      }, Infinity);
      scrollToHour = Math.max(START_HOUR, Math.floor(earliest / 60) - 1);
    }

    const top = ((scrollToHour - START_HOUR) / 1) * HOUR_HEIGHT;
    scrollRef.current.scrollTop = top;
  }, [weekShifts]);

  return (
    <div className="space-y-3">
      {/* Week nav + stats */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium text-foreground">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {weekHours.toFixed(1)}h
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <DollarSign className="h-3 w-3" />
              ${weekNet.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const dayShifts = getShiftsForDay(weekShifts, day);
          const dayHours = dayShifts.reduce((sum, s) => sum + s.hours, 0);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 border-l border-border px-1 py-1.5 text-center",
                today && "bg-accent/20"
              )}
            >
              <p className={cn(
                "text-[11px] font-medium uppercase",
                today ? "text-primary" : "text-muted-foreground"
              )}>
                {format(day, "EEE")}
              </p>
              <p className={cn(
                "text-sm font-semibold",
                today ? "text-primary" : "text-foreground"
              )}>
                {format(day, "d")}
              </p>
              {dayHours > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {dayHours.toFixed(1)}h
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        ref={scrollRef}
        className="max-h-[calc(100vh-22rem)] overflow-y-auto overflow-x-auto"
      >
        <div className="relative flex min-w-[600px]">
          {/* Time labels */}
          <div className="w-14 shrink-0">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative border-b border-border/50"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground/60">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayShifts = getShiftsForDay(weekShifts, day);
            const dayIsToday = isToday(day);
            const nowLineTop = dayIsToday
              ? ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
              : -1;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative flex-1 border-l border-border",
                  dayIsToday && "bg-accent/20"
                )}
              >
                {hours.map((hour) => {
                  const hourEnd = hour * 60 + 60;
                  const isPast = dayIsToday && hourEnd <= nowMinutes;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "border-b border-border/50",
                        isPast && "bg-muted/30"
                      )}
                      style={{ height: HOUR_HEIGHT }}
                    />
                  );
                })}

                {dayIsToday &&
                  nowLineTop >= 0 &&
                  nowLineTop <= (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-20"
                      style={{ top: nowLineTop }}
                    >
                      <div className="flex items-center">
                        <div className="-ml-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                        <div className="h-[2px] flex-1 bg-red-500" />
                      </div>
                    </div>
                  )}

                {dayShifts.map((shift) => {
                  const { startMin, endMin } = getShiftMinutes(shift);
                  const top =
                    ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height =
                    ((endMin - startMin) / 60) * HOUR_HEIGHT;
                  const renderedHeight = Math.max(HOUR_HEIGHT / 2, height);
                  const isCompact = renderedHeight < HOUR_HEIGHT * 0.75;
                  const locStyle = getShiftLocation(shift.location).blockClass;

                  return (
                    <button
                      key={shift.id}
                      onClick={() => onEditShift(shift)}
                      className={cn(
                        "absolute left-1 right-1 cursor-pointer overflow-hidden rounded border-l-[3px] px-1.5 text-left transition-opacity hover:opacity-80",
                        isCompact ? "flex items-center gap-1 py-0" : "py-1",
                        locStyle
                      )}
                      style={{
                        top: Math.max(0, top),
                        height: renderedHeight,
                      }}
                    >
                      {isCompact ? (
                        <p className="truncate text-xs leading-tight">
                          <span className="opacity-80">
                            {formatInTimeZone(new Date(shift.startTime), TIMEZONE, "h:mm a")}
                          </span>
                          {" "}{shiftLocationShort(shift.location)}
                        </p>
                      ) : (
                        <>
                          <p className="truncate text-xs font-semibold leading-tight">
                            {shiftLocationLabel(shift.location)}
                          </p>
                          <p className="truncate text-[11px] leading-tight opacity-80">
                            {formatInTimeZone(new Date(shift.startTime), TIMEZONE, "h:mm a")}
                            {" – "}
                            {formatInTimeZone(new Date(shift.endTime), TIMEZONE, "h:mm a")}
                          </p>
                          {renderedHeight >= HOUR_HEIGHT * 1.5 && (
                            <p className="mt-0.5 text-[11px] leading-tight opacity-60">
                              {shift.hours}h · ${shift.netPay.toFixed(2)}
                            </p>
                          )}
                          {shift.label && renderedHeight >= HOUR_HEIGHT * 2 && (
                            <p className="truncate text-[10px] leading-tight opacity-50">
                              {shift.label}
                            </p>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        {SHIFT_LOCATIONS.map((loc) => (
          <span key={loc.key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", loc.dotClass)} />
            {loc.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component: switches between mobile and desktop ───

export function ShiftWeekView({ shifts, onEditShift, mobileFilter, selectedDay, onSelectDay }: ShiftWeekViewProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileShiftView shifts={shifts} onEditShift={onEditShift} mobileFilter={mobileFilter} selectedDay={selectedDay} onSelectDay={onSelectDay} />;
  }
  return <DesktopShiftView shifts={shifts} onEditShift={onEditShift} />;
}
