"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO, addDays, subDays, differenceInMinutes } from "date-fns";
import { CalendarDays, X, Users, MapPin, Clock } from "lucide-react";

const SESSION_TAGS = ["serve", "forehand", "backhand", "volley", "overhead", "footwork", "return", "rally", "fitness", "mental"];

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
}

interface SessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSession?: Record<string, unknown> | null;
}

export function SessionForm({ open, onOpenChange, editingSession }: SessionFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingSession;
  const [dateOpen, setDateOpen] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);

  const [form, setForm] = useState({
    type: "practice" as "practice" | "lesson" | "match",
    date: new Date().toISOString().split("T")[0]!,
    duration: "",
    location: "",
    racketId: "",
    tags: [] as string[],
    notes: "",
    cost: "",
    coach: "",
    playedWith: "",
    calendarEventId: "",
    calendarEventTitle: "",
  });

  const { data: rackets } = useQuery({
    queryKey: ["tennis-rackets"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/rackets");
      if (!res.ok) throw new Error("Failed to fetch rackets");
      const json = await res.json();
      return (json.data ?? []) as Array<{ id: string; name: string }>;
    },
    enabled: open,
  });

  // Fetch calendar events ±3 days around the selected date
  const eventRange = useMemo(() => {
    const date = form.date ? parseISO(form.date) : new Date();
    return {
      start: format(subDays(date, 3), "yyyy-MM-dd"),
      end: format(addDays(date, 3), "yyyy-MM-dd"),
    };
  }, [form.date]);

  const { data: calendarEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events-picker", eventRange.start, eventRange.end],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: `${eventRange.start}T00:00:00`,
        end: `${eventRange.end}T23:59:59`,
      });
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as CalendarEvent[];
    },
    enabled: calendarPickerOpen,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open && editingSession) {
      setForm({
        type: (editingSession.type as string) as "practice" | "lesson" | "match",
        date: editingSession.date
          ? new Date(editingSession.date as string).toISOString().split("T")[0]!
          : new Date().toISOString().split("T")[0]!,
        duration: editingSession.duration ? String(editingSession.duration) : "",
        location: (editingSession.location as string) ?? "",
        racketId: (editingSession.racketId as string) ?? "",
        tags: (editingSession.tags as string[]) ?? [],
        notes: (editingSession.notes as string) ?? "",
        cost: editingSession.cost ? String(editingSession.cost) : "",
        coach: (editingSession.coach as string) ?? "",
        playedWith: (editingSession.playedWith as string) ?? "",
        calendarEventId: (editingSession.calendarEventId as string) ?? "",
        calendarEventTitle: (editingSession.calendarEventTitle as string) ?? "",
      });
    } else if (open) {
      setForm({
        type: "practice",
        date: new Date().toISOString().split("T")[0]!,
        duration: "",
        location: "",
        racketId: "",
        tags: [],
        notes: "",
        cost: "",
        coach: "",
        playedWith: "",
        calendarEventId: "",
        calendarEventTitle: "",
      });
    }
  }, [open, editingSession]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type: form.type,
        date: form.date,
        duration: form.duration ? Number(form.duration) : null,
        location: form.location || null,
        racketId: form.racketId || null,
        tags: form.tags,
        notes: form.notes || null,
        cost: form.cost ? Number(form.cost) : null,
        coach: form.coach || null,
        playedWith: form.playedWith || null,
        calendarEventId: form.calendarEventId || null,
        calendarEventTitle: form.calendarEventTitle || null,
      };

      const url = isEditing ? `/api/tennis/sessions/${editingSession!.id}` : "/api/tennis/sessions";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tennis-stats"] });
      toast.success(isEditing ? "Session updated" : "Session logged");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  }

  function selectCalendarEvent(event: CalendarEvent) {
    const startDt = event.start.dateTime ?? event.start.date;
    const endDt = event.end.dateTime ?? event.end.date;

    const updates: Partial<typeof form> = {
      calendarEventId: event.id,
      calendarEventTitle: event.summary || "(No title)",
    };

    // Auto-fill date
    if (startDt) {
      updates.date = startDt.split("T")[0]!;
    }

    // Auto-fill duration (round to nearest 0.5h)
    if (startDt && endDt && event.start.dateTime && event.end.dateTime) {
      const mins = differenceInMinutes(new Date(endDt), new Date(startDt));
      if (mins > 0) {
        const hours = Math.round((mins / 60) * 2) / 2; // round to 0.5
        updates.duration = String(hours);
      }
    }

    // Auto-fill location only if empty
    if (event.location && !form.location) {
      updates.location = event.location;
    }

    setForm((prev) => ({ ...prev, ...updates }));
    setCalendarPickerOpen(false);
  }

  function clearCalendarEvent() {
    setForm((prev) => ({ ...prev, calendarEventId: "", calendarEventTitle: "" }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Session" : "Log Session"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          {/* Type selector */}
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(["practice", "lesson", "match"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  form.type === t
                    ? t === "practice" ? "bg-blue-500/20 text-blue-400"
                    : t === "lesson" ? "bg-green-500/20 text-green-400"
                    : "bg-orange-500/20 text-orange-400"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Calendar Event Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Link Calendar Event
            </Label>
            {form.calendarEventTitle ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{form.calendarEventTitle}</span>
                <button type="button" onClick={clearCalendarEvent} className="shrink-0 rounded-full p-0.5 hover:bg-accent">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <Popover open={calendarPickerOpen} onOpenChange={setCalendarPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start text-base sm:text-sm font-normal text-muted-foreground">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Search calendar events...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[340px] p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto">
                    {eventsLoading ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Loading events...</div>
                    ) : calendarEvents?.length ? (
                      <div className="py-1">
                        {calendarEvents.map((event) => {
                          const startDt = event.start.dateTime ?? event.start.date ?? "";
                          const isAllDay = !event.start.dateTime;
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => selectCalendarEvent(event)}
                              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                            >
                              <p className="text-sm font-medium truncate">{event.summary || "(No title)"}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  {isAllDay
                                    ? format(parseISO(startDt), "MMM d")
                                    : format(parseISO(startDt), "MMM d, h:mm a")}
                                </span>
                                {event.location && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[140px]">{event.location}</span>
                                  </span>
                                )}
                                {event.start.dateTime && event.end.dateTime && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {Math.round(differenceInMinutes(new Date(event.end.dateTime), new Date(event.start.dateTime)) / 60 * 2) / 2}h
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">No events found nearby</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left text-base sm:text-sm font-normal",
                      !form.date && "text-muted-foreground"
                    )}
                  >
                    {form.date ? format(parseISO(form.date), "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date ? parseISO(form.date) : undefined}
                    onSelect={(d) => {
                      if (d) {
                        setForm({ ...form, date: format(d, "yyyy-MM-dd") });
                        setDateOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Duration (hours)</Label>
              <Input type="number" step="0.5" min="0.5" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="1.5" className="text-base sm:text-sm" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. City courts" className="text-base sm:text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Racket</Label>
              <Select value={form.racketId} onValueChange={(v) => setForm({ ...form, racketId: v === "none" ? "" : v })}>
                <SelectTrigger className="text-base sm:text-sm">
                  <SelectValue placeholder="Select racket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No racket</SelectItem>
                  {rackets?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Played With */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Played With
            </Label>
            <Input
              value={form.playedWith}
              onChange={(e) => setForm({ ...form, playedWith: e.target.value })}
              placeholder="e.g. John, Sarah"
              className="text-base sm:text-sm"
            />
          </div>

          {/* Lesson-specific fields */}
          {form.type === "lesson" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cost ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="text-base sm:text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Coach</Label>
                <Input value={form.coach} onChange={(e) => setForm({ ...form, coach: e.target.value })} className="text-base sm:text-sm" />
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    form.tags.includes(tag)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What did you work on?" className="text-base sm:text-sm" rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Log Session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
