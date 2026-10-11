"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { STROKES, getRaterColor } from "@/lib/tennis/constants";
import { useTheme } from "next-themes";

interface StrokeRadarChartProps {
  averageRatings: Record<string, number>;
  latestByRater: Record<string, Record<string, number | string>>;
  raterFilter: string;
}

export function StrokeRadarChart({
  averageRatings,
  latestByRater,
  raterFilter,
}: StrokeRadarChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartData = STROKES.map((stroke) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataPoint: any = {
      stroke: stroke.shortLabel,
      fullName: stroke.label,
    };

    if (raterFilter === "all") {
      dataPoint.average = averageRatings[stroke.key] || 0;
      for (const [rater, ratings] of Object.entries(latestByRater)) {
        dataPoint[rater] = (ratings[stroke.key] as number) || 0;
      }
    } else {
      dataPoint.value =
        (latestByRater[raterFilter]?.[stroke.key] as number) || 0;
    }

    return dataPoint;
  });

  return (
    <div className="w-full aspect-square max-w-[350px] mx-auto">
      <ResponsiveContainer>
        <RadarChart data={chartData}>
          <PolarGrid stroke={isDark ? "#475569" : "#d1d5db"} />
          <PolarAngleAxis
            dataKey="stroke"
            tick={{
              fill: isDark ? "#e4e4e7" : "#3f3f46",
              fontSize: 12,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{
              fill: isDark ? "#9ca3af" : "#6b7280",
              fontSize: 10,
            }}
          />

          {raterFilter === "all" ? (
            <>
              {Object.keys(latestByRater).map((rater) => (
                <Radar
                  key={rater}
                  name={rater}
                  dataKey={rater}
                  stroke={getRaterColor(rater)}
                  fill="transparent"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  strokeOpacity={0.4}
                />
              ))}
              <Radar
                name="Average"
                dataKey="average"
                stroke={isDark ? "#60A5FA" : "#4CBB17"}
                fill={isDark ? "#60A5FA" : "#4CBB17"}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 3, fill: isDark ? "#60A5FA" : "#4CBB17", strokeWidth: 0 }}
              />
            </>
          ) : (
            <Radar
              name={raterFilter}
              dataKey="value"
              stroke={getRaterColor(raterFilter)}
              fill={getRaterColor(raterFilter)}
              fillOpacity={0.2}
              strokeWidth={2}
              dot={{ r: 3, fill: getRaterColor(raterFilter), strokeWidth: 0 }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
