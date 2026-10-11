"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { compressImageClient } from "@/lib/compress-image";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar as CalendarIcon,
  Tag,
  Flag,
  Columns3,
  Trash2,
  X,
  AlignLeft,
  ChevronDown,
  Link2,
  ExternalLink,
  Pencil,
  Plus,
  ImagePlus,
  Loader2,
  Copy,
} from "lucide-react";
import { PdfPreviewCard } from "@/components/ui/pdf-preview-card";
import { cn } from "@/lib/utils";
import { priorityColors, taskCategoryColors } from "@/lib/badge-colors";
import { format, isPast, isToday } from "date-fns";
import type { TaskWithPhotos } from "./TaskBoard";
import type { TaskPhoto } from "@/generated/prisma/client";
import type { TaskFormData, TaskLink } from "./TaskForm";
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

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "None" },
  { value: "school", label: "School" },
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
];

interface TaskDetailModalProps {
  task: TaskWithPhotos | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, data: TaskFormData) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: TaskDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkLabel, setEditLinkLabel] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const editLinkUrlRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (task) {
      setTitleValue(task.title);
      setDescValue(task.description ?? "");
    }
    setEditingTitle(false);
    setEditingDesc(false);
    setAddingLink(false);
    setEditingLinkIndex(null);
    setLinkUrl("");
    setLinkLabel("");
    setLightboxIndex(null);
    setEditingCaptionId(null);
  }, [task, open]);

  // Photo mutations
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!task) throw new Error("No task");
      const uploaded: TaskPhoto[] = [];
      for (let file of files) {
        file = await compressImageClient(file);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", `Task: ${task.title}`);
        formData.append("tags", JSON.stringify(["task"]));

        const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
        if (!mediaRes.ok) { toast.error(`Failed to upload ${file.name}`); continue; }
        const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };

        const isPdf = file.type === "application/pdf";
        const photoRes = await fetch("/api/tasks/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: task.id,
            url: `/api/media/share/${media.data.shareSlug}${isPdf ? "#pdf" : ""}`,
            mediaId: media.data.id,
            order: (task.photos?.length ?? 0) + uploaded.length,
          }),
        });
        if (photoRes.ok) {
          const photo = ((await photoRes.json()) as { data: TaskPhoto }).data;
          uploaded.push(photo);
        }
      }
      return uploaded;
    },
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (uploaded.length > 0) {
        toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    },
    onError: () => toast.error("Failed to upload photos"),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/tasks/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete photo");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Failed to delete photo"),
  });

  const captionMutation = useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: string; caption: string }) => {
      const res = await fetch(`/api/tasks/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption || null }),
      });
      if (!res.ok) throw new Error("Failed to update caption");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Failed to update caption"),
  });

  const startEditCaption = (photo: TaskPhoto) => {
    setEditingCaptionId(photo.id);
    setCaptionValue(photo.caption ?? "");
  };

  const saveCaption = (photoId: string) => {
    setEditingCaptionId(null);
    captionMutation.mutate({ photoId, caption: captionValue });
  };

  if (!task) return null;

  const taskLinks: TaskLink[] = Array.isArray(task.links) ? (task.links as unknown as TaskLink[]) : [];

  function buildFormData(overrides: Partial<TaskFormData> = {}): TaskFormData {
    if (!task) return { title: "", priority: "MEDIUM" };
    return {
      title: overrides.title ?? task.title,
      description: overrides.description !== undefined ? overrides.description : (task.description ?? undefined),
      priority: overrides.priority ?? task.priority,
      category: overrides.category !== undefined ? overrides.category : (task.category ?? undefined),
      dueDate: overrides.dueDate !== undefined
        ? overrides.dueDate
        : task.dueDate
          ? new Date(task.dueDate).toISOString()
          : undefined,
      status: overrides.status ?? task.status,
      links: overrides.links !== undefined ? overrides.links : (taskLinks.length > 0 ? taskLinks : undefined),
    };
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { return; }
    const label = linkLabel.trim() || url;
    const newLinks = [...taskLinks, { label, url }];
    saveField({ links: newLinks });
    setLinkUrl("");
    setLinkLabel("");
    setAddingLink(false);
  }

  function removeLink(index: number) {
    const newLinks = taskLinks.filter((_, i) => i !== index);
    saveField({ links: newLinks.length > 0 ? newLinks : undefined });
  }

  function startEditLink(index: number) {
    const link = taskLinks[index];
    if (!link) return;
    setEditingLinkIndex(index);
    setEditLinkUrl(link.url);
    setEditLinkLabel(link.label);
    setTimeout(() => editLinkUrlRef.current?.focus(), 0);
  }

  function saveEditLink() {
    if (editingLinkIndex === null) return;
    const url = editLinkUrl.trim();
    if (!url) { cancelEditLink(); return; }
    try { new URL(url); } catch { return; }
    const label = editLinkLabel.trim() || url;
    const newLinks = [...taskLinks];
    newLinks[editingLinkIndex] = { label, url };
    saveField({ links: newLinks });
    cancelEditLink();
  }

  function cancelEditLink() {
    setEditingLinkIndex(null);
    setEditLinkUrl("");
    setEditLinkLabel("");
  }

  function saveField(overrides: Partial<TaskFormData>) {
    if (!task) return;
    onUpdate(task.id, buildFormData(overrides));
  }

  function startEditTitle() {
    setTitleValue(task?.title ?? "");
    setEditingTitle(true);
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  function saveTitle() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === task?.title) {
      setEditingTitle(false);
      setTitleValue(task?.title ?? "");
      return;
    }
    saveField({ title: trimmed });
    setEditingTitle(false);
  }

  function startEditDesc() {
    setDescValue(task?.description ?? "");
    setEditingDesc(true);
    setTimeout(() => descRef.current?.focus(), 0);
  }

  function saveDesc() {
    const trimmed = descValue.trim();
    if (trimmed === (task?.description ?? "")) {
      setEditingDesc(false);
      return;
    }
    saveField({ description: trimmed || undefined });
    setEditingDesc(false);
  }

  const dueDateLocal = task.dueDate
    ? (() => {
        const d = new Date(task.dueDate);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      })()
    : null;
  const isOverdue = dueDateLocal && isPast(dueDateLocal) && task.status !== "DONE";
  const isDueToday = dueDateLocal && isToday(dueDateLocal);

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === task.status)?.label ?? task.status;
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === task.priority)?.label ?? task.priority;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === (task.category ?? ""))?.label ?? "None";

  async function copyTaskToClipboard() {
    if (!task) return;
    const baseUrl = window.location.origin;
    let md = `## ${task.title}\n\n`;
    const meta: string[] = [];
    if (task.status) meta.push(`**Status**: ${statusLabel}`);
    if (task.priority) meta.push(`**Priority**: ${priorityLabel}`);
    if (task.category) meta.push(`**Category**: ${task.category}`);
    if (dueDateLocal) meta.push(`**Due**: ${format(dueDateLocal, "MMM d, yyyy")}`);
    if (meta.length) md += meta.join(" | ") + "\n\n";
    if (task.description) md += task.description + "\n\n";
    if (taskLinks.length) {
      md += "### Links\n";
      taskLinks.forEach((l) => { md += `- [${l.label || l.url}](${l.url})\n`; });
      md += "\n";
    }
    const pdfs = task.photos?.filter((p) => p.url.includes("#pdf")) ?? [];
    if (pdfs.length) {
      md += "### Files\n";
      pdfs.forEach((p) => { md += `- [${p.caption || "PDF"}](${baseUrl}${p.url.replace("#pdf", "")})\n`; });
      md += "\n";
    }

    const photos = task.photos?.filter((p) => !p.url.includes("#pdf")) ?? [];
    if (photos.length) {
      md += "### Photos\n";
      photos.forEach((p) => { md += `- ${p.caption || "Photo"}: ${baseUrl}${p.url}\n`; });
      md += `\n_Use the copy button on each photo to attach images separately._\n`;
    }

    await navigator.clipboard.writeText(md.trim());
    toast.success("Task text copied — use photo buttons to copy images");
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && lightboxIndex !== null) return; // don't close dialog while lightbox is open
      onOpenChange(newOpen);
    }}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl"
        showCloseButton={false}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Task Details</DialogTitle>
        </VisuallyHidden.Root>

        {/* Close button */}
        <div className="flex items-center justify-end px-4 pt-3 md:px-6 md:pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-5 px-4 pb-8 md:flex-row md:gap-8 md:px-6 md:pb-6">
          {/* Left: content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Title */}
            {editingTitle ? (
              <input
                ref={titleRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                  if (e.key === "Escape") { setEditingTitle(false); setTitleValue(task.title); }
                }}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-primary md:text-xl"
              />
            ) : (
              <h2
                onClick={startEditTitle}
                className="cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xl font-semibold text-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50"
              >
                {task.title}
              </h2>
            )}

            {/* Status + metadata row */}
            <div className="flex flex-wrap items-center gap-2 px-3">
              <span className="text-xs text-muted-foreground">in</span>
              <Badge variant="secondary" className="text-xs">
                {statusLabel}
              </Badge>
              <Badge
                variant="secondary"
                className={cn("text-xs", priorityColors[task.priority])}
              >
                {task.priority}
              </Badge>
              {task.category && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    taskCategoryColors[task.category] ?? "bg-accent text-foreground/80"
                  )}
                >
                  {task.category}
                </Badge>
              )}
              {dueDateLocal && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs",
                    isOverdue
                      ? "text-red-400"
                      : isDueToday
                        ? "text-orange-400"
                        : "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {format(dueDateLocal, "MMM d, yyyy")}
                </span>
              )}
            </div>

            {/* Description */}
            <div className="px-3">
              <div className="mb-2 flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Description</span>
              </div>
              {editingDesc ? (
                <div>
                  <textarea
                    ref={descRef}
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    onBlur={saveDesc}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveDesc(); }
                      if (e.key === "Escape") { setEditingDesc(false); setDescValue(task.description ?? ""); }
                    }}
                    rows={4}
                    className="w-full resize-y break-words rounded-md border border-border bg-card px-3 py-2 text-base text-foreground outline-none focus:border-primary sm:text-sm"
                    placeholder="Add a more detailed description..."
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button className="h-10 md:h-9" onClick={saveDesc}>Save</Button>
                    <Button
                      className="h-10 md:h-9"
                      variant="ghost"
                      onClick={() => { setEditingDesc(false); setDescValue(task.description ?? ""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditDesc}
                  className={cn(
                    "min-h-[56px] cursor-pointer whitespace-pre-wrap break-words rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50",
                    task.description
                      ? "border-transparent text-foreground hover:border-border"
                      : "border-dashed border-border text-muted-foreground hover:border-foreground/30"
                  )}
                >
                  {task.description ? renderBoldText(task.description) : "Add a more detailed description..."}
                </div>
              )}
            </div>

            {/* Links */}
            <div className="min-w-0 overflow-hidden px-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Links</span>
                </div>
                {!addingLink && taskLinks.length > 0 && (
                  <button
                    onClick={() => { setAddingLink(true); setTimeout(() => linkUrlRef.current?.focus(), 0); }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:rounded-md md:border-0 md:px-2 md:py-1 md:text-xs"
                  >
                    <Plus className="h-4 w-4 md:h-3 md:w-3" />
                    Add
                  </button>
                )}
              </div>

              {taskLinks.length > 0 && (
                <div className="space-y-1.5">
                  {taskLinks.map((link, i) =>
                    editingLinkIndex === i ? (
                      <div key={i} className="space-y-2 rounded-md border border-border bg-card p-3">
                        <input
                          ref={editLinkUrlRef}
                          value={editLinkUrl}
                          onChange={(e) => setEditLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm md:py-1.5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveEditLink(); }
                            if (e.key === "Escape") cancelEditLink();
                          }}
                        />
                        <input
                          value={editLinkLabel}
                          onChange={(e) => setEditLinkLabel(e.target.value)}
                          placeholder="Label (optional)"
                          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm md:py-1.5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveEditLink(); }
                            if (e.key === "Escape") cancelEditLink();
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <Button className="h-10 md:h-9" onClick={saveEditLink} disabled={!editLinkUrl.trim()}>Save</Button>
                          <Button className="h-10 md:h-9" variant="ghost" onClick={cancelEditLink}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/50 md:py-1.5">
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {link.label}
                        </a>
                        <button
                          onClick={() => startEditLink(i)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                          title="Edit link"
                        >
                          <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </button>
                        <button
                          onClick={() => removeLink(i)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {addingLink && (
                <div className="mt-2 space-y-2">
                  <input
                    ref={linkUrlRef}
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm md:py-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addLink(); }
                      if (e.key === "Escape") { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); }
                    }}
                  />
                  <input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm md:py-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addLink(); }
                      if (e.key === "Escape") { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button className="h-10 md:h-9" onClick={addLink} disabled={!linkUrl.trim()}>Add Link</Button>
                    <Button
                      className="h-10 md:h-9"
                      variant="ghost"
                      onClick={() => { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!addingLink && taskLinks.length === 0 && (
                <button
                  onClick={() => { setAddingLink(true); setTimeout(() => linkUrlRef.current?.focus(), 0); }}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                >
                  <Plus className="h-4 w-4" />
                  Add links to this task...
                </button>
              )}
            </div>

            {/* Photos */}
            <div className="px-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Photos</span>
                </div>
                <button
                  onClick={() => photoUploadRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:rounded-md md:border-0 md:px-2 md:py-1 md:text-xs"
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin md:h-3 md:w-3" />
                  ) : (
                    <Plus className="h-4 w-4 md:h-3 md:w-3" />
                  )}
                  Add
                </button>
                <input
                  ref={photoUploadRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      const files = Array.from(e.target.files);
                      e.target.value = "";
                      uploadMutation.mutate(files);
                    }
                  }}
                />
              </div>

              {task.photos && task.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {task.photos.map((photo) => {
                    const isPdf = photo.url.includes("#pdf");
                    const imageIndex = isPdf ? -1 : task.photos!.filter(p => !p.url.includes("#pdf")).findIndex(p => p.id === photo.id);
                    const slug = isPdf ? photo.url.match(/\/api\/media\/share\/([^/#?]+)/)?.[1] : null;
                    return (
                    <div key={photo.id}>
                      {isPdf ? (
                        <div className="overflow-hidden rounded-lg">
                          <PdfPreviewCard
                            url={photo.url}
                            title={photo.caption || "PDF"}
                            thumbnailUrl={slug ? `/api/media/share/${slug}/thumb` : null}
                            className="border-0 bg-muted p-2"
                          />
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setLightboxIndex(imageIndex)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLightboxIndex(imageIndex); } }}
                          className="flex items-center justify-center w-full overflow-hidden rounded-lg bg-muted hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={photo.caption || "Task photo"}
                            className="max-w-full max-h-56 object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => startEditCaption(photo)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted/50 text-xs text-muted-foreground hover:bg-muted active:bg-muted transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Caption
                        </button>
                        {!isPdf && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch(photo.url);
                                const blob = await res.blob();
                                const pngBlob = await (async () => {
                                  if (blob.type === "image/png") return blob;
                                  const img = new Image();
                                  img.crossOrigin = "anonymous";
                                  const url = URL.createObjectURL(blob);
                                  await new Promise<void>((r, rej) => { img.onload = () => r(); img.onerror = rej; img.src = url; });
                                  const canvas = document.createElement("canvas");
                                  canvas.width = img.naturalWidth;
                                  canvas.height = img.naturalHeight;
                                  canvas.getContext("2d")!.drawImage(img, 0, 0);
                                  URL.revokeObjectURL(url);
                                  return new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
                                })();
                                await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
                                toast.success("Image copied to clipboard");
                              } catch {
                                toast.error("Failed to copy image");
                              }
                            }}
                            className="flex items-center justify-center py-1.5 px-2.5 rounded-md bg-muted/50 text-xs text-muted-foreground hover:bg-muted active:bg-muted transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePhotoMutation.mutate(photo.id)}
                          className="flex items-center justify-center py-1.5 px-2.5 rounded-md bg-muted/50 text-xs text-red-400 hover:bg-red-500/10 active:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {editingCaptionId === photo.id ? (
                        <input
                          type="text"
                          value={captionValue}
                          onChange={(e) => setCaptionValue(e.target.value)}
                          onBlur={() => saveCaption(photo.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCaption(photo.id);
                            if (e.key === "Escape") setEditingCaptionId(null);
                          }}
                          placeholder="Add caption..."
                          autoFocus
                          className="w-full bg-card border border-border rounded-md px-2.5 py-1.5 mt-1.5 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30 focus:outline-none"
                        />
                      ) : photo.caption ? (
                        <p
                          className="text-xs text-muted-foreground truncate mt-1 cursor-pointer hover:text-foreground transition-colors"
                          onClick={() => startEditCaption(photo)}
                        >
                          {photo.caption}
                        </p>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoUploadRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                >
                  <ImagePlus className="h-4 w-4" />
                  Add photos to this task...
                </button>
              )}
            </div>

            {/* Timestamps */}
            <div className="space-y-0.5 px-3 pt-1">
              <Separator className="mb-2" />
              <p className="text-[11px] text-muted-foreground/60">
                Created {format(new Date(task.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                Updated {format(new Date(task.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {/* Right: sidebar with compact popover buttons */}
          <Separator className="md:hidden" />
          <div className="flex w-full flex-col gap-2 md:w-48">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </p>

            {/* Status popover */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
                    {statusLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => { saveField({ status: s.value }); setStatusOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      task.status === s.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Priority popover */}
            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                    {priorityLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => { saveField({ priority: p.value }); setPriorityOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      task.priority === p.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Category popover */}
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    {categoryLabel}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { saveField({ category: c.value || undefined }); setCategoryOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      (task.category ?? "") === c.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Due date popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {dueDateLocal ? format(dueDateLocal, "MMM d, yyyy") : "Set date"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDateLocal ?? undefined}
                  onSelect={(date) => {
                    if (date) {
                      const iso = new Date(
                        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)
                      ).toISOString();
                      saveField({ dueDate: iso });
                    } else {
                      saveField({ dueDate: undefined });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dueDateLocal && (
              <button
                onClick={() => saveField({ dueDate: undefined })}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:py-0.5 md:text-xs"
              >
                <X className="h-3.5 w-3.5 md:h-3 md:w-3" />
                Clear date
              </button>
            )}

            <Separator className="my-1" />

            {/* Copy */}
            <Button
              variant="ghost"
              className="h-10 w-full justify-start text-muted-foreground hover:text-foreground md:h-9"
              onClick={copyTaskToClipboard}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-full justify-start text-red-400 hover:bg-red-400/10 hover:text-red-400 md:h-9"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &ldquo;{task.title}&rdquo;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      onDelete(task.id);
                      onOpenChange(false);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Lightbox — portaled to body to escape Radix stacking context */}
    {lightboxIndex !== null && task.photos && task.photos.length > 0 && createPortal(
      <TaskPhotoLightbox
        photos={task.photos.filter(p => !p.url.includes("#pdf"))}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />,
      document.body,
    )}
    </>
  );
}

/** Portaled lightbox with its own keyboard handling */
function TaskPhotoLightbox({
  photos,
  currentIndex,
  onIndexChange,
  onClose,
}: {
  photos: TaskPhoto[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
      if (e.key === "ArrowLeft" && currentIndex > 0) onIndexChange(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) onIndexChange(currentIndex + 1);
    }
    // capture phase so it fires before Radix Dialog's Escape handler
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [currentIndex, photos.length, onIndexChange, onClose]);

  const photo = photos[currentIndex];
  if (!photo) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 pointer-events-auto cursor-pointer"
      onClick={onClose}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      tabIndex={-1}
      role="dialog"
      style={{ pointerEvents: "auto" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || "Task photo"}
        className="block h-auto w-auto max-h-[85vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />
      {/* Desktop: small icon button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 hidden rounded-full bg-black/50 p-2 text-white hover:bg-black/80 cursor-pointer pointer-events-auto sm:block"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Mobile: large tappable close bar at top */}
      <button
        type="button"
        className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center gap-2 bg-black/60 text-white active:bg-white/10 sm:hidden"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
        <span className="text-sm font-medium">Close</span>
      </button>
      {photo.caption && (
        <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/80">
          {photo.caption}
        </p>
      )}
    </div>
  );
}
