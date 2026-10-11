"use client";

import { useState } from "react";
import {
  Calendar,
  Briefcase,
  CheckSquare,
  PlusSquare,
  ArrowRightLeft,
  AlertTriangle,
  MapPin,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Pin,
  X,
} from "lucide-react";

interface DayContext {
  shifts: { location: string; label: string | null; hours: number; netPay: number; start: string; end: string }[];
  totalHours: number;
  totalPay: number;
  events: { title: string; time: string; location?: string }[];
  eventsCount: number;
  tasksCompleted: { title: string }[];
  tasksCreated?: { title: string; status: string }[];
  tasksMoved?: { title: string; status: string }[];
  manualTasks?: { id: string; title: string; status: string }[];
  sitesDown: { title: string }[];
}

interface AutoContextProps {
  context: DayContext | null | undefined;
  loading?: boolean;
  onRemoveManualTask?: (taskId: string) => void;
}

const EVENTS_COLLAPSED_LIMIT = 8;
const TASKS_COLLAPSED_LIMIT = 6;

const STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  ARCHIVED: "Archived",
};

export function AutoContext({ context, loading, onRemoveManualTask }: AutoContextProps) {
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-7 w-24 bg-muted rounded-full" />
        <div className="h-16 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!context) return null;

  const hasShifts = context.shifts.length > 0;
  const hasEvents = context.eventsCount > 0;
  const hasCompleted = context.tasksCompleted.length > 0;
  const hasCreated = (context.tasksCreated?.length ?? 0) > 0;
  const hasMoved = (context.tasksMoved?.length ?? 0) > 0;
  const hasManual = (context.manualTasks?.length ?? 0) > 0;
  const hasTasks = hasCompleted || hasCreated || hasMoved || hasManual;
  const hasIncidents = context.sitesDown.length > 0;

  if (!hasShifts && !hasEvents && !hasTasks && !hasIncidents) return null;

  const visibleEvents = eventsExpanded
    ? context.events
    : context.events.slice(0, EVENTS_COLLAPSED_LIMIT);
  const hasMoreEvents = context.events.length > EVENTS_COLLAPSED_LIMIT;

  // Combine all task items for collapse logic
  const allTaskItems: { id?: string; title: string; type: "completed" | "created" | "moved" | "manual"; status?: string }[] = [];
  for (const t of context.tasksCompleted) allTaskItems.push({ title: t.title, type: "completed" });
  for (const t of context.tasksCreated ?? []) allTaskItems.push({ title: t.title, type: "created", status: t.status });
  for (const t of context.tasksMoved ?? []) allTaskItems.push({ title: t.title, type: "moved", status: t.status });
  for (const t of context.manualTasks ?? []) allTaskItems.push({ id: t.id, title: t.title, type: "manual", status: t.status });

  const visibleTasks = tasksExpanded
    ? allTaskItems
    : allTaskItems.slice(0, TASKS_COLLAPSED_LIMIT);
  const hasMoreTasks = allTaskItems.length > TASKS_COLLAPSED_LIMIT;

  return (
    <div className="space-y-3">
      {/* Shifts */}
      {hasShifts && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-2 sm:p-3">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <Briefcase className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {context.shifts.length === 1 ? "Shift" : "Shifts"}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {context.totalHours.toFixed(1)}h
              <DollarSign className="h-3 w-3 ml-1" />
              ${context.totalPay.toFixed(0)}
            </span>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            {context.shifts.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm leading-snug text-foreground">
                <span className="text-muted-foreground">{s.start} – {s.end}</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{s.label ?? s.location}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {hasEvents && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-2 sm:p-3">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {context.eventsCount === 1 ? "Event" : `${context.eventsCount} Events`}
            </span>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            {visibleEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm leading-snug text-foreground">
                <span className="text-muted-foreground shrink-0">{e.time}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="truncate">{e.title}</span>
                {e.location && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">{e.location}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
          {hasMoreEvents && (
            <button
              type="button"
              onClick={() => setEventsExpanded(!eventsExpanded)}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {eventsExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show all {context.events.length} events
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Tasks */}
      {hasTasks && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-2 sm:p-3">
          <div className="flex items-center gap-2 mb-1 sm:mb-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {allTaskItems.length} {allTaskItems.length === 1 ? "Task" : "Tasks"}
            </span>
          </div>
          <div className="space-y-0.5">
            {visibleTasks.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm leading-snug group/task">
                {t.type === "completed" && <CheckSquare className="h-3 w-3 text-green-400 shrink-0" />}
                {t.type === "created" && <PlusSquare className="h-3 w-3 text-blue-400 shrink-0" />}
                {t.type === "moved" && <ArrowRightLeft className="h-3 w-3 text-yellow-400 shrink-0" />}
                {t.type === "manual" && <Pin className="h-3 w-3 text-purple-400 shrink-0" />}
                <span className="truncate text-foreground">{t.title}</span>
                {t.type !== "completed" && t.status && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                )}
                {t.type === "manual" && t.id && onRemoveManualTask && (
                  <button
                    type="button"
                    onClick={() => onRemoveManualTask(t.id!)}
                    className="shrink-0 text-muted-foreground hover:text-red-400 sm:opacity-0 sm:group-hover/task:opacity-100 transition-opacity ml-auto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {hasMoreTasks && (
            <button
              type="button"
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {tasksExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show all {allTaskItems.length} tasks
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Incidents */}
      {hasIncidents && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 sm:p-3">
          <div className="flex items-center gap-2 mb-1 sm:mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400/80">
              {context.sitesDown.length} {context.sitesDown.length === 1 ? "Incident" : "Incidents"}
            </span>
          </div>
          <div className="space-y-0.5">
            {context.sitesDown.map((s, i) => (
              <p key={i} className="text-sm text-red-400/80 truncate">{s.title}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact inline version for timeline cards */
export function AutoContextInline({ context }: { context: DayContext | null | undefined }) {
  if (!context) return null;

  const parts: string[] = [];
  if (context.eventsCount > 0) parts.push(`${context.eventsCount} events`);
  if (context.shifts.length > 0) parts.push(`${context.shifts.length} shifts`);
  const taskCount = context.tasksCompleted.length + (context.tasksCreated?.length ?? 0) + (context.tasksMoved?.length ?? 0) + (context.manualTasks?.length ?? 0);
  if (taskCount > 0) parts.push(`${taskCount} tasks`);

  if (parts.length === 0) return null;

  return (
    <span className="text-xs text-muted-foreground">
      {parts.join(" · ")}
    </span>
  );
}

export type { DayContext };
