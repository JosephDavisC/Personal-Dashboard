"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format, parse } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Tag,
  ChevronDown,
  X,
  Clock,
  DollarSign,
  AlignLeft,
  CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { HOURLY_WAGE, NET_PAY_RATE, TIMEZONE } from "@/lib/constants";
import type { Shift } from "@/generated/prisma/client";
import { DEFAULT_SHIFT_LOCATION, SHIFT_LOCATIONS } from "@/config/shifts";

const LOCATION_OPTIONS = SHIFT_LOCATIONS.map((l) => ({ value: l.key, label: l.label }));

// Generate time options in 15-min increments (5:00 AM – 11:45 PM)
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  for (let h = 5; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const d = new Date(2000, 0, 1, h, m);
      const label = format(d, "h:mm a");
      options.push({ value, label });
    }
  }
  return options;
})();

interface ShiftFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ShiftFormData) => void;
  shift?: Shift | null;
}

export interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  label?: string;
  notes?: string;
}

function TimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
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
      // Small delay to let popover render
      const t = setTimeout(scrollToSelected, 50);
      return () => clearTimeout(t);
    }
  }, [open, scrollToSelected]);

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start border-border bg-card text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
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
    </div>
  );
}

export function ShiftForm({ open, onOpenChange, onSubmit, shift }: ShiftFormProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState(DEFAULT_SHIFT_LOCATION);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);

  useEffect(() => {
    if (shift) {
      setDate(formatInTimeZone(new Date(shift.date), TIMEZONE, "yyyy-MM-dd"));
      setStartTime(formatInTimeZone(new Date(shift.startTime), TIMEZONE, "HH:mm"));
      setEndTime(formatInTimeZone(new Date(shift.endTime), TIMEZONE, "HH:mm"));
      setLocation(shift.location);
      setLabel(shift.label ?? "");
      setNotes(shift.notes ?? "");
    } else {
      setDate(formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd"));
      setStartTime("");
      setEndTime("");
      setLocation(DEFAULT_SHIFT_LOCATION);
      setLabel("");
      setNotes("");
    }
  }, [shift, open]);

  const hours =
    startTime && endTime
      ? (() => {
          const [sh, sm] = startTime.split(":").map(Number);
          const [eh, em] = endTime.split(":").map(Number);
          if (sh == null || sm == null || eh == null || em == null) return 0;
          const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
          return diff > 0 ? Math.round(diff * 100) / 100 : 0;
        })()
      : 0;
  const grossPay = Math.round(hours * HOURLY_WAGE * 100) / 100;
  const netPay = Math.round(grossPay * NET_PAY_RATE * 100) / 100;

  function handleSubmit() {
    if (!date || !startTime || !endTime) return;
    const startDt = fromZonedTime(`${date}T${startTime}:00`, TIMEZONE).toISOString();
    const endDt = fromZonedTime(`${date}T${endTime}:00`, TIMEZONE).toISOString();
    const dateDt = fromZonedTime(`${date}T00:00:00`, TIMEZONE).toISOString();
    onSubmit({
      date: dateDt,
      startTime: startDt,
      endTime: endDt,
      location,
      label: label || undefined,
      notes: notes || undefined,
    });
    onOpenChange(false);
  }

  const locationLabel = LOCATION_OPTIONS.find((l) => l.value === location)?.label ?? location;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl"
        showCloseButton={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{shift ? "Edit Shift" : "Log Shift"}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Close button */}
        <div className="flex items-center justify-end px-4 pt-3 md:px-6 md:pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-5 px-4 pb-5 md:flex-row md:gap-8 md:px-6 md:pb-6">
          {/* Left: content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Date */}
            <div className="px-3">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start border-border bg-card text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date
                      ? format(parse(date, "yyyy-MM-dd", new Date()), "MMM d, yyyy")
                      : "Pick a date"}
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

            {/* Time inputs */}
            <div className="grid grid-cols-1 gap-3 px-3 sm:grid-cols-2">
              <TimePicker value={startTime} onChange={setStartTime} label="Start" />
              <TimePicker value={endTime} onChange={setEndTime} label="End" />
            </div>

            {/* Label */}
            <div className="px-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Label</span>
              </div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Açai, Set, Reset"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
              />
            </div>

            {/* Notes */}
            <div className="px-3">
              <div className="mb-1.5 flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Notes</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this shift..."
                className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
              />
            </div>

            {/* Pay preview */}
            {hours > 0 && (
              <div className="mx-3 rounded-md border border-border bg-card/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hours</span>
                  <span className="text-foreground">{hours}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Pay</span>
                  <span className="text-foreground">${grossPay.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Net Pay</span>
                  <span className="text-emerald-400">${netPay.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Separator className="mx-3" />

            {/* Submit */}
            <div className="flex items-center gap-3 px-3">
              <Button className="h-11 md:h-9" onClick={handleSubmit} disabled={!date || !startTime || !endTime}>
                {shift ? "Save Shift" : "Log Shift"}
              </Button>
              <span className="hidden text-xs text-muted-foreground/50 sm:inline">Cmd+Enter</span>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="flex w-full flex-col gap-2 md:w-48">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Details
            </p>

            {/* Location popover */}
            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {locationLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {LOCATION_OPTIONS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => { setLocation(l.value); setLocationOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      location === l.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Pay info */}
            {hours > 0 && (
              <>
                <Separator className="my-1" />
                <div className="space-y-1 px-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    <span>{hours}h @ ${HOURLY_WAGE}/hr</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <DollarSign className="h-3 w-3" />
                    <span>Net: ${netPay.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
