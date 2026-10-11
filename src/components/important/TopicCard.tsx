"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Link2,
  StickyNote,
  ImageIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { IMPORTANT_CATEGORY_COLORS } from "@/lib/constants";
import { isImageIcon } from "./IconPicker";

export interface TopicWithCount {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  category: string | null;
  pinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count: { items: number };
  items?: TopicItem[];
}

export interface TopicItem {
  id: string;
  topicId: string;
  type: string;
  label: string | null;
  url: string | null;
  content: string | null;
  mediaId: string | null;
  pinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  media?: {
    id: string;
    shareSlug: string;
    filename: string;
    mimeType: string;
    size: number;
    thumbnail: string | null;
    title: string | null;
  } | null;
}

interface TopicCardProps {
  topic: TopicWithCount;
  onOpen: (topic: TopicWithCount) => void;
  onEdit: (topic: TopicWithCount) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

function getItemCounts(topic: TopicWithCount) {
  if (!topic.items) {
    return { links: 0, notes: 0, images: 0, files: 0 };
  }
  const counts = { links: 0, notes: 0, images: 0, files: 0 };
  for (const item of topic.items) {
    if (item.type === "link") counts.links++;
    else if (item.type === "note") counts.notes++;
    else if (item.type === "image") counts.images++;
    else if (item.type === "file") counts.files++;
  }
  return counts;
}

export function TopicCard({ topic, onOpen, onEdit, onDelete, onTogglePin }: TopicCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
  };

  const categoryColor = topic.category
    ? IMPORTANT_CATEGORY_COLORS[topic.category]
    : null;

  const counts = getItemCounts(topic);
  const totalItems = topic._count.items;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative cursor-grab touch-none border-border bg-card/80 transition-all duration-200 hover:shadow-md hover:border-primary/30 active:cursor-grabbing overflow-hidden",
        isDragging && "opacity-40 scale-[0.98] shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Color accent bar at top */}
      {(topic.color || categoryColor) && (
        <div
          className="h-1 w-full"
          style={{ backgroundColor: topic.color || categoryColor || undefined }}
        />
      )}

      <div
        className="flex flex-col items-center px-3 pt-4 pb-3 cursor-pointer"
        onClick={() => onOpen(topic)}
      >
        {/* Icon */}
        {isImageIcon(topic.icon) ? (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl mb-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={topic.icon!}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl mb-2.5"
            style={{
              backgroundColor: topic.color
                ? `${topic.color}15`
                : categoryColor
                ? `${categoryColor}15`
                : "hsl(var(--muted))",
            }}
          >
            {topic.icon || "📌"}
          </div>
        )}

        {/* Title */}
        <p className="text-center text-sm font-semibold text-foreground leading-tight line-clamp-2 w-full">
          {topic.title}
        </p>

        {/* Category badge */}
        {topic.category && (
          <span
            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
            style={{
              backgroundColor: categoryColor ? `${categoryColor}15` : "hsl(var(--muted))",
              color: categoryColor || "hsl(var(--muted-foreground))",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: categoryColor || "hsl(var(--muted-foreground))" }}
            />
            {topic.category}
          </span>
        )}

        {/* Item counts */}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          {totalItems === 0 ? (
            <span className="text-muted-foreground/40">Empty</span>
          ) : (
            <>
              {counts.links > 0 && (
                <span className="flex items-center gap-0.5">
                  <Link2 className="h-3 w-3" />
                  {counts.links}
                </span>
              )}
              {counts.notes > 0 && (
                <span className="flex items-center gap-0.5">
                  <StickyNote className="h-3 w-3" />
                  {counts.notes}
                </span>
              )}
              {counts.images > 0 && (
                <span className="flex items-center gap-0.5">
                  <ImageIcon className="h-3 w-3" />
                  {counts.images}
                </span>
              )}
              {counts.files > 0 && (
                <span className="flex items-center gap-0.5">
                  <FileText className="h-3 w-3" />
                  {counts.files}
                </span>
              )}
              {/* Fallback if items not loaded */}
              {!topic.items && totalItems > 0 && (
                <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pin star */}
      {topic.pinned && (
        <Star className="absolute left-2 top-2 h-3 w-3 fill-yellow-400 text-yellow-400" />
      )}

      {/* 3-dot menu */}
      <div
        className="absolute right-1 top-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(topic)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTogglePin(topic.id, !topic.pinned)}>
              {topic.pinned ? (
                <><PinOff className="mr-2 h-4 w-4" />Unpin</>
              ) : (
                <><Pin className="mr-2 h-4 w-4" />Pin</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400"
                  onSelect={(e) => e.preventDefault()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete topic?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{topic.title}&quot; and all its items.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(topic.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
