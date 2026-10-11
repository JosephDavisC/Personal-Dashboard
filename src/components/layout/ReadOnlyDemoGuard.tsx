"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { READ_ONLY_HEADER } from "@/lib/demo";

/**
 * In the read-only demo the server refuses every change. This turns those
 * refusals into one friendly notice instead of each component's own
 * "Failed to save" (or misleading "Saved") toast.
 */
export function ReadOnlyDemoGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;
    const originalError = toast.error;
    const originalSuccess = toast.success;
    let lastBlockedAt = 0;
    const justBlocked = () => Date.now() - lastBlockedAt < 2000;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      if (res.status === 403 && res.headers.get(READ_ONLY_HEADER) === "1") {
        const now = Date.now();
        if (now - lastBlockedAt > 1500) {
          toast.info("Read-only demo", {
            id: "read-only-demo",
            description: "Changes are not saved here. Clone the repo to run your own dashboard.",
          });
        }
        lastBlockedAt = now;
      }
      return res;
    };

    // Swallow the component's own toast after a refused change: its error
    // would be noise, and some forms announce success without checking.
    toast.error = ((...args: Parameters<typeof toast.error>) => {
      if (justBlocked()) return "";
      return originalError(...args);
    }) as typeof toast.error;
    toast.success = ((...args: Parameters<typeof toast.success>) => {
      if (justBlocked()) return "";
      return originalSuccess(...args);
    }) as typeof toast.success;

    return () => {
      window.fetch = originalFetch;
      toast.error = originalError;
      toast.success = originalSuccess;
    };
  }, []);

  return null;
}
