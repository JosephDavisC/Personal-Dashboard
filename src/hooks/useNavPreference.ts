"use client";

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "settings:nav-mode";
type NavMode = "bottom" | "burger";

let currentMode: NavMode = "bottom";
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "burger" || stored === "bottom") {
    currentMode = stored;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NavMode {
  return currentMode;
}

function getServerSnapshot(): NavMode {
  return "bottom";
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function useNavPreference() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setNavMode = useCallback((m: NavMode) => {
    currentMode = m;
    localStorage.setItem(STORAGE_KEY, m);
    notify();
  }, []);

  return { navMode: mode, setNavMode };
}
