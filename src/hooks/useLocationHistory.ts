"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "calendar:location-history";
const MAX_HISTORY = 50;

export function useLocationHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored) as string[]);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  }, [history]);

  const addLocation = useCallback((location: string) => {
    const trimmed = location.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((l) => l !== trimmed);
      return [trimmed, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const searchLocations = useCallback(
    (query: string): string[] => {
      if (!query.trim()) return history.slice(0, 8);
      const lower = query.toLowerCase();
      return history
        .filter((l) => l.toLowerCase().includes(lower))
        .slice(0, 8);
    },
    [history]
  );

  return { addLocation, searchLocations };
}
