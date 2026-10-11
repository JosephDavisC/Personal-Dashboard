"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const themeColors = {
  dark: {
    text: "#a1a1aa",
    grid: "#27272a",
    tooltipBg: "#18181b",
    tooltipBorder: "#3f3f46",
    tooltipText: "#fafafa",
  },
  light: {
    text: "#71717a",
    grid: "#e4e4e7",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e4e4e7",
    tooltipText: "#09090b",
  },
};

const siteColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

interface SiteResponseData {
  id: string;
  label: string;
  data: { time: string; responseTime: number }[];
}

interface ResponseTimeChartProps {
  sites: SiteResponseData[];
}

export function ResponseTimeChart({ sites }: ResponseTimeChartProps) {
  const { resolvedTheme } = useTheme();
  const [selectedSite, setSelectedSite] = useState("all");
  const colors = themeColors[resolvedTheme === "dark" ? "dark" : "light"];

  const filteredSites =
    selectedSite === "all"
      ? sites
      : sites.filter((s) => s.id === selectedSite);

  const mergedData = mergeTimeSeries(filteredSites);
  const hasData = sites.some((s) => s.data.length >= 2);
  const showingAll = selectedSite === "all";

  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Response Times (24h)
        </p>
        {hasData && (
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {hasData ? (
        <>
          <div className="h-[180px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={mergedData}
                margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: colors.text }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                  }}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: colors.text }}
                  tickFormatter={(v: number) => `${v}ms`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: 8,
                    color: colors.tooltipText,
                    fontSize: 11,
                  }}
                  labelFormatter={(v) => {
                    const d = new Date(String(v));
                    return d.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }}
                  formatter={(value, name) => [
                    `${value}ms`,
                    String(name),
                  ]}
                />
                {filteredSites.map((site, i) => (
                  <Area
                    key={site.id}
                    type="monotone"
                    dataKey={site.label}
                    stroke={siteColors[i % siteColors.length]}
                    fill={siteColors[i % siteColors.length]}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={showingAll ? false : { r: 3, fill: siteColors[i % siteColors.length] }}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Legend below chart for better mobile layout */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {filteredSites.map((site, i) => (
              <button
                key={site.id}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSelectedSite(site.id === selectedSite ? "all" : site.id)}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: siteColors[i % siteColors.length] }}
                />
                {site.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-[180px] flex-col items-center justify-center text-muted-foreground/50">
          <TrendingUp className="mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Response time data will appear here</p>
          <p className="mt-1 text-xs">Collecting data every 60 seconds</p>
        </div>
      )}
    </div>
  );
}

function mergeTimeSeries(sites: SiteResponseData[]) {
  const timeMap = new Map<string, Record<string, number | string>>();

  for (const site of sites) {
    for (const point of site.data) {
      const existing = timeMap.get(point.time) ?? { time: point.time };
      existing[site.label] = point.responseTime;
      timeMap.set(point.time, existing);
    }
  }

  return Array.from(timeMap.values()).sort(
    (a, b) =>
      new Date(a.time as string).getTime() -
      new Date(b.time as string).getTime()
  );
}
