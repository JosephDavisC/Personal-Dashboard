"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calendar as CalendarIcon,
  Tag,
  Flag,
  Columns3,
  ChevronDown,
  X,
  AlignLeft,
  Link2,
  ExternalLink,
  Plus,
  ImagePlus,
  Trash2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => void;
  defaultStatus?: string;
}

export interface TaskLink {
  label: string;
  url: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  priority: string;
  category?: string;
  dueDate?: string;
  status?: string;
  links?: TaskLink[];
  pendingPhotos?: File[];
}

export function TaskForm({ open, onOpenChange, onSubmit, defaultStatus }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("TODO");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setCategory("");
    setDueDate("");
    setStatus(defaultStatus ?? "TODO");
    setLinks([]);
    setAddingLink(false);
    setLinkUrl("");
    setLinkLabel("");
    setPhotos([]);
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, defaultStatus]);

  function handleAddLink() {
    const url = linkUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { return; }
    setLinks((prev) => [...prev, { label: linkLabel.trim() || url, url }]);
    setLinkUrl("");
    setLinkLabel("");
    setAddingLink(false);
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: category || undefined,
      dueDate: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : undefined,
      status,
      links: links.length > 0 ? links : undefined,
      pendingPhotos: photos.length > 0 ? photos : undefined,
    });
    onOpenChange(false);
  }

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? priority;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? "None";

  const dueDateObj = dueDate ? new Date(dueDate + "T12:00:00") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl"
        showCloseButton={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>New Task</DialogTitle>
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
        <div className="flex flex-col gap-5 px-4 pb-5 md:flex-row md:gap-8 md:px-6 md:pb-6">
          {/* Left: content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 px-1">
              <Badge variant="secondary" className="text-xs">
                {statusLabel}
              </Badge>
            </div>

            {/* Title */}
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
              }}
              placeholder="Task title..."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary md:text-xl"
            />

            {/* Description */}
            <div className="px-3">
              <div className="mb-2 flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Description</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add a more detailed description..."
                className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
              />
            </div>

            {/* Links */}
            <div className="px-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Links</span>
                </div>
                {!addingLink && links.length > 0 && (
                  <button
                    onClick={() => { setAddingLink(true); setTimeout(() => linkUrlRef.current?.focus(), 0); }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:rounded-md md:border-0 md:px-2 md:py-1 md:text-xs"
                  >
                    <Plus className="h-4 w-4 md:h-3 md:w-3" />
                    Add
                  </button>
                )}
              </div>

              {links.length > 0 && (
                <div className="space-y-1.5">
                  {links.map((link, i) => (
                    <div key={i} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/50 md:py-1.5">
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
                      <span className="min-w-0 flex-1 truncate text-sm text-primary">
                        {link.label || link.url}
                      </span>
                      <button
                        onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 p-1 text-muted-foreground hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
                      </button>
                    </div>
                  ))}
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
                      if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
                      if (e.key === "Escape") { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); }
                    }}
                  />
                  <input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm md:py-1.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
                      if (e.key === "Escape") { setAddingLink(false); setLinkUrl(""); setLinkLabel(""); }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button className="h-10 md:h-9" onClick={handleAddLink} disabled={!linkUrl.trim()}>Add Link</Button>
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

              {!addingLink && links.length === 0 && (
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
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:rounded-md md:border-0 md:px-2 md:py-1 md:text-xs"
                  >
                    <Plus className="h-4 w-4 md:h-3 md:w-3" />
                    Add
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
                    e.target.value = "";
                  }
                }}
              />
              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((file, i) => (
                    <div key={i} className="relative group">
                      {file.type === "application/pdf" ? (
                        <div className="flex flex-col items-center justify-center gap-1 w-full aspect-square rounded-lg bg-muted">
                          <FileText className="h-8 w-8 text-red-400" />
                          <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{file.name}</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full aspect-square rounded-lg object-cover bg-muted"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                >
                  <ImagePlus className="h-4 w-4" />
                  Add photos to this task...
                </button>
              )}
            </div>

            <Separator className="mx-3" />

            {/* Create button */}
            <div className="flex items-center gap-3 px-3">
              <Button className="h-11 md:h-9" onClick={handleSubmit} disabled={!title.trim()}>
                Create Task
              </Button>
              <span className="hidden text-xs text-muted-foreground/50 sm:inline">
                Cmd+Enter
              </span>
            </div>
          </div>

          {/* Right: sidebar */}
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
                    onClick={() => { setStatus(s.value); setStatusOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      status === s.value
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
                    onClick={() => { setPriority(p.value); setPriorityOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      priority === p.value
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
                    onClick={() => { setCategory(c.value); setCategoryOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      category === c.value
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
                    {dueDateObj ? format(dueDateObj, "MMM d, yyyy") : "Set date"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDateObj ?? undefined}
                  onSelect={(date) => {
                    if (date) {
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, "0");
                      const d = String(date.getDate()).padStart(2, "0");
                      setDueDate(`${y}-${m}-${d}`);
                    } else {
                      setDueDate("");
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dueDate && (
              <button
                onClick={() => setDueDate("")}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground md:px-1 md:py-0.5 md:text-xs"
              >
                <X className="h-3 w-3" />
                Clear date
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
