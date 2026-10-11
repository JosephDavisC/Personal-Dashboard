"use client";

import { useState, useEffect } from "react";

interface OverallStatsProps {
  sites: { uptime90d: number | null; lastChecked: string | null }[];
  siteCount: number;
}

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function OverallStats({ sites, siteCount }: OverallStatsProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const uptimes = sites
    .map((s) => s.uptime90d)
    .filter((u): u is number => u !== null);
  const overallUptime =
    uptimes.length > 0
      ? Math.round((uptimes.reduce((a, b) => a + b, 0) / uptimes.length) * 100) / 100
      : null;

  const lastCheckedTimes = sites
    .map((s) => (s.lastChecked ? new Date(s.lastChecked).getTime() : 0))
    .filter((t) => t > 0);
  const mostRecent =
    lastCheckedTimes.length > 0 ? Math.max(...lastCheckedTimes) : null;
  const secondsAgo = mostRecent ? Math.max(0, Math.floor((now - mostRecent) / 1000)) : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/60 py-3 text-xs sm:text-sm">
      {overallUptime !== null && (
        <span className="text-muted-foreground">
          Overall:{" "}
          <span className="font-semibold text-emerald-400">{overallUptime}%</span>{" "}
          uptime
        </span>
      )}
      <span className="text-muted-foreground/40">&middot;</span>
      <span className="text-muted-foreground">{siteCount} sites</span>
      <span className="text-muted-foreground/40">&middot;</span>
      {secondsAgo !== null ? (
        <span className="text-muted-foreground">
          Last checked{" "}
          <span className="text-foreground">{formatTimeAgo(secondsAgo)} ago</span>
        </span>
      ) : (
        <span className="text-muted-foreground">No checks yet</span>
      )}
    </div>
  );
}
