"use client";

import {
  GraduationCap,
  Briefcase,
  Users,
  Plane,
  UtensilsCrossed,
  Heart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TAGS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "school", label: "School", icon: GraduationCap },
  { key: "work", label: "Work", icon: Briefcase },
  { key: "social", label: "Social", icon: Users },
  { key: "travel", label: "Travel", icon: Plane },
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "personal", label: "Personal", icon: Heart },
];

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagPicker({ value, onChange }: TagPickerProps) {
  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {TAGS.map(({ key, label, icon: Icon }) => {
        const selected = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`flex items-center rounded-md px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium transition-colors ${
              selected
                ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                : "border border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Icon className="w-3 h-3 mr-1 sm:w-3.5 sm:h-3.5 sm:mr-1.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function getTagIcon(tagKey: string) {
  const tag = TAGS.find((t) => t.key === tagKey);
  return tag?.icon ?? null;
}

export { TAGS };
