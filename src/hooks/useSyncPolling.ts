"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const POLL_INTERVAL = 5_000; // 5 seconds

/**
 * Polls /api/sync every 5s. When the server version changes
 * (meaning a mutation happened on another device/tab),
 * invalidates all React Query caches so data refetches.
 */
export function useSyncPolling() {
  const queryClient = useQueryClient();
  const lastVersion = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) return;
        const { v } = (await res.json()) as { v: number };

        if (lastVersion.current !== null && v !== lastVersion.current) {
          // Version changed — something was mutated on another device
          queryClient.invalidateQueries();
        }
        lastVersion.current = v;
      } catch {
        // Network error, skip this poll
      }
    }

    // Initial fetch to set baseline
    poll();
    timer = setInterval(poll, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [queryClient]);
}
