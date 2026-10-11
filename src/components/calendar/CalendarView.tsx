"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  format,
  isToday,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Clock, ExternalLink, Video, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getEventColor, getColorHex, getEventTime, getEventsForDay, layoutOverlappingEvents } from "@/lib/calendar-utils";
import type { CalendarEvent, GoogleCalendar } from "@/lib/google-calendar";
import { EventForm, type EventFormData } from "./EventForm";
import { AgendaView } from "./AgendaView";
import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";
import { useIsMobile } from "@/hooks/useIsMobile";

type ViewMode = "day" | "week" | "month" | "agenda";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").trim();
}

const WEEK_STARTS_ON = 1; // Monday

export function CalendarView({ initialDate, highlightTime }: { initialDate?: Date; highlightTime?: string } = {}) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(initialDate ?? new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [didAutoSelect, setDidAutoSelect] = useState(false);

  useEffect(() => {
    if (isMobile && viewMode === "week") {
      setViewMode("day");
    }
  }, [isMobile, viewMode]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | null>(null);
  const [formDefaultHour, setFormDefaultHour] = useState<number | null>(null);
  const [formDefaultMinute, setFormDefaultMinute] = useState<number | null>(null);
  const [formDefaultEndHour, setFormDefaultEndHour] = useState<number | null>(null);
  const [formDefaultEndMinute, setFormDefaultEndMinute] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scrollKey, setScrollKey] = useState(0);

  const range = getDateRange(currentDate, viewMode);

  useQuery<GoogleCalendar[]>({
    queryKey: ["calendars"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/list");
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const json = (await res.json()) as { data: GoogleCalendar[] };
      return json.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { visibleCalendarIds } = useCalendarVisibility();
  const visibleIds = Array.from(visibleCalendarIds);

  const eventQueries = useQueries({
    queries: (visibleIds.length > 0 ? visibleIds : ["primary"]).map(
      (calendarId) => ({
        queryKey: ["calendar-events", calendarId, range.start, range.end],
        queryFn: async () => {
          const params = new URLSearchParams({
            start: range.start,
            end: range.end,
            calendarId,
          });
          const res = await fetch(`/api/calendar?${params.toString()}`);
          if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            throw new Error(body.error ?? "Failed to fetch events");
          }
          const json = (await res.json()) as { data: CalendarEvent[] };
          return json.data;
        },
        // One bad calendar must not hold the whole page in loading
        // through the default 3-retry backoff
        retry: 1,
      })
    ),
  });

  const events = useMemo(() => {
    const all = eventQueries.flatMap((q) => q.data ?? []);
    const seen = new Set<string>();
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [eventQueries]);

  const isLoading = eventQueries.some((q) => q.isLoading);

  // Auto-select event matching highlightTime from shifts page
  useEffect(() => {
    if (!highlightTime || didAutoSelect || isLoading || events.length === 0) return;
    const target = new Date(highlightTime).getTime();
    const match = events.find((e) => {
      if (!e.start.dateTime) return false;
      return new Date(e.start.dateTime).getTime() === target;
    });
    if (match) {
      setSelectedEvent(match);
      setDidAutoSelect(true);
    }
  }, [highlightTime, didAutoSelect, isLoading, events]);

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create event");
      }
      return ((await res.json()) as { data: CalendarEvent }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event created");
    },
    onError: () => {
      toast.error("Failed to create event");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: EventFormData;
    }) => {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to update event");
      }
      return ((await res.json()) as { data: CalendarEvent }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setSelectedEvent(null);
      toast.success("Event updated");
    },
    onError: () => {
      toast.error("Failed to update event");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setSelectedEvent(null);
      toast.success("Event deleted");
    },
    onError: () => {
      toast.error("Failed to delete event");
    },
  });

  const dragTimeMutation = useMutation({
    mutationFn: async ({ id, startDateTime, endDateTime }: { id: string; startDateTime: string; endDateTime: string }) => {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDateTime, endDateTime, allDay: false }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to update event");
      }
      return ((await res.json()) as { data: CalendarEvent }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: () => {
      toast.error("Failed to move event");
    },
  });

  function handleEventTimeChange(eventId: string, newStart: Date, newEnd: Date) {
    dragTimeMutation.mutate({
      id: eventId,
      startDateTime: newStart.toISOString(),
      endDateTime: newEnd.toISOString(),
    });
  }

  function handleCreate(
    date?: Date,
    hour?: number,
    minute?: number,
    endHour?: number,
    endMinute?: number,
  ) {
    setEditingEvent(null);
    setFormDefaultDate(date ?? null);
    setFormDefaultHour(hour ?? null);
    setFormDefaultMinute(minute ?? null);
    setFormDefaultEndHour(endHour ?? null);
    setFormDefaultEndMinute(endMinute ?? null);
    setFormOpen(true);
  }

  function handleEdit(event: CalendarEvent) {
    setEditingEvent(event);
    setFormDefaultDate(null);
    setFormDefaultHour(null);
    setFormOpen(true);
  }

  function handleFormSubmit(data: EventFormData) {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleDelete(eventId: string) {
    setDeleteConfirmId(eventId);
  }

  function confirmDelete() {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }

  function navigateBack() {
    setCurrentDate((d) =>
      viewMode === "day" ? subDays(d, 1) : viewMode === "month" ? subMonths(d, 1) : subWeeks(d, 1)
    );
  }

  function navigateForward() {
    setCurrentDate((d) =>
      viewMode === "day" ? addDays(d, 1) : viewMode === "month" ? addMonths(d, 1) : addWeeks(d, 1)
    );
  }

  function goToToday() {
    setCurrentDate(new Date());
    setScrollKey((k) => k + 1);
  }

  const dateHeading = viewMode === "day"
    ? format(currentDate, "EEEE, MMM d, yyyy")
    : viewMode === "month"
    ? format(currentDate, "MMMM yyyy")
    : `${format(
        startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON }),
        "MMM d"
      )} – ${format(
        endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON }),
        "MMM d, yyyy"
      )}`;

  return (
    <div className="flex h-full flex-col">
      {/* Desktop toolbar */}
      <div className="hidden shrink-0 pb-4 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={navigateBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[200px] text-center text-lg font-semibold text-foreground">
            {dateHeading}
          </h2>
          <Button variant="ghost" size="icon" onClick={navigateForward}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleCreate()}>
            <Plus className="mr-1 h-3 w-3" />
            New Event
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex rounded-md border border-border">
            <Button
              variant={viewMode === "day" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode("day")}
            >
              Day
            </Button>
            <Button
              variant={viewMode === "week" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-x border-border"
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-x border-border"
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              variant={viewMode === "agenda" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode("agenda")}
            >
              Agenda
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile toolbar */}
      <div className="shrink-0 space-y-3 pb-4 sm:hidden">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={navigateBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-semibold text-foreground">
            {dateHeading}
          </h2>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={navigateForward}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCreate()}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New
          </Button>
          <div className="ml-auto flex rounded-md border border-border">
            <Button
              variant={viewMode === "day" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none px-2.5"
              onClick={() => setViewMode("day")}
            >
              Day
            </Button>
            <Button
              variant={viewMode === "agenda" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none border-x border-border px-2.5"
              onClick={() => setViewMode("agenda")}
            >
              Agenda
            </Button>
            <Button
              variant={viewMode === "month" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none px-2.5"
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <CalendarSkeleton />
        ) : viewMode === "agenda" ? (
          <AgendaView
            currentDate={currentDate}
            events={events}
            onSelectEvent={setSelectedEvent}
            scrollKey={scrollKey}
          />
        ) : viewMode === "day" ? (
          <DayView
            currentDate={currentDate}
            events={events}
            onSelectEvent={setSelectedEvent}
            onSlotClick={handleCreate}
            onEventTimeChange={handleEventTimeChange}
            isMobile={isMobile}
          />
        ) : viewMode === "week" ? (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSelectEvent={setSelectedEvent}
            onSlotClick={handleCreate}
            onEventTimeChange={handleEventTimeChange}
            isMobile={isMobile}
          />
        ) : (
          <MonthView
            currentDate={currentDate}
            events={events}
            onSelectEvent={setSelectedEvent}
            onDayClick={(day) => handleCreate(day)}
          />
        )}
      </div>

      <EventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EventForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        event={editingEvent}
        defaultDate={formDefaultDate}
        defaultHour={formDefaultHour}
        defaultMinute={formDefaultMinute}
        defaultEndHour={formDefaultEndHour}
        defaultEndMinute={formDefaultEndMinute}
      />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
      >
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getDateRange(date: Date, mode: ViewMode) {
  if (mode === "day") {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (mode === "week" || mode === "agenda") {
    const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start: start.toISOString(), end: end.toISOString() };
}


const HOUR_HEIGHT = 48;
const START_HOUR = 0;
const END_HOUR = 24;

function useCurrentMinutes() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface DragState {
  active: boolean;
  dayIndex: number;
  startMinutes: number;
  currentMinutes: number;
}

function roundTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function minutesFromY(y: number, containerTop: number): number {
  const offset = y - containerTop;
  const minutes = START_HOUR * 60 + (offset / HOUR_HEIGHT) * 60;
  return roundTo15(Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, minutes)));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

interface EventDragState {
  type: "move" | "resize";
  active: boolean;
  eventId: string;
  dayIndex: number;
  originalStartMin: number;
  originalEndMin: number;
  grabOffsetMin: number;
  currentMinutes: number;
}

function WeekView({
  currentDate,
  events,
  onSelectEvent,
  onSlotClick,
  onEventTimeChange,
  isMobile,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number, minute?: number, endHour?: number, endMinute?: number) => void;
  onEventTimeChange: (eventId: string, newStart: Date, newEnd: Date) => void;
  isMobile: boolean;
}) {
  const now = useCurrentMinutes();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(currentDate, { weekStartsOn: WEEK_STARTS_ON }),
  });

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  // Drag-to-create state
  const [drag, setDrag] = useState<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mouseDownTime = useRef(0);
  const mouseDownY = useRef(0);
  const didAutoScroll = useRef(false);

  // Auto-scroll to first event or current time
  useEffect(() => {
    if (didAutoScroll.current) return;

    // Find earliest timed event across visible days
    let earliestMinutes = Infinity;
    for (const day of days) {
      const dayEvents = getEventsForDay(events, day).filter(e => e.start.dateTime);
      for (const event of dayEvents) {
        const { start } = getEventTime(event);
        const min = start.getHours() * 60 + start.getMinutes();
        if (min < earliestMinutes) earliestMinutes = min;
      }
    }

    // For today, also consider current time
    const hasToday = days.some(d => isToday(d));
    if (hasToday) {
      const current = nowMinutes - 60;
      if (current < earliestMinutes) earliestMinutes = current;
    }

    if (earliestMinutes === Infinity) earliestMinutes = 8 * 60;
    const targetHour = Math.max(START_HOUR, Math.floor(Math.max(0, earliestMinutes - 60) / 60));

    // Use scrollIntoView on the target hour element (works regardless of which ancestor scrolls)
    const el = gridRef.current?.querySelector(`[data-hour="${targetHour}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      didAutoScroll.current = true;
    }
  }, [events, days, nowMinutes]);

  // Reset auto-scroll when date changes
  useEffect(() => {
    didAutoScroll.current = false;
  }, [currentDate]);

  // Event drag state (move/resize existing events)
  const [eventDrag, setEventDrag] = useState<EventDragState | null>(null);
  const eventDragDidDrag = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    // Disable drag-to-create on mobile
    if (isMobile) return;
    // Only left mouse button
    if (e.button !== 0) return;
    // Skip if clicking on an event button
    if ((e.target as HTMLElement).closest("button[data-event]")) return;

    const gridEl = gridRef.current;
    if (!gridEl) return;

    const rect = gridEl.getBoundingClientRect();
    const minutes = minutesFromY(e.clientY, rect.top);

    mouseDownTime.current = Date.now();
    mouseDownY.current = e.clientY;

    setDrag({
      active: false,
      dayIndex,
      startMinutes: minutes,
      currentMinutes: minutes,
    });
  }, [isMobile]);

  useEffect(() => {
    if (!drag) return;

    function handleMouseMove(e: MouseEvent) {
      const gridEl = gridRef.current;
      if (!gridEl) return;

      const rect = gridEl.getBoundingClientRect();
      const minutes = minutesFromY(e.clientY, rect.top);
      const distance = Math.abs(e.clientY - mouseDownY.current);

      setDrag((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          active: prev.active || distance > 8,
          currentMinutes: minutes,
        };
      });
    }

    function handleMouseUp(e: MouseEvent) {
      // Read drag from closure (kept current by useEffect dependency)
      if (!drag) return;

      const elapsed = Date.now() - mouseDownTime.current;
      const distance = Math.abs(e.clientY - mouseDownY.current);
      const day = days[drag.dayIndex]!;

      // Clear drag first, then trigger parent state updates
      setDrag(null);

      if (drag.active && (elapsed > 200 || distance > 8)) {
        // Drag: open form with range
        const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
        const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
        const finalEnd = endMin === startMin ? startMin + 60 : endMin;

        onSlotClick(
          day,
          Math.floor(startMin / 60),
          startMin % 60,
          Math.floor(finalEnd / 60),
          finalEnd % 60,
        );
      } else {
        // Click: open form at that hour
        const hour = Math.floor(drag.startMinutes / 60);
        onSlotClick(day, hour);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drag, days, onSlotClick]);

  // Compute drag preview position
  const dragPreview = drag?.active ? (() => {
    const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(HOUR_HEIGHT / 4, ((endMin - startMin) / 60) * HOUR_HEIGHT);
    return {
      dayIndex: drag.dayIndex,
      top,
      height,
      label: `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)} – ${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`,
    };
  })() : null;

  // Event move/resize handlers
  const handleEventMoveStart = useCallback((e: React.MouseEvent, event: CalendarEvent, dayIndex: number) => {
    if (isMobile || e.button !== 0) return;
    e.stopPropagation();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const mouseMin = minutesFromY(e.clientY, rect.top);
    const { start, end } = getEventTime(event);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    mouseDownY.current = e.clientY;
    eventDragDidDrag.current = false;
    setEventDrag({
      type: "move", active: false, eventId: event.id, dayIndex,
      originalStartMin: startMin, originalEndMin: endMin,
      grabOffsetMin: mouseMin - startMin, currentMinutes: mouseMin,
    });
  }, [isMobile]);

  const handleEventResizeStart = useCallback((e: React.MouseEvent, event: CalendarEvent, dayIndex: number) => {
    if (isMobile || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const mouseMin = minutesFromY(e.clientY, rect.top);
    const { start, end } = getEventTime(event);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    mouseDownY.current = e.clientY;
    eventDragDidDrag.current = true; // resize activates immediately
    setEventDrag({
      type: "resize", active: true, eventId: event.id, dayIndex,
      originalStartMin: startMin, originalEndMin: endMin,
      grabOffsetMin: 0, currentMinutes: mouseMin,
    });
  }, [isMobile]);

  useEffect(() => {
    if (!eventDrag) return;
    function handleMouseMove(e: MouseEvent) {
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const minutes = minutesFromY(e.clientY, rect.top);
      const distance = Math.abs(e.clientY - mouseDownY.current);
      if (distance > 8) eventDragDidDrag.current = true;
      setEventDrag((prev) => prev ? { ...prev, active: prev.active || distance > 8, currentMinutes: minutes } : null);
    }
    function handleMouseUp() {
      if (!eventDrag || !eventDragDidDrag.current) {
        setEventDrag(null);
        return;
      }
      let newStartMin: number;
      let newEndMin: number;
      if (eventDrag.type === "move") {
        const targetStart = eventDrag.currentMinutes - eventDrag.grabOffsetMin;
        newStartMin = roundTo15(targetStart);
        const duration = eventDrag.originalEndMin - eventDrag.originalStartMin;
        newEndMin = newStartMin + duration;
        if (newStartMin < START_HOUR * 60) { newStartMin = START_HOUR * 60; newEndMin = newStartMin + duration; }
        if (newEndMin > END_HOUR * 60) { newEndMin = END_HOUR * 60; newStartMin = newEndMin - duration; }
      } else {
        newStartMin = eventDrag.originalStartMin;
        newEndMin = roundTo15(Math.max(eventDrag.originalStartMin + 15, eventDrag.currentMinutes));
        newEndMin = Math.min(END_HOUR * 60, newEndMin);
      }
      const day = days[eventDrag.dayIndex]!;
      const newStart = new Date(day);
      newStart.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);
      const newEnd = new Date(day);
      newEnd.setHours(Math.floor(newEndMin / 60), newEndMin % 60, 0, 0);
      onEventTimeChange(eventDrag.eventId, newStart, newEnd);
      setEventDrag(null);
      // Prevent click from firing after drag
      setTimeout(() => { eventDragDidDrag.current = false; }, 0);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [eventDrag, days, onEventTimeChange]);

  // Compute event drag preview
  const eventDragPreview = eventDrag?.active ? (() => {
    let newStartMin: number;
    let newEndMin: number;
    if (eventDrag.type === "move") {
      const targetStart = eventDrag.currentMinutes - eventDrag.grabOffsetMin;
      newStartMin = roundTo15(targetStart);
      const duration = eventDrag.originalEndMin - eventDrag.originalStartMin;
      newEndMin = newStartMin + duration;
      if (newStartMin < START_HOUR * 60) { newStartMin = START_HOUR * 60; newEndMin = newStartMin + duration; }
      if (newEndMin > END_HOUR * 60) { newEndMin = END_HOUR * 60; newStartMin = newEndMin - duration; }
    } else {
      newStartMin = eventDrag.originalStartMin;
      newEndMin = roundTo15(Math.max(eventDrag.originalStartMin + 15, eventDrag.currentMinutes));
      newEndMin = Math.min(END_HOUR * 60, newEndMin);
    }
    const top = ((newStartMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(HOUR_HEIGHT / 2, ((newEndMin - newStartMin) / 60) * HOUR_HEIGHT);
    return {
      dayIndex: eventDrag.dayIndex, top, height,
      label: `${pad2(Math.floor(newStartMin / 60))}:${pad2(newStartMin % 60)} – ${pad2(Math.floor(newEndMin / 60))}:${pad2(newEndMin % 60)}`,
    };
  })() : null;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card/50">
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "flex-1 border-l border-border px-2 py-2 text-center",
              isToday(day) && "bg-accent/50"
            )}
          >
            <p className="text-xs uppercase text-muted-foreground">{format(day, "EEE")}</p>
            <p
              className={cn(
                "text-sm font-medium",
                isToday(day) ? "text-primary" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>

      {/* All day events row */}
      {(() => {
        const hasAllDay = days.some((day) =>
          getEventsForDay(events, day).some((e) => !e.start.dateTime)
        );
        if (!hasAllDay) return null;
        return (
          <div className="flex border-b border-border">
            <div className="flex w-14 shrink-0 items-center justify-center">
              <span className="text-[10px] text-muted-foreground/60">all day</span>
            </div>
            {days.map((day) => {
              const dayEvents = getEventsForDay(events, day).filter(
                (e) => !e.start.dateTime
              );
              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 border-l border-border p-1"
                >
                  {dayEvents.map((event) => {
                    const color = getEventColor(event.colorId);
                    return (
                      <button
                        key={event.id}
                        onClick={() => onSelectEvent(event)}
                        className={cn(
                          "mb-0.5 w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-xs font-medium text-foreground",
                          color.bg, color.hover
                        )}
                      >
                        {event.summary || "(No title)"}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={gridRef} className="relative flex">
          <div className="w-14 shrink-0">
            {hours.map((hour) => {
              const isPast = isToday(days[0]!) && hour * 60 + 60 <= nowMinutes;
              return (
                <div
                  key={hour}
                  data-hour={hour}
                  className={cn(
                    "relative border-b border-border/50",
                    isPast && "text-muted-foreground/40"
                  )}
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground/60">
                    {format(new Date(2000, 0, 1, hour % 24), "HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>

          {days.map((day, dayIndex) => {
            const dayTimedEvents = getEventsForDay(events, day).filter(
              (e) => !!e.start.dateTime
            );
            const layouted = layoutOverlappingEvents(dayTimedEvents);
            const dayIsToday = isToday(day);
            const nowLineTop = dayIsToday
              ? ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
              : -1;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative flex-1 border-l border-border select-none",
                  dayIsToday && "bg-accent/20"
                )}
                onMouseDown={(e) => handleMouseDown(e, dayIndex)}
              >
                {hours.map((hour) => {
                  const hourEnd = hour * 60 + 60;
                  const isPast = dayIsToday && hourEnd <= nowMinutes;
                  return (
                    <div
                      key={hour}
                      className={cn(
                        "cursor-crosshair border-b border-border/50 hover:bg-accent/30",
                        isPast && "bg-muted/30"
                      )}
                      style={{ height: HOUR_HEIGHT }}
                    />
                  );
                })}

                {/* Drag-to-create preview */}
                {dragPreview && dragPreview.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 z-30 rounded border-2 border-primary bg-primary/20"
                    style={{ top: dragPreview.top, height: dragPreview.height }}
                  >
                    <p className="px-1 text-xs font-medium text-primary">
                      {dragPreview.label}
                    </p>
                  </div>
                )}

                {/* Event drag preview */}
                {eventDragPreview && eventDragPreview.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 z-30 rounded border-2 border-primary bg-primary/20"
                    style={{ top: eventDragPreview.top, height: eventDragPreview.height }}
                  >
                    <p className="px-1 text-xs font-medium text-primary">
                      {eventDragPreview.label}
                    </p>
                  </div>
                )}

                {/* Current time indicator */}
                {dayIsToday && nowLineTop >= 0 && nowLineTop <= (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20"
                    style={{ top: nowLineTop }}
                  >
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 -ml-[5px] shrink-0 rounded-full bg-red-500" />
                      <div className="h-[2px] flex-1 bg-red-500" />
                    </div>
                  </div>
                )}

                {layouted.map(({ event, column, totalColumns }) => {
                  const { start, end } = getEventTime(event);
                  const startMinutes =
                    start.getHours() * 60 + start.getMinutes();
                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                  const top =
                    ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height =
                    ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                  const renderedHeight = Math.max(HOUR_HEIGHT / 2, height);
                  const isCompact = renderedHeight < HOUR_HEIGHT * 0.7;
                  const isDragging = eventDrag?.active && eventDrag.eventId === event.id;

                  const color = getEventColor(event.colorId);
                  const widthPercent = 100 / totalColumns;
                  const leftPercent = column * widthPercent;

                  return (
                    <button
                      key={event.id}
                      data-event
                      onMouseDown={(e) => handleEventMoveStart(e, event, dayIndex)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (eventDragDidDrag.current) {
                          eventDragDidDrag.current = false;
                          return;
                        }
                        onSelectEvent(event);
                      }}
                      className={cn(
                        "absolute cursor-grab overflow-hidden rounded border-l-2 px-1 text-left transition-opacity",
                        isCompact ? "flex items-center gap-1 py-0" : "py-0.5",
                        color.bg, color.hover,
                        !event.colorId && "border-l-primary",
                        isDragging && "opacity-40",
                      )}
                      style={{
                        top: Math.max(0, top),
                        height: renderedHeight,
                        left: `calc(${leftPercent}% + 1px)`,
                        width: `calc(${widthPercent}% - 2px)`,
                        borderLeftColor: event.colorId
                          ? getColorHex(event.colorId)
                          : undefined,
                      }}
                    >
                      {isCompact ? (
                        <p className="truncate text-xs leading-tight text-foreground">
                          <span className="opacity-70">{format(start, "HH:mm")}</span>
                          {" "}{event.summary || "(No title)"}
                        </p>
                      ) : (
                        <>
                          <p className="truncate text-xs font-semibold leading-tight text-foreground">
                            {event.summary || "(No title)"}
                          </p>
                          <p className="truncate text-[11px] leading-tight text-foreground/70">
                            {format(start, "HH:mm")} – {format(end, "HH:mm")}
                          </p>
                          {event.location && renderedHeight >= HOUR_HEIGHT * 1.1 && (
                            <p className="truncate text-[11px] leading-tight text-foreground/50">
                              {event.location}
                            </p>
                          )}
                        </>
                      )}
                      {/* Resize handle at bottom */}
                      {!isMobile && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize"
                          onMouseDown={(e) => handleEventResizeStart(e, event, dayIndex)}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function DayView({
  currentDate,
  events,
  onSelectEvent,
  onSlotClick,
  onEventTimeChange,
  isMobile,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number, minute?: number, endHour?: number, endMinute?: number) => void;
  onEventTimeChange: (eventId: string, newStart: Date, newEnd: Date) => void;
  isMobile: boolean;
}) {
  const now = useCurrentMinutes();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const day = startOfDay(currentDate);
  const dayIsToday = isToday(day);

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mouseDownY = useRef(0);
  const didAutoScroll = useRef(false);
  const scrollTargetHour = useRef<number | null>(null);

  // Determine target scroll hour from events
  useEffect(() => {
    if (didAutoScroll.current) return;

    const dayEvents = getEventsForDay(events, day).filter(e => e.start.dateTime);
    let earliestMinutes = Infinity;
    for (const event of dayEvents) {
      const { start } = getEventTime(event);
      const min = start.getHours() * 60 + start.getMinutes();
      if (min < earliestMinutes) earliestMinutes = min;
    }

    if (dayIsToday) {
      const current = nowMinutes - 60;
      if (current < earliestMinutes) earliestMinutes = current;
    }

    if (earliestMinutes === Infinity) earliestMinutes = 8 * 60;
    // Scroll to 1 hour before the target
    const targetHour = Math.max(START_HOUR, Math.floor(Math.max(0, earliestMinutes - 60) / 60));
    scrollTargetHour.current = targetHour;

    // Use scrollIntoView on the target hour element (works regardless of which ancestor scrolls)
    const el = gridRef.current?.querySelector(`[data-hour="${targetHour}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      didAutoScroll.current = true;
    }
  }, [events, day, dayIsToday, nowMinutes]);

  // Reset auto-scroll when date changes
  useEffect(() => {
    didAutoScroll.current = false;
  }, [currentDate]);

  // Drag-to-create
  const [drag, setDrag] = useState<DragState | null>(null);
  const mouseDownTime = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button[data-event]")) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const minutes = minutesFromY(e.clientY, rect.top);
    mouseDownTime.current = Date.now();
    mouseDownY.current = e.clientY;
    setDrag({ active: false, dayIndex: 0, startMinutes: minutes, currentMinutes: minutes });
  }, [isMobile]);

  useEffect(() => {
    if (!drag) return;
    function handleMouseMove(e: MouseEvent) {
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const minutes = minutesFromY(e.clientY, rect.top);
      const distance = Math.abs(e.clientY - mouseDownY.current);
      setDrag((prev) => prev ? { ...prev, active: prev.active || distance > 8, currentMinutes: minutes } : null);
    }
    function handleMouseUp(e: MouseEvent) {
      if (!drag) return;
      const elapsed = Date.now() - mouseDownTime.current;
      const distance = Math.abs(e.clientY - mouseDownY.current);
      setDrag(null);
      if (drag.active && (elapsed > 200 || distance > 8)) {
        const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
        const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
        const finalEnd = endMin === startMin ? startMin + 60 : endMin;
        onSlotClick(day, Math.floor(startMin / 60), startMin % 60, Math.floor(finalEnd / 60), finalEnd % 60);
      } else {
        const hour = Math.floor(drag.startMinutes / 60);
        onSlotClick(day, hour);
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [drag, day, onSlotClick]);

  const dragPreview = drag?.active ? (() => {
    const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
    const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(HOUR_HEIGHT / 4, ((endMin - startMin) / 60) * HOUR_HEIGHT);
    return { top, height, label: `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)} – ${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}` };
  })() : null;

  // Event drag (move/resize)
  const [eventDrag, setEventDrag] = useState<EventDragState | null>(null);
  const eventDragDidDrag = useRef(false);

  const handleEventMoveStart = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (isMobile || e.button !== 0) return;
    e.stopPropagation();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const mouseMin = minutesFromY(e.clientY, rect.top);
    const { start, end } = getEventTime(event);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    mouseDownY.current = e.clientY;
    eventDragDidDrag.current = false;
    setEventDrag({ type: "move", active: false, eventId: event.id, dayIndex: 0, originalStartMin: startMin, originalEndMin: endMin, grabOffsetMin: mouseMin - startMin, currentMinutes: mouseMin });
  }, [isMobile]);

  const handleEventResizeStart = useCallback((e: React.MouseEvent, event: CalendarEvent) => {
    if (isMobile || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const mouseMin = minutesFromY(e.clientY, rect.top);
    const { start, end } = getEventTime(event);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    mouseDownY.current = e.clientY;
    eventDragDidDrag.current = true;
    setEventDrag({ type: "resize", active: true, eventId: event.id, dayIndex: 0, originalStartMin: startMin, originalEndMin: endMin, grabOffsetMin: 0, currentMinutes: mouseMin });
  }, [isMobile]);

  useEffect(() => {
    if (!eventDrag) return;
    function handleMouseMove(e: MouseEvent) {
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const minutes = minutesFromY(e.clientY, rect.top);
      const distance = Math.abs(e.clientY - mouseDownY.current);
      if (distance > 8) eventDragDidDrag.current = true;
      setEventDrag((prev) => prev ? { ...prev, active: prev.active || distance > 8, currentMinutes: minutes } : null);
    }
    function handleMouseUp() {
      if (!eventDrag || !eventDragDidDrag.current) { setEventDrag(null); return; }
      let newStartMin: number; let newEndMin: number;
      if (eventDrag.type === "move") {
        const targetStart = eventDrag.currentMinutes - eventDrag.grabOffsetMin;
        newStartMin = roundTo15(targetStart);
        const duration = eventDrag.originalEndMin - eventDrag.originalStartMin;
        newEndMin = newStartMin + duration;
        if (newStartMin < START_HOUR * 60) { newStartMin = START_HOUR * 60; newEndMin = newStartMin + duration; }
        if (newEndMin > END_HOUR * 60) { newEndMin = END_HOUR * 60; newStartMin = newEndMin - duration; }
      } else {
        newStartMin = eventDrag.originalStartMin;
        newEndMin = roundTo15(Math.max(eventDrag.originalStartMin + 15, eventDrag.currentMinutes));
        newEndMin = Math.min(END_HOUR * 60, newEndMin);
      }
      const newStart = new Date(day); newStart.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);
      const newEnd = new Date(day); newEnd.setHours(Math.floor(newEndMin / 60), newEndMin % 60, 0, 0);
      onEventTimeChange(eventDrag.eventId, newStart, newEnd);
      setEventDrag(null);
      setTimeout(() => { eventDragDidDrag.current = false; }, 0);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [eventDrag, day, onEventTimeChange]);

  const eventDragPreview = eventDrag?.active ? (() => {
    let newStartMin: number; let newEndMin: number;
    if (eventDrag.type === "move") {
      const targetStart = eventDrag.currentMinutes - eventDrag.grabOffsetMin;
      newStartMin = roundTo15(targetStart);
      const duration = eventDrag.originalEndMin - eventDrag.originalStartMin;
      newEndMin = newStartMin + duration;
      if (newStartMin < START_HOUR * 60) { newStartMin = START_HOUR * 60; newEndMin = newStartMin + duration; }
      if (newEndMin > END_HOUR * 60) { newEndMin = END_HOUR * 60; newStartMin = newEndMin - duration; }
    } else {
      newStartMin = eventDrag.originalStartMin;
      newEndMin = roundTo15(Math.max(eventDrag.originalStartMin + 15, eventDrag.currentMinutes));
      newEndMin = Math.min(END_HOUR * 60, newEndMin);
    }
    const top = ((newStartMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max(HOUR_HEIGHT / 2, ((newEndMin - newStartMin) / 60) * HOUR_HEIGHT);
    return { top, height, label: `${pad2(Math.floor(newStartMin / 60))}:${pad2(newStartMin % 60)} – ${pad2(Math.floor(newEndMin / 60))}:${pad2(newEndMin % 60)}` };
  })() : null;

  const dayTimedEvents = getEventsForDay(events, day).filter((e) => !!e.start.dateTime);
  const dayAllDayEvents = getEventsForDay(events, day).filter((e) => !e.start.dateTime);
  const layouted = layoutOverlappingEvents(dayTimedEvents);
  const nowLineTop = dayIsToday ? ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT : -1;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card/50">
      {/* All day events */}
      {dayAllDayEvents.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-[10px] text-muted-foreground/60">all day</span>
          <div className="flex flex-1 flex-wrap gap-1">
            {dayAllDayEvents.map((event) => {
              const color = getEventColor(event.colorId);
              return (
                <button
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={cn("cursor-pointer truncate rounded px-2 py-0.5 text-xs font-medium text-foreground", color.bg, color.hover)}
                >
                  {event.summary || "(No title)"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={gridRef} className="relative flex" onMouseDown={handleMouseDown}>
          <div className="w-14 shrink-0">
            {hours.map((hour) => {
              const isPast = dayIsToday && hour * 60 + 60 <= nowMinutes;
              return (
                <div key={hour} data-hour={hour} className={cn("relative border-b border-border/50", isPast && "text-muted-foreground/40")} style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground/60">
                    {format(new Date(2000, 0, 1, hour % 24), "HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={cn("relative flex-1 border-l border-border select-none", dayIsToday && "bg-accent/20")}>
            {hours.map((hour) => {
              const hourEnd = hour * 60 + 60;
              const isPast = dayIsToday && hourEnd <= nowMinutes;
              return (
                <div key={hour} className={cn("cursor-crosshair border-b border-border/50 hover:bg-accent/30", isPast && "bg-muted/30")} style={{ height: HOUR_HEIGHT }} />
              );
            })}

            {/* Drag-to-create preview */}
            {dragPreview && (
              <div className="pointer-events-none absolute left-1 right-1 z-30 rounded border-2 border-primary bg-primary/20" style={{ top: dragPreview.top, height: dragPreview.height }}>
                <p className="px-1 text-xs font-medium text-primary">{dragPreview.label}</p>
              </div>
            )}

            {/* Event drag preview */}
            {eventDragPreview && (
              <div className="pointer-events-none absolute left-1 right-1 z-30 rounded border-2 border-primary bg-primary/20" style={{ top: eventDragPreview.top, height: eventDragPreview.height }}>
                <p className="px-1 text-xs font-medium text-primary">{eventDragPreview.label}</p>
              </div>
            )}

            {/* Current time indicator */}
            {dayIsToday && nowLineTop >= 0 && nowLineTop <= (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
              <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: nowLineTop }}>
                <div className="flex items-center">
                  <div className="h-2.5 w-2.5 -ml-[5px] shrink-0 rounded-full bg-red-500" />
                  <div className="h-[2px] flex-1 bg-red-500" />
                </div>
              </div>
            )}

            {layouted.map(({ event, column, totalColumns }) => {
              const { start, end } = getEventTime(event);
              const startMinutes = start.getHours() * 60 + start.getMinutes();
              const endMinutes = end.getHours() * 60 + end.getMinutes();
              const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
              const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
              const renderedHeight = Math.max(HOUR_HEIGHT / 2, height);
              const isCompact = renderedHeight < HOUR_HEIGHT * 0.7;
              const isDragging = eventDrag?.active && eventDrag.eventId === event.id;
              const color = getEventColor(event.colorId);
              const widthPercent = 100 / totalColumns;
              const leftPercent = column * widthPercent;

              return (
                <button
                  key={event.id}
                  data-event
                  onMouseDown={(e) => handleEventMoveStart(e, event)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (eventDragDidDrag.current) { eventDragDidDrag.current = false; return; }
                    onSelectEvent(event);
                  }}
                  className={cn(
                    "absolute cursor-grab overflow-hidden rounded border-l-2 px-1.5 text-left transition-opacity",
                    isCompact ? "flex items-center gap-1 py-0" : "py-1",
                    color.bg, color.hover,
                    !event.colorId && "border-l-primary",
                    isDragging && "opacity-40",
                  )}
                  style={{
                    top: Math.max(0, top), height: renderedHeight,
                    left: `calc(${leftPercent}% + 2px)`, width: `calc(${widthPercent}% - 4px)`,
                    borderLeftColor: event.colorId ? getColorHex(event.colorId) : undefined,
                  }}
                >
                  {isCompact ? (
                    <p className="truncate text-xs leading-tight text-foreground">
                      <span className="opacity-70">{format(start, "HH:mm")}</span>{" "}{event.summary || "(No title)"}
                    </p>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold leading-tight text-foreground">
                        {event.summary || "(No title)"}
                      </p>
                      <p className="truncate text-xs leading-tight text-foreground/70">
                        {format(start, "HH:mm")} – {format(end, "HH:mm")}
                      </p>
                      {event.location && renderedHeight >= HOUR_HEIGHT * 1.1 && (
                        <p className="truncate text-xs leading-tight text-foreground/50">
                          {event.location}
                        </p>
                      )}
                    </>
                  )}
                  {!isMobile && (
                    <div className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize" onMouseDown={(e) => handleEventResizeStart(e, event)} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MonthView({
  currentDate,
  events,
  onSelectEvent,
  onDayClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onDayClick: (day: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card className="overflow-hidden border-border bg-card/50">
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => (
          <div
            key={day}
            className="border-l border-border px-2 py-1.5 text-center text-xs text-muted-foreground first:border-l-0"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth =
            day.getMonth() === currentDate.getMonth();

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[80px] cursor-pointer border-b border-l border-border p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 hover:bg-accent/20",
                !isCurrentMonth && "opacity-40",
                isToday(day) && "bg-accent/30"
              )}
              onClick={() => onDayClick(day)}
            >
              <p
                className={cn(
                  "mb-0.5 text-xs",
                  isToday(day)
                    ? "font-bold text-primary"
                    : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const color = getEventColor(event.colorId);
                  return (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      className={cn(
                        "w-full cursor-pointer truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-foreground",
                        color.bg, color.hover
                      )}
                    >
                      {event.summary}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EventDetail({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  if (!event) return null;

  const { start, end, allDay } = getEventTime(event);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "h-3.5 w-3.5 shrink-0 rounded-sm",
                !event.colorId && "bg-primary"
              )}
              style={event.colorId ? { backgroundColor: getColorHex(event.colorId) } : undefined}
            />
            <DialogTitle className="text-foreground">{event.summary}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {allDay
                ? format(start, "EEEE, MMM d, yyyy")
                : `${format(start, "EEEE, MMM d · h:mm a")} – ${format(end, "h:mm a")}`}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {event.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground/80">
              {stripHtml(event.description)}
            </p>
          )}

          {(event.hangoutLink || event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")) && (
            <a
              href={event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-blue-500 hover:underline"
            >
              <Video className="h-4 w-4 shrink-0" />
              <span>Join Google Meet</span>
            </a>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="ml-6.5 flex flex-wrap gap-1.5">
                {event.attendees.map((a) => (
                  <span
                    key={a.email}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {a.email}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(event);
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => onDelete(event.id)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Google
                </Button>
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CalendarSkeleton() {
  return (
    <Card className="border-border bg-card/50">
      <CardContent className="flex items-center justify-center py-24">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Loading calendar...</span>
        </div>
      </CardContent>
    </Card>
  );
}
