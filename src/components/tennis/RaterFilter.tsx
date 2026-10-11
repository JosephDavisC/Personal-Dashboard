"use client";

import { getRaterLabel } from "@/lib/tennis/constants";
import { cn } from "@/lib/utils";

interface RaterFilterProps {
  raters: string[];
  activeRater: string;
  onChange: (rater: string) => void;
}

export function RaterFilter({ raters, activeRater, onChange }: RaterFilterProps) {
  const allRaters = [
    { key: "all", label: "All (avg)" },
    ...raters.map((r) => ({
      key: r,
      label: getRaterLabel(r),
    })),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
      {allRaters.map((rater) => (
        <button
          key={rater.key}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            activeRater === rater.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
          onClick={() => onChange(rater.key)}
        >
          {rater.label}
        </button>
      ))}
    </div>
  );
}
