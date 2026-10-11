"use client";

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "calendar:visible-calendars";

// Module-level shared state — all hook instances see the same data
let visibleIds: Set<string> | null = null;
const listeners = new Set<() => void>();

// Load from localStorage once at module init
if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      visibleIds = new Set(JSON.parse(stored) as string[]);
    } catch {
      // ignore corrupt data
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Set<string> | null {
  return visibleIds;
}

function getServerSnapshot(): Set<string> | null {
  return null;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function persist() {
  if (visibleIds) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(visibleIds))
    );
  }
}

export function useCalendarVisibility() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const initializeFrom = useCallback((calendarIds: string[]) => {
    if (visibleIds !== null) return; // already initialized
    visibleIds = new Set(calendarIds);
    persist();
    notify();
  }, []);

  const toggleCalendar = useCallback((calendarId: string) => {
    const next = new Set(visibleIds ?? []);
    if (next.has(calendarId)) {
      next.delete(calendarId);
    } else {
      next.add(calendarId);
    }
    visibleIds = next;
    persist();
    notify();
  }, []);

  const isVisible = useCallback(
    (calendarId: string) => {
      if (ids === null) return true;
      return ids.has(calendarId);
    },
    [ids]
  );

  const visibleCalendarIds = ids ?? new Set<string>();

  return { visibleCalendarIds, toggleCalendar, isVisible, initializeFrom };
}
