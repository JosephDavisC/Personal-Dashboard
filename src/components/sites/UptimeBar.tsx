"use client";

import { useState } from "react";

export interface DayData {
  date: string;
  uptimePercent: number;
  avgResponseTime: number;
  totalPings: number;
}

interface UptimeBarProps {
  data: (DayData | null)[];
}

function getCellColor(day: DayData | null): string {
  if (!day) return "dark:bg-zinc-600/40 bg-zinc-300";
  if (day.uptimePercent === 100) return "bg-green-500";
  if (day.uptimePercent >= 99.5) return "bg-green-700";
  if (day.uptimePercent >= 95) return "bg-yellow-500";
  return "bg-red-500";
}

export function UptimeBar({ data }: UptimeBarProps) {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="relative">
      <div className="flex items-stretch" style={{ gap: "1px" }}>
        {data.map((day, i) => {
          const dateLabel = day?.date
            ? new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";

          return (
            <div
              key={i}
              className={`h-5 flex-1 rounded-[2px] transition-opacity hover:opacity-80 ${getCellColor(day)}`}
              style={{ minWidth: "2px" }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const text = day
                  ? `${dateLabel} — ${day.uptimePercent}% uptime, avg ${day.avgResponseTime}ms`
                  : `${dateLabel || "No data"}`;
                setTooltip({
                  text,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
        <span>90 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
