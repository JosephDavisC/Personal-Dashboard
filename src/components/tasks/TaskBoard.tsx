"use client";

import { useState, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { compressImageClient } from "@/lib/compress-image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./TaskCard";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskForm, type TaskFormData } from "./TaskForm";
import { TaskFilters } from "./TaskFilters";
import type { Task, TaskPhoto } from "@/generated/prisma/client";

export type TaskWithPhotos = Task & { photos: TaskPhoto[] };
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

const columns: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "DONE", label: "Done" },
];

function Column({
  id,
  label,
  tasks,
  onOpen,
  onDelete,
  onMove,
  onReorder,
  onAdd,
}: {
  id: string;
  label: string;
  tasks: TaskWithPhotos[];
  onOpen: (task: TaskWithPhotos) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[200px] flex-1 flex-col rounded-lg border border-border bg-background/50 p-3 transition-colors ${isOver ? "border-border bg-card/50" : ""}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground/60">{tasks.length}</span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onDelete={onDelete}
              onMove={onMove}
              onReorder={onReorder}
              canMoveUp={index > 0}
              canMoveDown={index < tasks.length - 1}
            />
          ))}
          <button
            onClick={onAdd}
            className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground/60 transition-colors hover:border-foreground/30 hover:bg-accent/10 hover:text-muted-foreground ${tasks.length === 0 ? "flex-1 py-8" : "py-3 md:py-2"}`}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add task
          </button>
        </div>
      </SortableContext>
    </div>
  );
}

export function TaskBoard() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskWithPhotos | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const { data: tasks = [] } = useQuery<TaskWithPhotos[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      const json = (await res.json()) as { data: TaskWithPhotos[] };
      return json.data;
    },
    refetchInterval: 3_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { pendingPhotos, ...taskData } = data;
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      const task = ((await res.json()) as { data: TaskWithPhotos }).data;

      // Upload pending photos if any
      if (pendingPhotos && pendingPhotos.length > 0) {
        for (const rawFile of pendingPhotos) {
          const file = await compressImageClient(rawFile);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", `Task: ${task.title}`);
          formData.append("tags", JSON.stringify(["task"]));
          const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
          if (!mediaRes.ok) continue;
          const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };
          const isPdf = file.type === "application/pdf";
          await fetch("/api/tasks/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: task.id,
              url: `/api/media/share/${media.data.shareSlug}${isPdf ? "#pdf" : ""}`,
              mediaId: media.data.id,
              order: 0,
            }),
          });
        }
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TaskFormData }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: TaskWithPhotos }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated");
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDetailOpen(false);
      setDetailTask(null);
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  const reorderMutation = useMutation({
    mutationFn: async (
      reorderData: { id: string; status: string; order: number }[]
    ) => {
      await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: reorderData }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const filteredTasks = useMemo(
    () =>
      categoryFilter
        ? tasks.filter((t) => t.category === categoryFilter)
        : tasks,
    [tasks, categoryFilter]
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskWithPhotos[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const task of filteredTasks) {
      if (task.status in grouped) {
        grouped[task.status as TaskStatus]?.push(task);
      }
    }
    // Sort each column by order so arrow buttons and drag work correctly
    for (const key of Object.keys(grouped) as TaskStatus[]) {
      grouped[key].sort((a, b) => a.order - b.order);
    }
    return grouped;
  }, [filteredTasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const dragOriginStatus = useRef<string | null>(null);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  function handleDragStart(event: DragStartEvent) {
    void queryClient.cancelQueries({ queryKey: ["tasks"] });
    const task = tasks.find((t) => t.id === event.active.id);
    dragOriginStatus.current = task?.status ?? null;
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const isOverColumn = columns.some((c) => c.id === overId);

    if (isOverColumn && activeTask.status !== overId) {
      queryClient.setQueryData<TaskWithPhotos[]>(["tasks"], (old) =>
        old?.map((t) =>
          t.id === active.id ? { ...t, status: overId as TaskStatus } : t
        )
      );
    } else if (!isOverColumn) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && activeTask.status !== overTask.status) {
        queryClient.setQueryData<TaskWithPhotos[]>(["tasks"], (old) =>
          old?.map((t) =>
            t.id === active.id ? { ...t, status: overTask.status } : t
          )
        );
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const originStatus = dragOriginStatus.current;
    dragOriginStatus.current = null;
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    void queryClient.cancelQueries({ queryKey: ["tasks"] });

    const currentTasks =
      queryClient.getQueryData<TaskWithPhotos[]>(["tasks"]) ?? tasks;

    const activeTask = currentTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Determine target column
    const overColumn = columns.find((c) => c.id === over.id);
    const overTask = currentTasks.find((t) => t.id === over.id);
    const targetStatus = overColumn
      ? overColumn.id
      : overTask
        ? (overTask.status as TaskStatus)
        : (activeTask.status as TaskStatus);

    const crossColumn = originStatus != null && originStatus !== targetStatus;
    const reorderData: { id: string; status: string; order: number }[] = [];

    if (!crossColumn) {
      // Same column reorder — use arrayMove so both up and down work
      const sorted = currentTasks
        .filter((t) => t.status === targetStatus)
        .sort((a, b) => a.order - b.order);

      const oldIndex = sorted.findIndex((t) => t.id === active.id);
      const newIndex = overTask
        ? sorted.findIndex((t) => t.id === over.id)
        : sorted.length - 1;

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = arrayMove(sorted, oldIndex, newIndex);
      reordered.forEach((t, i) => {
        reorderData.push({ id: t.id, status: targetStatus, order: i });
      });
    } else {
      // Cross-column move
      // Re-number source column (active already removed by handleDragOver)
      const sourceTasks = currentTasks
        .filter((t) => t.status === originStatus && t.id !== active.id)
        .sort((a, b) => a.order - b.order);
      sourceTasks.forEach((t, i) => {
        reorderData.push({ id: t.id, status: originStatus, order: i });
      });

      // Insert into target column at correct position
      const targetTasks = currentTasks
        .filter((t) => t.status === targetStatus && t.id !== active.id)
        .sort((a, b) => a.order - b.order);

      const insertIdx = overTask && overTask.id !== active.id
        ? targetTasks.findIndex((t) => t.id === over.id)
        : targetTasks.length;

      targetTasks.splice(
        insertIdx >= 0 ? insertIdx : targetTasks.length,
        0,
        { ...activeTask, status: targetStatus as TaskWithPhotos["status"] }
      );

      targetTasks.forEach((t, i) => {
        reorderData.push({ id: t.id, status: targetStatus, order: i });
      });
    }

    if (reorderData.length === 0) return;

    // Optimistic update
    queryClient.setQueryData<TaskWithPhotos[]>(["tasks"], (old) =>
      old?.map((t) => {
        const update = reorderData.find((u) => u.id === t.id);
        if (update) {
          return { ...t, status: update.status as TaskWithPhotos["status"], order: update.order };
        }
        return t;
      })
    );

    reorderMutation.mutate(reorderData);
  }

  function handleSubmit(data: TaskFormData) {
    createMutation.mutate(data);
    setDefaultStatus(undefined);
  }

  function handleOpenDetail(task: TaskWithPhotos) {
    setDetailTask(task);
    setDetailOpen(true);
  }

  function handleDetailUpdate(id: string, data: TaskFormData) {
    updateMutation.mutate({ id, data });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  function handleMove(id: string, status: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    updateMutation.mutate({
      id,
      data: {
        title: task.title,
        description: task.description ?? undefined,
        priority: task.priority,
        category: task.category ?? undefined,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
        status,
      },
    });
  }

  function handleReorder(taskId: string, direction: "up" | "down") {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const sorted = [...(tasksByStatus[task.status as TaskStatus] ?? [])];
    const currentIndex = sorted.findIndex((t) => t.id === taskId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Remove task from current position and insert at target
    const [moved] = sorted.splice(currentIndex, 1);
    if (!moved) return;
    sorted.splice(targetIndex, 0, moved);

    // Assign sequential order values
    const updates = sorted.map((t, i) => ({
      id: t.id,
      status: t.status,
      order: i,
    }));

    // Cancel in-flight refetches so they don't overwrite optimistic update
    void queryClient.cancelQueries({ queryKey: ["tasks"] });

    queryClient.setQueryData<TaskWithPhotos[]>(["tasks"], (old) =>
      old?.map((t) => {
        const update = updates.find((u) => u.id === t.id);
        return update ? { ...t, order: update.order } : t;
      })
    );

    reorderMutation.mutate(updates);
  }

  function handleAddToColumn(status: string) {
    setDefaultStatus(status);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TaskFilters
          activeCategory={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        <Button
          onClick={() => {
            setDefaultStatus(undefined);
            setFormOpen(true);
          }}
          className="h-11 w-full gap-1.5 text-base sm:w-auto md:h-9 md:text-sm"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          New Task
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              label={col.label}
              tasks={tasksByStatus[col.id] ?? []}
              onOpen={handleOpenDetail}
              onDelete={handleDelete}
              onMove={handleMove}
              onReorder={handleReorder}
              onAdd={() => handleAddToColumn(col.id)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <div className="rotate-[2deg] scale-105 shadow-xl">
              <TaskCard
                task={activeTask}
                onOpen={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        defaultStatus={defaultStatus}
      />

      <TaskDetailModal
        task={detailTask ? (tasks.find((t) => t.id === detailTask.id) ?? detailTask) : null}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTask(null);
        }}
        onUpdate={handleDetailUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
