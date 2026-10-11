"use client";

import { useRouter } from "next/navigation";
import {
  Plus,
  CalendarDays,
  ListTodo,
  Clock,
  BookHeart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickActions() {
  const router = useRouter();

  const actions = [
    {
      label: "New Task",
      icon: Plus,
      shortcut: "T",
      action: () => router.push("/dashboard/tasks?new=1"),
    },
    {
      label: "Log Shift",
      icon: Clock,
      shortcut: "S",
      action: () => router.push("/dashboard/shifts?new=1"),
    },
    {
      label: "Calendar",
      icon: CalendarDays,
      shortcut: "G C",
      action: () => router.push("/dashboard/calendar"),
    },
    {
      label: "Tasks",
      icon: ListTodo,
      shortcut: "G T",
      action: () => router.push("/dashboard/tasks"),
    },
    {
      label: "Diary",
      icon: BookHeart,
      shortcut: "G I",
      action: () => router.push("/dashboard/diary"),
    },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.label}
          variant="outline"
          size="default"
          className="gap-1.5 border-border text-muted-foreground hover:border-border/60 hover:text-foreground sm:h-9 sm:px-3 sm:text-sm"
          onClick={a.action}
        >
          <a.icon className="h-4 w-4" />
          {a.label}
          <kbd className="ml-0.5 hidden rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground/60 sm:inline">
            {a.shortcut}
          </kbd>
        </Button>
      ))}
    </div>
  );
}
