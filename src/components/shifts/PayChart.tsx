"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import type { Shift } from "@/generated/prisma/client";
import { SHIFT_LOCATIONS, shiftLocationLabel } from "@/config/shifts";

interface PayChartProps {
  shifts: Shift[];
}

const colors = {
  dark: {
    text: "#e4e4e7",
    grid: "#3f3f46",
    cursor: "#27272a",
    tooltipBg: "#18181b",
    tooltipBorder: "#3f3f46",
    tooltipText: "#fafafa",
  },
  light: {
    text: "#18181b",
    grid: "#e4e4e7",
    cursor: "#f4f4f5",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e4e4e7",
    tooltipText: "#09090b",
  },
};

export function PayChart({ shifts }: PayChartProps) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? colors.dark : colors.light;

  const data = useMemo(() => {
    const weekMap = new Map<number, Record<string, number>>();

    for (const shift of shifts) {
      const day = parseInt(
        formatInTimeZone(new Date(shift.date), TIMEZONE, "d"),
        10
      );
      const week = Math.ceil(day / 7);
      const existing = weekMap.get(week) ?? {};
      const label = shiftLocationLabel(shift.location);
      existing[label] = (existing[label] ?? 0) + shift.netPay;
      weekMap.set(week, existing);
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, totals]) => ({
        name: `Week ${week}`,
        ...Object.fromEntries(
          SHIFT_LOCATIONS.map((l) => [l.label, parseFloat((totals[l.label] ?? 0).toFixed(2))])
        ),
      }));
  }, [shifts]);

  if (data.length === 0) return null;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} barSize={32}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={c.grid}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: c.text, fontSize: 12, fontWeight: 500 }}
            axisLine={{ stroke: c.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: c.text, fontSize: 12 }}
            axisLine={{ stroke: c.grid }}
            tickLine={false}
            tickFormatter={(v: number) => `$${v}`}
            width={55}
          />
          <Tooltip
            cursor={{ fill: c.cursor, opacity: 0.5 }}
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: "8px",
              fontSize: "13px",
              color: c.tooltipText,
              padding: "8px 12px",
            }}
            formatter={(value: number | undefined) =>
              value != null ? `$${value.toFixed(2)}` : ""
            }
          />
          <Legend
            wrapperStyle={{
              fontSize: "12px",
              paddingTop: "8px",
            }}
            formatter={(value: string) => (
              <span style={{ color: c.text }}>{value}</span>
            )}
          />
          {SHIFT_LOCATIONS.map((l) => (
            <Bar
              key={l.key}
              dataKey={l.label}
              fill={l.chartColor}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
