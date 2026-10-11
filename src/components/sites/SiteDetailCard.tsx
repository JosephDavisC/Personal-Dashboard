"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { UptimeBar, type DayData } from "./UptimeBar";
import { ResponseSparkline } from "./ResponseSparkline";

interface SiteDetailCardProps {
  id: string;
  label: string;
  url: string;
  isUp: boolean | null;
  responseTime: number | null;
  uptime90d: number | null;
  dailyHistory: (DayData | null)[];
  responseTimes: { time: string; responseTime: number }[];
}

function StatusBadge({ isUp, responseTime }: { isUp: boolean | null; responseTime: number | null }) {
  if (isUp === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Unknown
      </span>
    );
  }
  if (!isUp) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
        Down
      </span>
    );
  }
  if (responseTime !== null && responseTime > 5000) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
        Degraded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
      Operational
    </span>
  );
}

export function SiteDetailCard({
  id,
  label,
  url,
  isUp,
  responseTime,
  uptime90d,
  dailyHistory,
  responseTimes,
}: SiteDetailCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayResponseTime =
    isUp === false
      ? "—"
      : responseTime !== null
        ? `${responseTime}ms`
        : null;

  return (
    <div id={`site-${id}`} className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {label}
            </h3>
            <StatusBadge isUp={isUp} responseTime={responseTime} />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {url.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {displayResponseTime && (
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {displayResponseTime}
            </span>
          )}
          {uptime90d !== null && (
            <span
              className={cn(
                "font-mono text-sm tabular-nums font-semibold",
                uptime90d >= 99.9
                  ? "text-emerald-400"
                  : uptime90d >= 99
                    ? "text-yellow-400"
                    : "text-red-400"
              )}
            >
              {uptime90d}%
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      <div className="px-4 pb-3">
        <UptimeBar data={dailyHistory} />
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Response Time (24h)
          </h4>
          {responseTimes.length >= 5 ? (
            <ResponseSparkline data={responseTimes} expanded />
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground/40">
              Collecting response data...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
