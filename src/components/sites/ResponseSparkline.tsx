"use client";

import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const themeColors = {
  dark: {
    stroke: "#60A5FA",
    fill: "#60A5FA",
    tick: "#8b95a5",
    tooltipBg: "#18181b",
    tooltipBorder: "#3f3f46",
    tooltipText: "#fafafa",
  },
  light: {
    stroke: "#4CBB17",
    fill: "#4CBB17",
    tick: "#78716c",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e4e4e7",
    tooltipText: "#09090b",
  },
};

interface ResponseSparklineProps {
  data: { time: string; responseTime: number }[];
  expanded?: boolean;
}

export function ResponseSparkline({ data, expanded }: ResponseSparklineProps) {
  const { resolvedTheme } = useTheme();
  const colors = themeColors[resolvedTheme === "dark" ? "dark" : "light"];

  if (data.length < 5) {
    return (
      <div className="flex h-10 items-center">
        <span className="text-[10px] text-muted-foreground/40">
          Collecting response data...
        </span>
      </div>
    );
  }

  if (expanded) {
    return (
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="expandedSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.fill} stopOpacity={0.2} />
                <stop offset="95%" stopColor={colors.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: colors.tick }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
              }}
              interval="preserveStartEnd"
              minTickGap={60}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: colors.tick }}
              tickFormatter={(v: number) => `${v}ms`}
              width={50}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: 8,
                color: colors.tooltipText,
                fontSize: 12,
              }}
              labelFormatter={(v) => {
                const d = new Date(String(v));
                return d.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }}
              formatter={(value) => [`${value}ms`, "Response Time"]}
            />
            <Area
              type="monotone"
              dataKey="responseTime"
              stroke={colors.stroke}
              strokeWidth={1.5}
              fill="url(#expandedSparkFill)"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors.fill} stopOpacity={0.2} />
              <stop offset="95%" stopColor={colors.fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="responseTime"
            stroke={colors.stroke}
            strokeWidth={1.5}
            fill="url(#sparkFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
