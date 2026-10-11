"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format, parse } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, X, ChevronDown, ChevronRight, CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/google-calendar";
import { useLocationHistory } from "@/hooks/useLocationHistory";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { RecurrenceBuilder } from "./RecurrenceBuilder";
import { parseRRULE } from "@/lib/rrule";

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EventFormData) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  defaultHour?: number | null;
  defaultMinute?: number | null;
  defaultEndHour?: number | null;
  defaultEndMinute?: number | null;
}

export interface EventFormData {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  addGoogleMeet?: boolean;
  attendees?: string[];
  colorId?: string;
  recurrence?: string[];
  visibility?: "default" | "public" | "private";
  transparency?: "opaque" | "transparent";
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: "email" | "popup"; minutes: number }[];
  };
}

const GOOGLE_COLORS: { id: string; hex: string; name: string }[] = [
  { id: "1", hex: "#7986CB", name: "Lavender" },
  { id: "2", hex: "#33B679", name: "Sage" },
  { id: "3", hex: "#8E24AA", name: "Grape" },
  { id: "4", hex: "#E67C73", name: "Flamingo" },
  { id: "5", hex: "#F6BF26", name: "Banana" },
  { id: "6", hex: "#F4511E", name: "Tangerine" },
  { id: "7", hex: "#039BE5", name: "Peacock" },
  { id: "8", hex: "#616161", name: "Graphite" },
  { id: "9", hex: "#3F51B5", name: "Blueberry" },
  { id: "10", hex: "#0B8043", name: "Basil" },
  { id: "11", hex: "#D50000", name: "Tomato" },
];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getInitialState(
  event?: CalendarEvent | null,
  defaultDate?: Date | null,
  defaultHour?: number | null,
  defaultMinute?: number | null,
  defaultEndHour?: number | null,
  defaultEndMinute?: number | null
) {
  if (event) {
    const desc = event.description ? stripHtml(event.description) : "";
    const isAllDay = !event.start.dateTime;
    if (isAllDay) {
      return {
        summary: event.summary,
        description: desc,
        location: event.location ?? "",
        date: event.start.date ?? "",
        startTime: "09:00",
        endTime: "10:00",
        allDay: true,
      };
    }
    const start = new Date(event.start.dateTime ?? "");
    const end = new Date(event.end.dateTime ?? "");
    return {
      summary: event.summary,
      description: desc,
      location: event.location ?? "",
      date: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      endTime: format(end, "HH:mm"),
      allDay: false,
    };
  }

  const dateStr = defaultDate
    ? format(defaultDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  let startTime = "09:00";
  let endTime = "10:00";

  if (
    defaultHour != null &&
    defaultMinute != null &&
    defaultEndHour != null &&
    defaultEndMinute != null
  ) {
    startTime = `${pad2(defaultHour)}:${pad2(defaultMinute)}`;
    endTime = `${pad2(defaultEndHour)}:${pad2(defaultEndMinute)}`;
  } else if (defaultHour != null) {
    startTime = `${pad2(defaultHour)}:00`;
    endTime = `${pad2(Math.min(defaultHour + 1, 23))}:00`;
  }

  return {
    summary: "",
    description: "",
    location: "",
    date: dateStr,
    startTime,
    endTime,
    allDay: false,
  };
}

// Generate time options in 15-min increments (midnight – 11:45 PM)
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const d = new Date(2000, 0, 1, h, m);
      const label = format(d, "h:mm a");
      options.push({ value, label });
    }
  }
  return options;
})();

