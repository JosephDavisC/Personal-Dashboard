"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { STROKES, STROKE_COLORS } from "@/lib/tennis/constants";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface HistoryEntry {
  id: string;
  date: string;
  stageNumber: number;
  ratedBy: string;
  forehand: number;
  bhTopspin: number;
  bhSlice: number;
  serve: number;
  volley: number;
  overhead: number;
  returnOf: number;
}

interface StageBreak {
  stageNumber: number;
  completedAt: string;
  label: string;
}

interface RatingHistoryChartProps {
  raterFilter: string;
}

export function RatingHistoryChart({ raterFilter }: RatingHistoryChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [strokeFilter, setStrokeFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<"current" | "all">("current");

  const { data } = useQuery({
    queryKey: ["tennis-ratings-history", raterFilter, stageFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (raterFilter !== "all") params.set("ratedBy", raterFilter);
      if (stageFilter === "current") params.set("currentOnly", "true");
      const res = await fetch(`/api/tennis/ratings/history?${params}`);
      if (!res.ok) return { history: [], stageBreaks: [] };
      return res.json() as Promise<{
        history: HistoryEntry[];
        stageBreaks: StageBreak[];
      }>;
    },
  });

  if (!data || data.history.length < 2) {
    return null;
  }

  // Build chart data (group by date, pick latest per date+rater)
  const byDate = new Map<string, Record<string, number>>();
  for (const entry of data.history) {
    const existing = byDate.get(entry.date) ?? {};
    for (const s of STROKES) {
      const val = entry[s.key] as number;
      // If multiple entries on same date, use the latest (array is sorted asc)
      existing[s.key] = val;
    }
    byDate.set(entry.date, existing);
  }

  const chartData = Array.from(byDate.entries())
    .map(([date, ratings]) => ({
      date,
      ...ratings,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const visibleStrokes =
    strokeFilter === "all"
      ? STROKES
      : STROKES.filter((s) => s.key === strokeFilter);

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-heading text-lg font-semibold">Rating History</h3>

      {/* Stage filter */}
      <div className="flex gap-1">
        {(["current", "all"] as const).map((f) => (
          <button
            key={f}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              stageFilter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setStageFilter(f)}
          >
            {f === "current" ? "Current Stage" : "All Stages"}
          </button>
        ))}
      </div>

      <div className="w-full h-[250px] sm:h-[300px]">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#374151" : "#e5e7eb"}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 }}
              tickFormatter={(v: string) =>
                new Date(v + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1a2540" : "#fff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "8px",
              }}
            />

            {/* Stage break markers */}
            {stageFilter === "all" &&
              data.stageBreaks.map((sb) => (
                <ReferenceLine
                  key={sb.completedAt}
                  x={sb.completedAt}
                  stroke={isDark ? "#6b7280" : "#9ca3af"}
                  strokeDasharray="4 4"
                  label={{
                    value: sb.label,
                    position: "top",
                    fill: isDark ? "#9ca3af" : "#6b7280",
                    fontSize: 10,
                  }}
                />
              ))}

            {visibleStrokes.map((stroke) => (
              <Line
                key={stroke.key}
                type="monotone"
                dataKey={stroke.key}
                name={stroke.label}
                stroke={STROKE_COLORS[stroke.key]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}

            <Legend />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stroke filter */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        <button
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
            strokeFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
          onClick={() => setStrokeFilter("all")}
        >
          All
        </button>
        {STROKES.map((s) => (
          <button
            key={s.key}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              strokeFilter === s.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setStrokeFilter(s.key)}
          >
            {s.shortLabel}
          </button>
        ))}
      </div>
    </Card>
  );
}
