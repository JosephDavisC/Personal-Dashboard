"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseISO } from "date-fns";
import { CalendarView } from "@/components/calendar/CalendarView";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";

function CalendarContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchParams = useSearchParams();

  const initialDate = useMemo(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam) return undefined;
    const parsed = parseISO(dateParam);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }, [searchParams]);

  return (
    <div className="flex flex-col lg:h-full">
      <div className="flex shrink-0 items-center justify-between pb-4">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Calendar
        </h1>
        <Button
          variant="outline"
          size="default"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Calendars
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="hidden w-60 shrink-0 overflow-y-auto lg:block">
          <CalendarSidebar />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <CalendarView initialDate={initialDate} highlightTime={searchParams.get("time") ?? undefined} />
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle>Filter Calendars</SheetTitle>
          </SheetHeader>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            <CalendarSidebar />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarContent />
    </Suspense>
  );
}
