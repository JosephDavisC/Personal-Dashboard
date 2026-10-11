"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, ChevronDown, Cable } from "lucide-react";
import { RacketCard } from "./RacketCard";
import { RacketForm } from "./RacketForm";
import { StringForm } from "./StringForm";

interface StringPhoto {
  id: string;
  url: string;
  mediaId: string | null;
}

interface StringInventory {
  id: string;
  name: string;
  type: string;
  gauge: string | null;
  quantity: number;
  notes: string | null;
  photos?: StringPhoto[];
}

// ---------- Sortable wrapper for racket cards ----------

function SortableRacketCard({ racket }: { racket: Record<string, unknown> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: racket.id as string });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none",
        isDragging && "opacity-40 scale-[0.98] z-10"
      )}
      {...attributes}
      {...listeners}
    >
      <RacketCard racket={racket} />
    </div>
  );
}

function SortableStringCard({ s, onClick }: { s: StringInventory; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  const firstPhoto = s.photos?.[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none rounded-lg border bg-card overflow-hidden hover:border-primary/30 cursor-pointer transition-colors",
        isDragging && "opacity-40 scale-[0.98] z-10"
      )}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {firstPhoto ? (
        <div className="relative w-full aspect-[3/2] overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firstPhoto.url}
            alt={s.name}
            className="w-full h-full object-contain"
          />
          <div
            className={cn(
              "absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm",
              s.quantity >= 2 && "bg-green-500/20 text-green-700",
              s.quantity === 1 && "bg-yellow-500/20 text-yellow-700",
              s.quantity === 0 && "bg-red-500/20 text-red-700",
            )}
          >
            {s.quantity === 0 ? "Out" : `×${s.quantity}`}
          </div>
        </div>
      ) : (
        <div className="relative w-full aspect-[3/2] bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center">
          <Cable className="w-6 h-6 text-muted-foreground/40" />
          <div
            className={cn(
              "absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              s.quantity >= 2 && "bg-green-500/20 text-green-400",
              s.quantity === 1 && "bg-yellow-500/20 text-yellow-400",
              s.quantity === 0 && "bg-red-500/20 text-red-400",
            )}
          >
            {s.quantity === 0 ? "Out" : `×${s.quantity}`}
          </div>
        </div>
      )}

      <div className="p-2.5">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-medium truncate">{s.name}</p>
          <span className={cn(
            "text-[10px] font-semibold shrink-0",
            s.quantity >= 2 && "text-green-400",
            s.quantity === 1 && "text-yellow-400",
            s.quantity === 0 && "text-red-400",
          )}>
            {s.quantity === 0 ? "Out" : `${s.quantity} set${s.quantity !== 1 ? "s" : ""}`}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {[s.type, s.gauge].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export function EquipmentTab() {
  const queryClient = useQueryClient();
  const [racketFormOpen, setRacketFormOpen] = useState(false);
  const [stringFormOpen, setStringFormOpen] = useState(false);
  const [editingString, setEditingString] = useState<StringInventory | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const { data: rackets, isLoading: racketsLoading } = useQuery({
    queryKey: ["tennis-rackets"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/rackets");
      if (!res.ok) throw new Error("Failed to fetch rackets");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const racketReorderMutation = useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      const res = await fetch("/api/tennis/rackets/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
    },
  });

  const stringReorderMutation = useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      const res = await fetch("/api/tennis/strings/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-strings"] });
    },
  });

  function handleRacketDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !rackets) return;

    const oldIndex = rackets.findIndex((r: Record<string, unknown>) => r.id === active.id);
    const newIndex = rackets.findIndex((r: Record<string, unknown>) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...rackets] as Record<string, unknown>[];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    queryClient.setQueryData(["tennis-rackets"], reordered.map((r, i) => ({ ...r, order: i })));
    racketReorderMutation.mutate(reordered.map((r, i) => ({ id: r.id as string, order: i })));
  }

  function handleStringDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !strings) return;

    const oldIndex = strings.findIndex((s) => s.id === active.id);
    const newIndex = strings.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...strings];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    queryClient.setQueryData(["tennis-strings"], reordered.map((s, i) => ({ ...s, order: i })));
    stringReorderMutation.mutate(reordered.map((s, i) => ({ id: s.id, order: i })));
  }

  const { data: strings, isLoading: stringsLoading } = useQuery({
    queryKey: ["tennis-strings"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/strings");
      if (!res.ok) throw new Error("Failed to fetch strings");
      const json = await res.json();
      return (json.data ?? []) as StringInventory[];
    },
  });

  return (
    <div className="space-y-6">
      {/* Rackets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Rackets</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRacketFormOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Racket
          </Button>
        </div>

        {racketsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="aspect-[4/3] animate-pulse bg-card" />
            ))}
          </div>
        ) : rackets?.length ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRacketDragEnd}
          >
            <SortableContext
              items={rackets.map((r: Record<string, unknown>) => r.id as string)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {rackets.map((racket: Record<string, unknown>) => (
                  <SortableRacketCard key={racket.id as string} racket={racket} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No rackets yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setRacketFormOpen(true)}
            >
              Add your first racket
            </Button>
          </Card>
        )}
      </div>

      {/* String Inventory */}
      <div>
        <Collapsible defaultOpen>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 text-lg font-heading font-semibold py-2">
              <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:-rotate-90" />
              String Inventory (
              {strings?.length ?? 0}{" "}
              {(strings?.length ?? 0) === 1 ? "type" : "types"})
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setEditingString(null);
                setStringFormOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          <CollapsibleContent>
            {stringsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-28 animate-pulse bg-card" />
                ))}
              </div>
            ) : strings?.length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleStringDragEnd}
              >
                <SortableContext
                  items={strings.map((s) => s.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                    {strings.map((s) => (
                      <SortableStringCard
                        key={s.id}
                        s={s}
                        onClick={() => {
                          setEditingString(s);
                          setStringFormOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center py-6 space-y-2">
                <Cable className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No strings in inventory
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingString(null);
                    setStringFormOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add String
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <RacketForm open={racketFormOpen} onOpenChange={setRacketFormOpen} />
      <StringForm
        open={stringFormOpen}
        onOpenChange={(v) => {
          setStringFormOpen(v);
          if (!v) setEditingString(null);
        }}
        editingString={editingString}
      />

    </div>
  );
}
