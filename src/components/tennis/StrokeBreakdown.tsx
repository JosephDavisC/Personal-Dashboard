"use client";

import { STROKES, getRaterLabel as getLabel } from "@/lib/tennis/constants";
import { cn } from "@/lib/utils";

interface StrokeBreakdownProps {
  averageRatings: Record<string, number>;
  latestByRater: Record<string, Record<string, number | string>>;
  raterFilter: string;
}

function getBarColor(value: number): string {
  if (value >= 9.0) return "bg-green-500";
  if (value >= 7.0) return "bg-blue-500";
  if (value >= 5.0) return "bg-yellow-500";
  if (value >= 3.0) return "bg-orange-500";
  return "bg-red-500";
}

function getRaterLabel(rater: string): string {
  if (rater === "self") return "You";
  return getLabel(rater);
}

export function StrokeBreakdown({
  averageRatings,
  latestByRater,
  raterFilter,
}: StrokeBreakdownProps) {
  return (
    <div className="space-y-3">
      {STROKES.map((stroke) => {
        const displayRating =
          raterFilter === "all"
            ? averageRatings[stroke.key] || 0
            : (latestByRater[raterFilter]?.[stroke.key] as number) || 0;

        const raterRatings: Record<string, number> = {};
        for (const [rater, ratings] of Object.entries(latestByRater)) {
          raterRatings[rater] = (ratings[stroke.key] as number) || 0;
        }

        return (
          <div key={stroke.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{stroke.label}</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  displayRating >= 9.0 && "text-green-500"
                )}
              >
                {displayRating.toFixed(1)} / 10
              </span>
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  getBarColor(displayRating)
                )}
                style={{ width: `${(displayRating / 10) * 100}%` }}
              />
            </div>

            {raterFilter === "all" &&
              Object.keys(raterRatings).length > 1 && (
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {Object.entries(raterRatings).map(([rater, value]) => (
                    <span key={rater}>
                      <span className="capitalize">
                        {getRaterLabel(rater)}
                      </span>
                      : {value.toFixed(1)}
                    </span>
                  ))}
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
