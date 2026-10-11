"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  AlignLeft,
  CalendarDays,
  ImageIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { DiaryTimeline } from "./DiaryTimeline";
import { DiaryCalendar } from "./DiaryCalendar";
import { DiaryGallery } from "./DiaryGallery";
import { DiaryEditor } from "./DiaryEditor";

type ViewMode = "timeline" | "calendar" | "gallery";

export function DiaryTracker() {
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const isMobile = useIsMobile(640);

  function handleNewEntry(selectedDate?: Date) {
    const d = selectedDate ?? new Date();
    setEditingDate(format(d, "yyyy-MM-dd"));
    setDatePickerOpen(false);
  }

  function handleEditEntry(date: string) {
    setEditingDate(date);
  }

  function handleCloseEditor() {
    setEditingDate(null);
  }

  // Show editor full-page when editing
  if (editingDate) {
    return <DiaryEditor date={editingDate} onClose={handleCloseEditor} />;
  }

  const calendarPicker = (
    <Calendar
      mode="single"
      selected={undefined}
      onSelect={(day) => {
        if (day) handleNewEntry(day);
      }}
      disabled={{ after: new Date() }}
      className={isMobile ? "[--cell-size:--spacing(12)]" : undefined}
      initialFocus
    />
  );

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Date picker: bottom sheet on mobile, popover on desktop */}
        {isMobile ? (
          <>
            <Button className="gap-1.5 w-full" onClick={() => setDatePickerOpen(true)}>
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
            <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <DialogContent
                showCloseButton={false}
                className="fixed bottom-0 left-0 right-0 top-auto translate-x-0 translate-y-0 max-w-full rounded-t-2xl rounded-b-none p-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
                </div>
                <DialogTitle className="px-4 text-lg font-semibold">Pick a date</DialogTitle>
                <div className="flex justify-center px-2 pb-4">
                  {calendarPicker}
                </div>
                <div className="h-[env(safe-area-inset-bottom,0px)]" />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Entry
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {calendarPicker}
            </PopoverContent>
          </Popover>
        )}

        {/* View toggle + PDF */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="grid grid-cols-3 rounded-md border border-border flex-1 sm:flex sm:flex-initial">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              viewMode === "timeline"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } rounded-l-md`}
          >
            <AlignLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-x border-border ${
              viewMode === "calendar"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("gallery")}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              viewMode === "gallery"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } rounded-r-md`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Gallery</span>
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-1.5 sm:flex"
          onClick={() => window.open("/api/diary/pdf", "_blank")}
        >
          <FileText className="h-3.5 w-3.5" />
          PDF
        </Button>
        </div>
      </div>

      {/* View content */}
      {viewMode === "timeline" && (
        <DiaryTimeline onEditEntry={handleEditEntry} />
      )}
      {viewMode === "calendar" && (
        <DiaryCalendar onSelectDate={handleEditEntry} />
      )}
      {viewMode === "gallery" && <DiaryGallery />}
    </div>
  );
}