function EventTimePicker({
  value,
  onChange,
  id,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const displayLabel = value
    ? TIME_OPTIONS.find((t) => t.value === value)?.label ?? value
    : `Select ${label.toLowerCase()}`;

  const scrollToSelected = useCallback(() => {
    if (!listRef.current || !value) return;
    const index = TIME_OPTIONS.findIndex((t) => t.value === value);
    if (index >= 0) {
      const el = listRef.current.children[index] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "center" });
    }
  }, [value]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(scrollToSelected, 50);
      return () => clearTimeout(t);
    }
  }, [open, scrollToSelected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "mt-1 w-full justify-start border-border bg-card text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0" align="start">
        <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                onChange(t.value);
                setOpen(false);
              }}
              className={cn(
                "w-full px-3 py-1.5 text-left text-sm transition-colors",
                value === t.value
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-accent"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EventFormInner({
  onOpenChange,
  onSubmit,
  event,
  defaultDate,
  defaultHour,
  defaultMinute,
  defaultEndHour,
  defaultEndMinute,
}: Omit<EventFormProps, "open">) {
  const init = getInitialState(
    event,
    defaultDate,
    defaultHour,
    defaultMinute,
    defaultEndHour,
    defaultEndMinute
  );
  const [summary, setSummary] = useState(init.summary);
  const [description, setDescription] = useState(init.description);
  const [location, setLocation] = useState(init.location);
  const [date, setDate] = useState(init.date);
  const [startTime, setStartTime] = useState(init.startTime);
  const [endTime, setEndTime] = useState(init.endTime);
  const [allDay, setAllDay] = useState(init.allDay);
  const [addMeet, setAddMeet] = useState(false);
  const [colorId, setColorId] = useState<string | undefined>(
    event?.colorId ?? undefined
  );
  const [attendees, setAttendees] = useState<string[]>(
    event?.attendees?.map((a) => a.email) ?? []
  );
  const [attendeeInput, setAttendeeInput] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState<
    { email: string; name?: string }[]
  >([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const debouncedAttendeeInput = useDebouncedValue(attendeeInput, 300);

  // More options
  const [showMore, setShowMore] = useState(false);
  const [visibility, setVisibility] = useState<
    "default" | "public" | "private"
  >(
    (event?.visibility as "default" | "public" | "private") ?? "default"
  );
  const [transparency, setTransparency] = useState<"opaque" | "transparent">(
    (event?.transparency as "opaque" | "transparent") ?? "opaque"
  );
  const [reminderMinutes, setReminderMinutes] = useState(
    event?.reminders?.overrides?.[0]?.minutes ?? 30
  );

  // Recurrence
  const [recurrence, setRecurrence] = useState<string[] | undefined>(
    event?.recurrence ?? undefined
  );

  // Location autocomplete
  const { addLocation, searchLocations } = useLocationHistory();
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationSuggestions = searchLocations(location);

  // Contact search
  useEffect(() => {
    if (!debouncedAttendeeInput || debouncedAttendeeInput.length < 2) {
      setContactSuggestions([]);
      return;
    }
    fetch(`/api/contacts?q=${encodeURIComponent(debouncedAttendeeInput)}`)
      .then((res) => res.json())
      .then((json: { data?: { email: string; name?: string }[] }) => {
        if (json.data) {
          setContactSuggestions(
            json.data.filter((c) => !attendees.includes(c.email))
          );
        }
      })
      .catch(() => setContactSuggestions([]));
  }, [debouncedAttendeeInput, attendees]);

  function addAttendee(email?: string) {
    const value = (email ?? attendeeInput).trim().toLowerCase();
    if (value && value.includes("@") && !attendees.includes(value)) {
      setAttendees([...attendees, value]);
      setAttendeeInput("");
      setContactSuggestions([]);
      setShowContactDropdown(false);
    }
  }

  function removeAttendee(email: string) {
    setAttendees(attendees.filter((a) => a !== email));
  }

  function handleSubmit() {
    if (!summary.trim() || !date) return;

    if (location.trim()) addLocation(location.trim());

    const base: Omit<EventFormData, "startDateTime" | "endDateTime" | "allDay"> = {
      summary: summary.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      addGoogleMeet: addMeet || undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      colorId: colorId || undefined,
      recurrence: recurrence?.length ? recurrence : undefined,
      visibility: visibility !== "default" ? visibility : undefined,
      transparency: transparency !== "opaque" ? transparency : undefined,
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup" as const, minutes: reminderMinutes }],
      },
    };

    if (allDay) {
      onSubmit({
        ...base,
        startDateTime: date,
        endDateTime: date,
        allDay: true,
      });
    } else {
      onSubmit({
        ...base,
        startDateTime: `${date}T${startTime}:00`,
        endDateTime: `${date}T${endTime}:00`,
        allDay: false,
      });
    }
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <DialogContent
      className="max-h-[90dvh] overflow-y-auto border-border bg-background sm:max-w-md"
      onKeyDown={handleKeyDown}
    >
      <DialogHeader>
        <DialogTitle className="text-foreground">
          {event ? "Edit Event" : "New Event"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label htmlFor="event-summary">Title</Label>
          <Input
            id="event-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Event title"
            className="mt-1 border-border bg-card"
            autoFocus
          />
        </div>

        {/* Date */}
        <div>
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "mt-1 w-full justify-start border-border bg-card text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(parse(date, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date ? parse(date, "yyyy-MM-dd", new Date()) : undefined}
                onSelect={(d) => {
                  if (d) setDate(format(d, "yyyy-MM-dd"));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* All day */}
        <div className="flex items-center gap-2">
          <input
            id="event-allday"
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="event-allday" className="text-sm font-normal">
            All day
          </Label>
        </div>

        {/* Time */}
        {!allDay && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="event-start">Start</Label>
              <EventTimePicker
                id="event-start"
                value={startTime}
                onChange={setStartTime}
                label="Start"
              />
            </div>
            <div>
              <Label htmlFor="event-end">End</Label>
              <EventTimePicker
                id="event-end"
                value={endTime}
                onChange={setEndTime}
                label="End"
              />
            </div>
          </div>
        )}

        {/* Location with autocomplete */}
        <div className="relative">
          <Label htmlFor="event-location">Location</Label>
          <Input
            id="event-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onFocus={() => setShowLocationDropdown(true)}
            onBlur={() =>
              setTimeout(() => setShowLocationDropdown(false), 200)
            }
            placeholder="Add location"
            className="mt-1 border-border bg-card"
          />
          {showLocationDropdown && locationSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
              {locationSuggestions.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onMouseDown={() => {
                    setLocation(loc);
                    setShowLocationDropdown(false);
                  }}
                  className="w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="event-description">Description</Label>
          <Textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            className="mt-1 border-border bg-card"
            rows={3}
          />
        </div>

        {/* Color picker */}
        <div>
          <Label>Color</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setColorId(undefined)}
              className={cn(
                "h-6 w-6 rounded-full border-2 bg-primary transition-transform hover:scale-110",
                colorId === undefined
                  ? "border-foreground"
                  : "border-transparent"
              )}
              title="Default"
            />
            {GOOGLE_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setColorId(colorId === c.id ? undefined : c.id)
                }
                className={cn(
                  "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                  colorId === c.id
                    ? "border-foreground"
                    : "border-transparent"
                )}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Google Meet */}
        <div className="flex items-center gap-2">
          <input
            id="event-meet"
            type="checkbox"
            checked={addMeet}
            onChange={(e) => setAddMeet(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label
            htmlFor="event-meet"
            className="flex items-center gap-1.5 text-sm font-normal"
          >
            <Video className="h-4 w-4 text-blue-500" />
            Add Google Meet
          </Label>
        </div>

        {/* Recurrence */}
        <RecurrenceBuilder value={recurrence} onChange={setRecurrence} />

        {/* Attendees with contact autocomplete */}
        <div className="relative">
          <Label>Attendees</Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={attendeeInput}
              onChange={(e) => {
                setAttendeeInput(e.target.value);
                setShowContactDropdown(true);
              }}
              onFocus={() => setShowContactDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowContactDropdown(false), 200)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttendee();
                }
              }}
              placeholder="Add email and press Enter"
              className="border-border bg-card"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addAttendee()}
              className="shrink-0"
            >
              Add
            </Button>
          </div>
          {showContactDropdown && contactSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
              {contactSuggestions.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onMouseDown={() => addAttendee(c.email)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="font-medium">{c.name ?? c.email}</span>
                  {c.name && (
                    <span className="ml-1 text-muted-foreground">
                      {c.email}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {attendees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attendees.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeAttendee(email)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* More options toggle */}
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {showMore ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          More options
        </button>

        {showMore && (
          <div className="space-y-3 rounded-md border border-border/50 p-3">
            {/* Visibility */}
            <div>
              <Label className="text-xs">Visibility</Label>
              <div className="mt-1 flex gap-2">
                {(
                  [
                    { value: "default", label: "Default" },
                    { value: "public", label: "Public" },
                    { value: "private", label: "Private" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs",
                      visibility === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Free/Busy */}
            <div className="flex items-center gap-2">
              <input
                id="event-free"
                type="checkbox"
                checked={transparency === "transparent"}
                onChange={(e) =>
                  setTransparency(
                    e.target.checked ? "transparent" : "opaque"
                  )
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label
                htmlFor="event-free"
                className="text-xs font-normal"
              >
                Mark as free time
              </Label>
            </div>

            {/* Reminder */}
            <div>
              <Label className="text-xs">Reminder</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="40320"
                  value={reminderMinutes}
                  onChange={(e) =>
                    setReminderMinutes(parseInt(e.target.value) || 0)
                  }
                  className="w-20 border-border bg-card text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  minutes before
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!summary.trim() || !date}>
            {event ? "Save" : "Create"}
          </Button>
        </div>

        <p className="hidden text-center text-xs text-muted-foreground/60 sm:block">
          Press Cmd+Enter to submit
        </p>
      </div>
    </DialogContent>
  );
}

export function EventForm({ open, onOpenChange, ...rest }: EventFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EventFormInner onOpenChange={onOpenChange} {...rest} />}
    </Dialog>
  );
}
