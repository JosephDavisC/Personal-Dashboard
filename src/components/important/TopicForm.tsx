"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMPORTANT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { IconPicker } from "./IconPicker";
import type { TopicWithCount } from "./TopicCard";

const PRESET_COLORS = [
  "#60A5FA", // blue
  "#F472B6", // pink
  "#34D399", // green
  "#FBBF24", // amber
  "#A78BFA", // violet
  "#FB923C", // orange
  "#F87171", // red
  "#2DD4BF", // teal
];

export interface TopicFormData {
  title: string;
  icon: string | null;
  color: string | null;
  category: string | null;
}

interface TopicFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TopicFormData) => void;
  topic?: TopicWithCount | null;
}

export function TopicForm({ open, onOpenChange, onSubmit, topic }: TopicFormProps) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(topic?.title ?? "");
      setIcon(topic?.icon ?? "");
      setColor(topic?.color ?? null);
      setCategory(topic?.category ?? null);
    }
  }, [open, topic]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      icon: icon.trim() || null,
      color,
      category,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{topic ? "Edit Topic" : "New Topic"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic-title">Title</Label>
            <Input
              id="topic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Internship Search"
              className="text-base sm:text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={category ?? "none"}
              onValueChange={(v) => setCategory(v === "none" ? null : v)}
            >
              <SelectTrigger className="text-base sm:text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {IMPORTANT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? null : c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {topic ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
