"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Link2,
  ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { priorityColors, taskCategoryColors } from "@/lib/badge-colors";
import { format, isPast, isToday } from "date-fns";
import type { TaskWithPhotos } from "./TaskBoard";
import React from "react";

/** Renders **bold** markers as <strong> elements */
function renderBoldText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

interface TaskCardProps {
  task: TaskWithPhotos;
  onOpen: (task: TaskWithPhotos) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, status: string) => void;
  onReorder?: (id: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function TaskCard({ task, onOpen, onDelete, onMove, onReorder, canMoveUp, canMoveDown }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  // Use UTC components to avoid timezone-induced day shift on date-only values
  const dueDateLocal = task.dueDate
    ? (() => {
        const d = new Date(task.dueDate);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      })()
    : null;
  const isOverdue = dueDateLocal && isPast(dueDateLocal) && task.status !== "DONE";
  const isDueToday = dueDateLocal && isToday(dueDateLocal);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab touch-none border-border bg-card/80 p-3 transition-all duration-200 hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-40 scale-[0.98] shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 cursor-pointer rounded-md px-1 py-0.5 transition-colors hover:bg-accent/30" onClick={() => onOpen(task)}>
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {renderBoldText(task.description)}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn("text-[10px]", priorityColors[task.priority])}
            >
              {task.priority}
            </Badge>
            {task.category && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  taskCategoryColors[task.category] ?? "bg-accent text-foreground/80"
                )}
              >
                {task.category}
              </Badge>
            )}
            {task.dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 text-[10px]",
                  isOverdue
                    ? "text-red-400"
                    : isDueToday
                      ? "text-orange-400"
                      : "text-muted-foreground"
                )}
              >
                <Calendar className="h-3 w-3" />
                {dueDateLocal && format(dueDateLocal, "MMM d")}
              </span>
            )}
            {Array.isArray(task.links) && task.links.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Link2 className="h-3 w-3" />
                {task.links.length}
              </span>
            )}
            {task.photos && task.photos.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ImageIcon className="h-3 w-3" />
                {task.photos.length}
              </span>
            )}
          </div>
        </div>

        {/* Desktop: reorder buttons */}
        <div className="hidden shrink-0 gap-1 lg:flex">
          {onReorder && (
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20"
                onClick={(e) => { e.stopPropagation(); onReorder(task.id, "up"); }}
                disabled={!canMoveUp}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground/40 hover:text-foreground/80 disabled:opacity-20"
                onClick={(e) => { e.stopPropagation(); onReorder(task.id, "down"); }}
                disabled={!canMoveDown}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Mobile + Tablet: three-dot menu */}
        <div className="shrink-0 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onReorder && (canMoveUp || canMoveDown) && (
                <>
                  {canMoveUp && (
                    <DropdownMenuItem onClick={() => onReorder(task.id, "up")}>
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Move Up
                    </DropdownMenuItem>
                  )}
                  {canMoveDown && (
                    <DropdownMenuItem onClick={() => onReorder(task.id, "down")}>
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Move Down
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              {STATUS_OPTIONS.filter((s) => s.value !== task.status).map(
                (s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => onMove?.(task.id, s.value)}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Move to {s.label}
                  </DropdownMenuItem>
                )
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpen(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(task.id)}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
