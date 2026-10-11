"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const categories = [
  { value: "", label: "All" },
  { value: "school", label: "School" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
];

interface TaskFiltersProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function TaskFilters({
  activeCategory,
  onCategoryChange,
}: TaskFiltersProps) {
  return (
    <div className="flex gap-1">
      {categories.map((cat) => (
        <Button
          key={cat.value}
          variant="ghost"
          size="sm"
          onClick={() => onCategoryChange(cat.value)}
          className={cn(
            "h-7 text-xs",
            activeCategory === cat.value
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {cat.label}
        </Button>
      ))}
    </div>
  );
}
