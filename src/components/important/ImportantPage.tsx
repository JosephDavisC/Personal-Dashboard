"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Star, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopicCard, type TopicWithCount } from "./TopicCard";
import { TopicForm, type TopicFormData } from "./TopicForm";
import { TopicDetailModal } from "./TopicDetailModal";
import { QuickAddBar, type QuickAddBarRef } from "./QuickAddBar";
import { ImportantFilters } from "./ImportantFilters";

export function ImportantPage() {
  const queryClient = useQueryClient();

  // State
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicWithCount | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Refs
  const quickAddRef = useRef<QuickAddBarRef>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Fetch topics with items for count summary
  const { data: topics = [] } = useQuery<TopicWithCount[]>({
    queryKey: ["important-topics"],
    queryFn: async () => {
      const res = await fetch("/api/important?include=items");
      const json = (await res.json()) as { data: TopicWithCount[] };
      return json.data;
    },
  });

  // Create topic
  const createMutation = useMutation({
    mutationFn: async (data: TopicFormData) => {
      const res = await fetch("/api/important", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: TopicWithCount }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
      toast.success("Topic created");
    },
    onError: () => toast.error("Failed to create topic"),
  });

  // Update topic
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TopicFormData & { pinned: boolean }> }) => {
      const res = await fetch(`/api/important/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: TopicWithCount }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
    },
    onError: () => toast.error("Failed to update topic"),
  });

  // Delete topic
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/important/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
      toast.success("Topic deleted");
    },
    onError: () => toast.error("Failed to delete topic"),
  });

  // Reorder topics
  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await fetch("/api/important/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
      toast.error("Failed to reorder");
    },
  });

  // Filter topics
  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return topics.filter((t) => {
      if (category && t.category !== category) return false;
      if (pinnedOnly && !t.pinned) return false;
      if (searchLower) {
        const titleMatch = t.title.toLowerCase().includes(searchLower);
        const itemMatch = t.items?.some(
          (i) =>
            i.label?.toLowerCase().includes(searchLower) ||
            i.url?.toLowerCase().includes(searchLower) ||
            i.content?.toLowerCase().includes(searchLower)
        );
        if (!titleMatch && !itemMatch) return false;
      }
      return true;
    });
  }, [topics, search, category, pinnedOnly]);

  // DnD handlers
  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((t) => t.id === active.id);
    const newIndex = filtered.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder
    const reordered = [...filtered];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    const ids = reordered.map((t) => t.id);
    queryClient.setQueryData<TopicWithCount[]>(["important-topics"], (old) => {
      if (!old) return old;
      return ids.map((id, i) => {
        const t = old.find((x) => x.id === id);
        return t ? { ...t, order: i } : t!;
      }).concat(old.filter((t) => !ids.includes(t.id)));
    });

    reorderMutation.mutate(ids);
  }

  // Quick add handler
  const handleQuickAdd = useCallback(
    (title: string) => {
      createMutation.mutate({ title, icon: null, color: null, category: null });
    },
    [createMutation]
  );

  // Form handlers
  function handleFormSubmit(data: TopicFormData) {
    if (editingTopic) {
      updateMutation.mutate({ id: editingTopic.id, data });
      toast.success("Topic updated");
    } else {
      createMutation.mutate(data);
    }
    setEditingTopic(null);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (formOpen || selectedTopicId) return;

      switch (e.key) {
        case "n":
          e.preventDefault();
          quickAddRef.current?.focus();
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formOpen, selectedTopicId]);

  const draggedTopic = activeDragId ? topics.find((t) => t.id === activeDragId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Star className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Important
          </h2>
          <span className="text-sm text-muted-foreground">{topics.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditingTopic(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Topic</span>
          </Button>
        </div>
      </div>

      {/* Quick Add */}
      <QuickAddBar
        ref={quickAddRef}
        onAdd={handleQuickAdd}
        isAdding={createMutation.isPending}
      />

      {/* Filters */}
      <ImportantFilters
        category={category}
        onCategoryChange={setCategory}
        pinnedOnly={pinnedOnly}
        onPinnedOnlyChange={setPinnedOnly}
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="py-12 text-center">
            <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {topics.length === 0
                ? "No topics yet. Create one to start organizing."
                : "No topics match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveDragId(e.active.id as string)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext items={filtered.map((t) => t.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onOpen={() => setSelectedTopicId(topic.id)}
                  onEdit={(t) => {
                    setEditingTopic(t);
                    setFormOpen(true);
                  }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onTogglePin={(id, pinned) => updateMutation.mutate({ id, data: { pinned } })}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {draggedTopic && (
              <TopicCard
                topic={draggedTopic}
                onOpen={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onTogglePin={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Topic Form Dialog */}
      <TopicForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        topic={editingTopic}
      />

      {/* Topic Detail Modal */}
      {selectedTopicId && (
        <TopicDetailModal
          topicId={selectedTopicId}
          open={!!selectedTopicId}
          onOpenChange={(open) => {
            if (!open) setSelectedTopicId(null);
          }}
        />
      )}
    </div>
  );
}
