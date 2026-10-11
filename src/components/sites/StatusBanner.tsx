"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteHealth } from "@/types/site";

interface StatusBannerProps {
  health: SiteHealth[];
  isLoading?: boolean;
}

export function StatusBanner({ health, isLoading }: StatusBannerProps) {
  if (isLoading || health.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Checking sites...</p>
      </div>
    );
  }

  const downCount = health.filter((s) => s.status !== "up").length;
  const allUp = downCount === 0;

  const dotColor = allUp ? "bg-emerald-500" : "bg-red-500";
  const pulseColor = allUp ? "bg-emerald-500" : "bg-red-500";

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border p-4",
        allUp
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      )}
    >
      <div className="relative flex items-center">
        <div
          className={cn(
            "h-3 w-3 rounded-full",
            dotColor,
            allUp
              ? "shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              : "shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          )}
        />
        <div
          className={cn(
            "absolute inset-0 h-3 w-3 animate-ping rounded-full opacity-30",
            pulseColor
          )}
        />
      </div>
      {allUp ? (
        <p className="font-medium text-emerald-600 dark:text-emerald-400">
          All Systems Operational
        </p>
      ) : (
        <p className="font-medium text-red-600 dark:text-red-400">
          {downCount} of {health.length} site{downCount > 1 ? "s" : ""} down
        </p>
      )}
    </div>
  );
}
