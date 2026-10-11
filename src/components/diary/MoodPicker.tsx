"use client";

import {
  Smile,
  SmilePlus,
  Meh,
  Moon,
  Frown,
  Zap,
  Flame,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const MOODS: {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  selectedClasses: string;
}[] = [
  {
    key: "happy",
    label: "Happy",
    icon: Smile,
    color: "text-green-400",
    selectedClasses:
      "text-green-400 bg-green-400/10 border-green-400/30 ring-1 ring-green-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "good",
    label: "Good",
    icon: SmilePlus,
    color: "text-emerald-400",
    selectedClasses:
      "text-emerald-400 bg-emerald-400/10 border-emerald-400/30 ring-1 ring-emerald-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "neutral",
    label: "Neutral",
    icon: Meh,
    color: "text-yellow-400",
    selectedClasses:
      "text-yellow-400 bg-yellow-400/10 border-yellow-400/30 ring-1 ring-yellow-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "tired",
    label: "Tired",
    icon: Moon,
    color: "text-blue-400",
    selectedClasses:
      "text-blue-400 bg-blue-400/10 border-blue-400/30 ring-1 ring-blue-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "sad",
    label: "Sad",
    icon: Frown,
    color: "text-purple-400",
    selectedClasses:
      "text-purple-400 bg-purple-400/10 border-purple-400/30 ring-1 ring-purple-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "stressed",
    label: "Stressed",
    icon: Zap,
    color: "text-orange-400",
    selectedClasses:
      "text-orange-400 bg-orange-400/10 border-orange-400/30 ring-1 ring-orange-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "angry",
    label: "Angry",
    icon: Flame,
    color: "text-red-400",
    selectedClasses:
      "text-red-400 bg-red-400/10 border-red-400/30 ring-1 ring-red-400/30 ring-offset-1 ring-offset-background",
  },
  {
    key: "excited",
    label: "Excited",
    icon: Sparkles,
    color: "text-pink-400",
    selectedClasses:
      "text-pink-400 bg-pink-400/10 border-pink-400/30 ring-1 ring-pink-400/30 ring-offset-1 ring-offset-background",
  },
];

interface MoodPickerProps {
  value?: string | null;
  onChange: (mood: string | null) => void;
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:flex sm:flex-wrap">
      {MOODS.map(({ key, label, icon: Icon, selectedClasses }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(selected ? null : key)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                selected
                  ? selectedClasses
                  : "border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Get the Lucide icon component for a mood key */
export function getMoodIcon(moodKey: string | null | undefined) {
  if (!moodKey) return null;
  const mood = MOODS.find((m) => m.key === moodKey);
  if (!mood) return null;
  return { Icon: mood.icon, color: mood.color, label: mood.label };
}

export const MOOD_BORDER_COLORS: Record<string, string> = {
  happy: "border-l-green-400",
  good: "border-l-emerald-400",
  neutral: "border-l-yellow-400",
  tired: "border-l-blue-400",
  sad: "border-l-purple-400",
  stressed: "border-l-orange-400",
  angry: "border-l-red-400",
  excited: "border-l-pink-400",
};

export { MOODS };
