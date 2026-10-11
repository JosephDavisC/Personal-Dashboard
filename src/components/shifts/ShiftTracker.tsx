"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Clock,
  DollarSign,
  CalendarSync,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  Download,
  List,
  CalendarDays,
} from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShiftForm, type ShiftFormData } from "./ShiftForm";
import { PayChart } from "./PayChart";
import { ShiftWeekView } from "./ShiftWeekView";
import { shiftLocationColors } from "@/lib/badge-colors";
import type { Shift } from "@/generated/prisma/client";
import type { DetectedShift } from "@/app/api/shifts/sync/route";
import { SHIFT_LOCATIONS, shiftLocationLabel, shiftLocationShort } from "@/config/shifts";

function MonthNav({
  year,
  month,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium text-foreground">
        {new Date(year, month).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function stepMonth(year: number, month: number, dir: 1 | -1) {
  const m = month + dir;
  if (m > 11) return { year: year + 1, month: 0 };
  if (m < 0) return { year: year - 1, month: 11 };
  return { year, month: m };
}

export function ShiftTracker() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [mobileFilter, setMobileFilter] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // View month + location filter for the main list
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [weekFilter, setWeekFilter] = useState<number>(0); // 0 = all weeks

  // Sync dialog state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncMonth, setSyncMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [detectedShifts, setDetectedShifts] = useState<DetectedShift[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    new Set()
  );
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await fetch("/api/shifts");
      const json = (await res.json()) as { data: Shift[] };
      return json.data;
    },
    refetchInterval: 5_000,
  });

  // Filter shifts for the selected month + location
  const monthShifts = useMemo(() => {
    const monthStart = fromZonedTime(
      `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-01T00:00:00`,
      TIMEZONE
    );
    const next = stepMonth(viewMonth.year, viewMonth.month, 1);
    const monthEnd = fromZonedTime(
      `${next.year}-${String(next.month + 1).padStart(2, "0")}-01T00:00:00`,
      TIMEZONE
    );
    return shifts.filter((s) => {
      const d = new Date(s.date).getTime();
      if (d < monthStart.getTime() || d >= monthEnd.getTime()) return false;
      if (locationFilter !== "ALL" && s.location !== locationFilter) return false;
      if (weekFilter > 0) {
        const day = parseInt(formatInTimeZone(new Date(s.date), TIMEZONE, "d"), 10);
        if (Math.ceil(day / 7) !== weekFilter) return false;
      }
      return true;
    });
  }, [shifts, viewMonth, locationFilter, weekFilter]);

  // Available weeks in this month (computed before week filter, so buttons stay visible)
  const availableWeeks = useMemo(() => {
    const monthStart = fromZonedTime(
      `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-01T00:00:00`,
      TIMEZONE
    );
    const next = stepMonth(viewMonth.year, viewMonth.month, 1);
    const monthEnd = fromZonedTime(
      `${next.year}-${String(next.month + 1).padStart(2, "0")}-01T00:00:00`,
      TIMEZONE
    );
    const weeks = new Set<number>();
    shifts.forEach((s) => {
      const d = new Date(s.date).getTime();
      if (d >= monthStart.getTime() && d < monthEnd.getTime()) {
        const day = parseInt(formatInTimeZone(new Date(s.date), TIMEZONE, "d"), 10);
        weeks.add(Math.ceil(day / 7));
      }
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [shifts, viewMonth]);

  // Stats
  const monthHours = monthShifts.reduce((sum, s) => sum + s.hours, 0);
  const monthGross = monthShifts.reduce((sum, s) => sum + s.grossPay, 0);
  const monthNet = monthShifts.reduce((sum, s) => sum + s.netPay, 0);
  const monthByLocation = SHIFT_LOCATIONS.map((l) => ({
    short: l.short,
    count: monthShifts.filter((s) => s.location === l.key).length,
  })).filter((l) => l.count > 0);

  const allHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const allGross = shifts.reduce((sum, s) => sum + s.grossPay, 0);
  const allNet = shifts.reduce((sum, s) => sum + s.netPay, 0);

  const createMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: Shift }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift logged");
    },
    onError: () => toast.error("Failed to log shift"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ShiftFormData }) => {
      const res = await fetch(`/api/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: Shift }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift updated");
    },
    onError: () => toast.error("Failed to update shift"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/shifts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift deleted");
    },
    onError: () => toast.error("Failed to delete shift"),
  });

  const detectMutation = useMutation({
    mutationFn: async ({
      year,
      month,
    }: {
      year: number;
      month: number;
    }) => {
      const from = fromZonedTime(
        `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00`,
        TIMEZONE
      ).toISOString();
      const n = stepMonth(year, month, 1);
      const to = fromZonedTime(
        `${n.year}-${String(n.month + 1).padStart(2, "0")}-01T00:00:00`,
        TIMEZONE
      ).toISOString();
      const res = await fetch(`/api/shifts/sync?from=${from}&to=${to}`);
      const json = (await res.json()) as {
        data?: { shifts: DetectedShift[] };
        error?: string;
      };
      if (json.error) throw new Error(json.error);
      return json.data!.shifts;
    },
    onSuccess: (detected) => {
      setDetectedShifts(detected);
      const nonDuplicates = new Set<number>();
      detected.forEach((s, i) => {
        if (!s.isDuplicate) nonDuplicates.add(i);
      });
      setSelectedIndexes(nonDuplicates);
      setSyncResult(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (selected: DetectedShift[]) => {
      const res = await fetch("/api/shifts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shifts: selected.map((s) => ({
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            location: s.location,
            label: s.label,
          })),
        }),
      });
      const json = (await res.json()) as {
        data?: { imported: number; skipped: number };
        error?: string;
      };
      if (json.error) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: (result) => {
      setSyncResult(result);
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shifts imported");
    },
    onError: () => toast.error("Failed to import shifts"),
  });

  const clearMonthMutation = useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const from = fromZonedTime(
        `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00`,
        TIMEZONE
      ).toISOString();
      const n = stepMonth(year, month, 1);
      const to = fromZonedTime(
        `${n.year}-${String(n.month + 1).padStart(2, "0")}-01T00:00:00`,
        TIMEZONE
      ).toISOString();
      const res = await fetch(`/api/shifts?from=${from}&to=${to}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { data?: { deleted: number }; error?: string };
      if (json.error) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Month cleared");
    },
    onError: () => toast.error("Failed to clear month"),
  });

  function exportCSV() {
    const header = "Date,Day,Start,End,Location,Label,Hours,Gross,Net\n";
    const rows = monthShifts
      .map((s) => {
        const date = formatInTimeZone(new Date(s.date), TIMEZONE, "yyyy-MM-dd");
        const day = formatInTimeZone(new Date(s.date), TIMEZONE, "EEE");
        const start = formatInTimeZone(new Date(s.startTime), TIMEZONE, "HH:mm");
        const end = formatInTimeZone(new Date(s.endTime), TIMEZONE, "HH:mm");
        const loc = shiftLocationLabel(s.location);
        const label = (s.label ?? "").replace(/,/g, ";");
        return `${date},${day},${start},${end},${loc},${label},${s.hours},${s.grossPay.toFixed(2)},${s.netPay.toFixed(2)}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(" ", "-");
    a.download = `shifts-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSubmit(data: ShiftFormData) {
    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, data });
    } else {
      createMutation.mutate(data);
    }
    setEditingShift(null);
  }

  function handleImport() {
    const selected = detectedShifts.filter((_, i) => selectedIndexes.has(i));
    if (selected.length > 0) {
      importMutation.mutate(selected);
    }
  }

  function toggleIndex(index: number) {
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        {/* Mobile: month nav on its own row */}
        {viewMode === "list" && (
          <div className="flex items-center justify-between sm:hidden">
            <MonthNav
              year={viewMonth.year}
              month={viewMonth.month}
              onPrev={() => { setViewMonth((p) => stepMonth(p.year, p.month, -1)); setWeekFilter(0); }}
              onNext={() => { setViewMonth((p) => stepMonth(p.year, p.month, 1)); setWeekFilter(0); }}
            />
          </div>
        )}

        {/* Row 1: view toggle + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Desktop: month nav inline */}
            {viewMode === "list" && (
              <div className="hidden sm:block">
                <MonthNav
                  year={viewMonth.year}
                  month={viewMonth.month}
                  onPrev={() => { setViewMonth((p) => stepMonth(p.year, p.month, -1)); setWeekFilter(0); }}
                  onNext={() => { setViewMonth((p) => stepMonth(p.year, p.month, 1)); setWeekFilter(0); }}
                />
              </div>
            )}
            <div className="flex rounded-md border border-border">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-l-md px-2.5 py-1.5 sm:px-2 sm:py-1 transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-r-md px-2.5 py-1.5 sm:px-2 sm:py-1 transition-colors ${
                  viewMode === "calendar"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </button>
            </div>
          </div>
          {/* Desktop: all actions inline */}
          <div className="hidden shrink-0 gap-2 sm:flex">
            {monthShifts.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
            {monthShifts.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-red-400 hover:text-red-300 border-red-400/30 hover:border-red-400/50 hover:bg-red-400/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear Month
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all shifts for this month?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {monthShifts.length} shift{monthShifts.length !== 1 ? "s" : ""} in{" "}
                      {new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearMonthMutation.mutate(viewMonth)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {clearMonthMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Delete {monthShifts.length} shift{monthShifts.length !== 1 ? "s" : ""}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSyncMonth(viewMonth);
                setDetectedShifts([]);
                setSyncResult(null);
                detectMutation.reset();
                setSyncOpen(true);
              }}
              className="gap-1"
            >
              <CalendarSync className="h-4 w-4" />
              Sync from Calendar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingShift(null);
                setFormOpen(true);
              }}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Log Shift
            </Button>
          </div>
          {/* Mobile: add button */}
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              size="default"
              onClick={() => {
                setEditingShift(null);
                setFormOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Row 2: filters + mobile secondary actions (list mode only) */}
        {viewMode === "list" && <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-md border border-border">
              {["ALL", ...SHIFT_LOCATIONS.map((l) => l.key)].map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocationFilter(loc)}
                  className={`px-3 py-1.5 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                    locationFilter === loc
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {loc === "ALL" ? "All" : shiftLocationShort(loc)}
                </button>
              ))}
            </div>
            {availableWeeks.length > 1 && (
              <div className="flex rounded-md border border-border">
                <button
                  onClick={() => setWeekFilter(0)}
                  className={`px-3 py-1.5 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-medium transition-colors rounded-l-md ${
                    weekFilter === 0
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {availableWeeks.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeekFilter(w)}
                    className={`px-3 py-1.5 text-xs sm:px-2.5 sm:py-1 sm:text-[11px] font-medium transition-colors last:rounded-r-md ${
                      weekFilter === w
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    W{w}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Mobile secondary actions */}
          <div className="flex shrink-0 gap-1.5 sm:hidden">
            {monthShifts.length > 0 && (
              <Button variant="ghost" size="icon" onClick={exportCSV} className="h-10 w-10">
                <Download className="h-4 w-4" />
              </Button>
            )}
            {monthShifts.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all shifts for this month?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {monthShifts.length} shift{monthShifts.length !== 1 ? "s" : ""} in{" "}
                      {new Date(viewMonth.year, viewMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearMonthMutation.mutate(viewMonth)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {clearMonthMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Delete {monthShifts.length} shift{monthShifts.length !== 1 ? "s" : ""}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSyncMonth(viewMonth);
                setDetectedShifts([]);
                setSyncResult(null);
                detectMutation.reset();
                setSyncOpen(true);
              }}
              className="h-10 w-10"
            >
              <CalendarSync className="h-4 w-4" />
            </Button>
          </div>
        </div>}
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <ShiftWeekView
          shifts={shifts}
          onEditShift={(shift) => {
            setEditingShift(shift);
            setFormOpen(true);
          }}
          mobileFilter={mobileFilter}
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setMobileFilter(day ? "day" : "week");
          }}
        />
      )}

      {viewMode === "list" && <>
      {/* Monthly stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Hours
                </p>
                <p className="text-lg font-semibold text-foreground leading-tight">
                  {monthHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Net Pay
                </p>
                <p className="text-lg font-semibold text-emerald-400 leading-tight">
                  ${monthNet.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Shifts
                </p>
                <p className="text-sm font-medium text-foreground leading-tight">
                  {monthShifts.length} total
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {monthByLocation.map((l) => `${l.count} ${l.short}`).join(" · ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Gross
                </p>
                <p className="text-lg font-semibold text-foreground leading-tight">
                  ${monthGross.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All-time summary */}
      {shifts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            All time:{" "}
            <span className="text-foreground font-medium">
              {allHours.toFixed(1)}h
            </span>
            {" · "}
            <span className="text-foreground font-medium">
              ${allGross.toFixed(2)} gross
            </span>
            {" · "}
            <span className="text-emerald-400 font-medium">
              ${allNet.toFixed(2)} net
            </span>
            {" · "}
            <span className="text-foreground">{shifts.length} shifts</span>
          </p>
        </div>
      )}

      {/* Weekly earnings chart */}
      {monthShifts.length > 0 && (
        <Card className="border-border bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Weekly Net Pay
            </p>
            <PayChart shifts={monthShifts} />
          </CardContent>
        </Card>
      )}

      {/* Shift list */}
      <div className="space-y-4">
        {monthShifts.length === 0 ? (
          <Card className="border-border bg-card/50">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No shifts for this month.
              </p>
            </CardContent>
          </Card>
        ) : (
          (() => {
            const weeks: { week: number; shifts: Shift[] }[] = [];
            monthShifts.forEach((shift) => {
              const day = parseInt(formatInTimeZone(new Date(shift.date), TIMEZONE, "d"), 10);
              const week = Math.ceil(day / 7);
              let group = weeks.find((w) => w.week === week);
              if (!group) {
                group = { week, shifts: [] };
                weeks.push(group);
              }
              group.shifts.push(shift);
            });
            weeks.sort((a, b) => a.week - b.week);
            return weeks.map((group) => {
              const weekHours = group.shifts.reduce((sum, s) => sum + s.hours, 0);
              const weekNet = group.shifts.reduce((sum, s) => sum + s.netPay, 0);
              return (
                <div key={group.week} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Week {group.week}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {weekHours.toFixed(1)}h · <span className="text-emerald-400/70">${weekNet.toFixed(2)}</span>
                    </p>
                  </div>
                  {group.shifts.map((shift) => (
                    <Card
                      key={shift.id}
                      className="cursor-pointer border-border bg-card/50 transition-colors hover:bg-card/80"
                      onClick={() => {
                        setEditingShift(shift);
                        setFormOpen(true);
                      }}
                    >
                      <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          <div className="min-w-0 shrink-0">
                            <p className="text-sm font-medium text-foreground">
                              {formatInTimeZone(
                                new Date(shift.date),
                                TIMEZONE,
                                "EEE, MMM d"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatInTimeZone(
                                new Date(shift.startTime),
                                TIMEZONE,
                                "h:mm a"
                              )}{" "}
                              –{" "}
                              {formatInTimeZone(
                                new Date(shift.endTime),
                                TIMEZONE,
                                "h:mm a"
                              )}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`shrink-0 ${shiftLocationColors[shift.location] ?? ""}`}
                          >
                            <span className="hidden sm:inline">
                              {shiftLocationLabel(shift.location)}
                            </span>
                            <span className="sm:hidden">
                              {shiftLocationShort(shift.location)}
                            </span>
                          </Badge>
                          {shift.label && (
                            <span className="hidden truncate text-xs text-muted-foreground sm:block">
                              {shift.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="text-right">
                            <p className="text-sm text-foreground">{shift.hours}h</p>
                            <p className="text-xs text-emerald-400">
                              ${shift.netPay.toFixed(2)}
                            </p>
                          </div>
                          <a
                            href={`/dashboard/calendar?date=${formatInTimeZone(new Date(shift.date), TIMEZONE, "yyyy-MM-dd")}&time=${encodeURIComponent(new Date(shift.startTime).toISOString())}`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(shift.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            });
          })()
        )}
      </div>
      </>}

      <ShiftForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        shift={editingShift}
      />

      {/* Sync from Calendar Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sync Shifts from Calendar</DialogTitle>
          </DialogHeader>

          {/* Month picker */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setSyncMonth((p) => stepMonth(p.year, p.month, -1));
                setDetectedShifts([]);
                setSyncResult(null);
                detectMutation.reset();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {new Date(syncMonth.year, syncMonth.month).toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric" }
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setSyncMonth((p) => stepMonth(p.year, p.month, 1));
                setDetectedShifts([]);
                setSyncResult(null);
                detectMutation.reset();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {syncResult ? (
            <div className="py-6 text-center">
              <Check className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
              <p className="text-sm text-foreground">
                Imported {syncResult.imported} shift
                {syncResult.imported !== 1 ? "s" : ""}
                {syncResult.skipped > 0 && (
                  <span className="text-muted-foreground">
                    , skipped {syncResult.skipped} duplicate
                    {syncResult.skipped !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
          ) : detectedShifts.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Found {detectedShifts.length} shift
                {detectedShifts.length !== 1 ? "s" : ""}. Duplicates are
                unchecked.
              </p>
              {(() => {
                const weeks: { week: number; shifts: { shift: DetectedShift; index: number }[] }[] = [];
                detectedShifts.forEach((shift, i) => {
                  const day = parseInt(formatInTimeZone(new Date(shift.date), TIMEZONE, "d"), 10);
                  const week = Math.ceil(day / 7);
                  let group = weeks.find((w) => w.week === week);
                  if (!group) {
                    group = { week, shifts: [] };
                    weeks.push(group);
                  }
                  group.shifts.push({ shift, index: i });
                });
                weeks.sort((a, b) => a.week - b.week);
                return weeks.map((group) => (
                  <div key={group.week} className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Week {group.week}
                    </p>
                    {group.shifts.map(({ shift, index }) => (
                      <label
                        key={`${shift.date}-${shift.startTime}`}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 transition-colors hover:bg-accent/50"
                      >
                        <Checkbox
                          checked={selectedIndexes.has(index)}
                          onCheckedChange={() => toggleIndex(index)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {formatInTimeZone(
                                new Date(shift.date),
                                TIMEZONE,
                                "EEE, MMM d"
                              )}
                            </p>
                            <Badge
                              variant="secondary"
                              className={
                                shiftLocationColors[shift.location] ?? ""
                              }
                            >
                              {shiftLocationShort(shift.location)}
                            </Badge>
                            {shift.isDuplicate && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                duplicate
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatInTimeZone(
                              new Date(shift.startTime),
                              TIMEZONE,
                              "h:mm a"
                            )}{" "}
                            –{" "}
                            {formatInTimeZone(
                              new Date(shift.endTime),
                              TIMEZONE,
                              "h:mm a"
                            )}
                            {" · "}
                            {shift.hours}h · ${shift.netPay.toFixed(2)} net
                          </p>
                          <p className="truncate text-xs text-muted-foreground/60">
                            {shift.summary}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ));
              })()}
            </div>
          ) : detectMutation.isIdle || detectMutation.isError ? (
            <div className="py-4 text-center">
              {detectMutation.isError && (
                <p className="mb-2 text-sm text-red-400">
                  {detectMutation.error.message}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Select a month and click Fetch to find work shifts.
              </p>
            </div>
          ) : detectMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No work shifts found for this month.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!syncResult &&
              detectedShifts.length === 0 &&
              !detectMutation.isPending && (
                <Button
                  onClick={() => detectMutation.mutate(syncMonth)}
                  className="gap-1"
                >
                  <CalendarSync className="h-4 w-4" />
                  Fetch Shifts
                </Button>
              )}
            {!syncResult && detectedShifts.length > 0 && (
              <div className="flex w-full items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDetectedShifts([]);
                    detectMutation.reset();
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    selectedIndexes.size === 0 || importMutation.isPending
                  }
                  className="gap-1"
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Import {selectedIndexes.size} Shift
                  {selectedIndexes.size !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
            {syncResult && (
              <Button onClick={() => setSyncOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
