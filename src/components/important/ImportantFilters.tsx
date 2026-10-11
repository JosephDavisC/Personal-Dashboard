"use client";

import { Pin } from "lucide-react";
import { IMPORTANT_CATEGORIES, IMPORTANT_CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ImportantFiltersProps {
  category: string | null;
  onCategoryChange: (v: string | null) => void;
  pinnedOnly: boolean;
  onPinnedOnlyChange: (v: boolean) => void;
}

const pill =
  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors";
const pillActive = "border-primary/50 bg-primary/10 text-primary";
const pillInactive =
  "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground";

export function ImportantFilters({
  category,
  onCategoryChange,
  pinnedOnly,
  onPinnedOnlyChange,
}: ImportantFiltersProps) {
  return (
    <div
      className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      <button
        onClick={() => {
          onCategoryChange(null);
          onPinnedOnlyChange(false);
        }}
        className={cn(pill, !category && !pinnedOnly ? pillActive : pillInactive)}
      >
        All
      </button>

      {IMPORTANT_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(category === cat.value ? null : cat.value)}
          className={cn(
            pill,
            "flex items-center gap-1.5",
            category === cat.value ? pillActive : pillInactive
          )}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: IMPORTANT_CATEGORY_COLORS[cat.value] }}
          />
          {cat.label}
        </button>
      ))}

      <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />

      <button
        onClick={() => onPinnedOnlyChange(!pinnedOnly)}
        className={cn(
          pill,
          "flex items-center gap-1.5",
          pinnedOnly
            ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
            : pillInactive
        )}
      >
        <Pin className="h-3 w-3" />
        Pinned
      </button>
    </div>
  );
}
