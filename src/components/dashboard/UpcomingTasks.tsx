"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, CheckSquare, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { priorityColors } from "@/lib/badge-colors";
import { format, isPast, isToday, isBefore, addDays } from "date-fns";
import type { Task } from "@/generated/prisma/client";

export function UpcomingTasks() {
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      const json = (await res.json()) as { data: Task[] };
      return json.data;
    },
    refetchInterval: 5_000,
  });

  const upcoming = tasks
    .filter((t) => t.status !== "DONE" && t.status !== "ARCHIVED")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 8);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          Upcoming Tasks
        </CardTitle>
        <Link
          href="/dashboard/tasks"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground/60">
            No upcoming tasks.
          </p>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((task) => {
              const dueDateLocal = task.dueDate
                ? (() => {
                    const d = new Date(task.dueDate);
                    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                  })()
                : null;
              const isOverdue = dueDateLocal && isPast(dueDateLocal);
              const isDueToday = dueDateLocal && isToday(dueDateLocal);
              const isDueSoon =
                dueDateLocal && isBefore(dueDateLocal, addDays(new Date(), 3));

              return (
                <Link
                  key={task.id}
                  href="/dashboard/tasks"
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-4 py-3 transition-all hover:border-border/60 hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {task.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[11px]",
                          priorityColors[task.priority]
                        )}
                      >
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-xs",
                            isOverdue
                              ? "text-red-400"
                              : isDueToday
                                ? "text-orange-400"
                                : isDueSoon
                                  ? "text-yellow-400"
                                  : "text-muted-foreground"
                          )}
                        >
                          <Calendar className="h-3 w-3" />
                          {dueDateLocal && format(dueDateLocal, "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-border text-[11px] text-muted-foreground"
                  >
                    {task.status === "IN_PROGRESS" ? "In Progress" : "To Do"}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
