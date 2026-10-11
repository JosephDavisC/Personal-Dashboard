"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, BookOpen, CalendarDays } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DiaryCard } from "./DiaryCard";
import type { DiaryEntry, DiaryPhoto } from "@/generated/prisma/client";

type PhotoWithMime = DiaryPhoto & { mimeType?: string | null };
type EntryWithPhotos = DiaryEntry & { photos: PhotoWithMime[] };

interface DiaryTimelineProps {
  onEditEntry: (date: string) => void;
}

export function DiaryTimeline({ onEditEntry }: DiaryTimelineProps) {
  const [pastDateOpen, setPastDateOpen] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["diary-entries"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "10" });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/diary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch entries");
      return (await res.json()) as { entries: EntryWithPhotos[]; nextCursor: string | null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const entries = data?.pages.flatMap((p) => p.entries) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
          No diary entries yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Start writing about your day
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <DiaryCard
          key={entry.id}
          entry={entry}
          onClick={() =>
            onEditEntry(formatInTimeZone(new Date(entry.date), TIMEZONE, "yyyy-MM-dd"))
          }
        />
      ))}

      {/* Past day prompt + Load more */}
      <div className="flex items-center justify-center gap-3 pt-2">
        {hasNextPage && (
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        )}
        <Popover open={pastDateOpen} onOpenChange={setPastDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Write about a past day
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={(day) => {
                if (day) {
                  onEditEntry(format(day, "yyyy-MM-dd"));
                  setPastDateOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
