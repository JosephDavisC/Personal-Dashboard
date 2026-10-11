"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Link2,
  ExternalLink,
  StickyNote,
  ImageIcon,
  FileText,
  Loader2,
  Pin,
  PinOff,
  Star,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import { PdfPreviewCard } from "@/components/ui/pdf-preview-card";
import { cn } from "@/lib/utils";
import {
  IMPORTANT_CATEGORIES,
  IMPORTANT_CATEGORY_COLORS,
} from "@/lib/constants";
import { format } from "date-fns";
import type { TopicItem, TopicWithCount } from "./TopicCard";
import { isImageIcon, IconPicker } from "./IconPicker";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface TopicDetailModalProps {
  topicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TopicDetail extends TopicWithCount {
  items: TopicItem[];
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export function TopicDetailModal({
  topicId,
  open,
  onOpenChange,
}: TopicDetailModalProps) {
  const queryClient = useQueryClient();

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Inline add states
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  // Inline edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Refs
  const titleRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const editNoteRef = useRef<HTMLTextAreaElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  // ── Fetch topic with items ──
  const { data: topic } = useQuery<TopicDetail>({
    queryKey: ["important-topic", topicId],
    queryFn: async () => {
      const res = await fetch(`/api/important/${topicId}`);
      if (!res.ok) throw new Error("Failed to load topic");
      const json = (await res.json()) as { data: TopicDetail };
      return json.data;
    },
    enabled: open && !!topicId,
  });

  // Reset state on open/topic change
  useEffect(() => {
    if (topic) {
      setTitleValue(topic.title);
    }
    setEditingTitle(false);
    setAddingLink(false);
    setLinkUrl("");
    setLinkLabel("");
    setAddingNote(false);
    setNoteContent("");
    setEditingNoteId(null);
    setLightboxIndex(null);
    setExpandedNotes(new Set());
  }, [topic?.id, open]);

  // ── Mutations ──

  const updateTopicMutation = useMutation({
    mutationFn: async (data: Partial<{ title: string; icon: string | null; color: string | null; category: string | null; pinned: boolean }>) => {
      const res = await fetch(`/api/important/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topic", topicId] });
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
    },
    onError: () => toast.error("Failed to update topic"),
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { type: string; label?: string; url?: string; content?: string; mediaId?: string }) => {
      const res = await fetch(`/api/important/${topicId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return ((await res.json()) as { data: TopicItem }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topic", topicId] });
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
    },
    onError: () => toast.error("Failed to add item"),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Partial<{ label: string; url: string; content: string; pinned: boolean }> }) => {
      const res = await fetch(`/api/important/${topicId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topic", topicId] });
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
    },
    onError: () => toast.error("Failed to update item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/important/${topicId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topic", topicId] });
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const reorderItemsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await fetch(`/api/important/${topicId}/items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    },
    onError: () => toast.error("Failed to reorder"),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/important/${topicId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
      toast.success("Topic deleted");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to delete topic"),
  });

  // Upload mutation for images/files
  const uploadMutation = useMutation({
    mutationFn: async ({ files, type }: { files: File[]; type: "image" | "file" }) => {
      const uploaded: TopicItem[] = [];
      for (let file of files) {
        if (type === "image") {
          file = await compressImageClient(file);
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", `Important: ${topic?.title}`);
        formData.append("tags", JSON.stringify(["important"]));

        const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
        if (!mediaRes.ok) { toast.error(`Failed to upload ${file.name}`); continue; }
        const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string; filename: string } };

        const isPdf = file.type === "application/pdf";
        const itemType = isPdf ? "file" : type;

        const itemRes = await fetch(`/api/important/${topicId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: itemType,
            label: file.name,
            url: `/api/media/share/${media.data.shareSlug}${isPdf ? "#pdf" : ""}`,
            mediaId: media.data.id,
          }),
        });
        if (itemRes.ok) {
          const item = ((await itemRes.json()) as { data: TopicItem }).data;
          uploaded.push(item);
        }
      }
      return uploaded;
    },
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ["important-topic", topicId] });
      queryClient.invalidateQueries({ queryKey: ["important-topics"] });
      if (uploaded.length > 0) {
        toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    },
    onError: () => toast.error("Failed to upload"),
  });

  // ── Handlers ──

  function saveTitle() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === topic?.title) {
      setEditingTitle(false);
      setTitleValue(topic?.title ?? "");
      return;
    }
    updateTopicMutation.mutate({ title: trimmed });
    setEditingTitle(false);
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    try { new URL(url); } catch { toast.error("Invalid URL"); return; }
    const label = linkLabel.trim() || url;
    addItemMutation.mutate({ type: "link", label, url });
    setLinkUrl("");
    setLinkLabel("");
    setAddingLink(false);
  }

  function addNote() {
    const content = noteContent.trim();
    if (!content) return;
    addItemMutation.mutate({ type: "note", content });
    setNoteContent("");
    setAddingNote(false);
  }

  function saveNoteEdit(itemId: string) {
    const content = editNoteContent.trim();
    if (!content) { setEditingNoteId(null); return; }
    updateItemMutation.mutate({ itemId, data: { content } });
    setEditingNoteId(null);
  }

  function moveItem(items: TopicItem[], itemId: string, direction: "up" | "down") {
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved!);
    reorderItemsMutation.mutate(reordered.map((i) => i.id));
    // Optimistic update
    queryClient.setQueryData<TopicDetail>(["important-topic", topicId], (old) => {
      if (!old) return old;
      return { ...old, items: reordered };
    });
  }

  // ── Derived data ──

  if (!topic) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl">
          <VisuallyHidden.Root><DialogTitle>Loading</DialogTitle></VisuallyHidden.Root>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const links = topic.items.filter((i) => i.type === "link");
  const notes = topic.items.filter((i) => i.type === "note");
  const images = topic.items.filter((i) => i.type === "image");
  const files = topic.items.filter((i) => i.type === "file");
  const imageItems = images.filter((i) => !i.url?.includes("#pdf"));

  const categoryColor = topic.category
    ? IMPORTANT_CATEGORY_COLORS[topic.category]
    : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && lightboxIndex !== null) return;
          onOpenChange(newOpen);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl"
          showCloseButton={false}
        >
          <VisuallyHidden.Root>
            <DialogTitle>Topic Details</DialogTitle>
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

          {/* Main content */}
          <div className="flex flex-col gap-5 px-4 pb-5 md:flex-row md:gap-8 md:px-6 md:pb-6">
            {/* Left: content */}
            <div className="min-w-0 flex-1 space-y-5">
              {/* Title */}
              {editingTitle ? (
                <input
                  ref={titleRef}
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                    if (e.key === "Escape") { setEditingTitle(false); setTitleValue(topic.title); }
                  }}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-primary md:text-xl"
                />
              ) : (
                <div className="flex items-center gap-3">
                  {topic.icon && (
                    isImageIcon(topic.icon) ? (
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={topic.icon} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-2xl">{topic.icon}</span>
                    )
                  )}
                  <h2
                    onClick={() => {
                      setTitleValue(topic.title);
                      setEditingTitle(true);
                      setTimeout(() => titleRef.current?.focus(), 0);
                    }}
                    className="cursor-pointer rounded-md border border-dashed border-transparent px-2 py-1 text-xl font-semibold text-foreground transition-colors hover:border-border hover:bg-accent/50"
                  >
                    {topic.title}
                  </h2>
                  {topic.pinned && (
                    <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
              )}

              {/* Metadata badges */}
              <div className="flex flex-wrap items-center gap-2 px-1">
                {topic.category && (
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{
                      backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                      color: categoryColor || undefined,
                    }}
                  >
                    {topic.category}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {topic._count.items} item{topic._count.items !== 1 ? "s" : ""}
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  Updated {format(new Date(topic.updatedAt), "MMM d, yyyy")}
                </span>
              </div>

              {/* ── Links Section ── */}
              <Section
                icon={<Link2 className="h-4 w-4" />}
                title="Links"
                count={links.length}
                onAdd={() => {
                  setAddingLink(true);
                  setTimeout(() => linkUrlRef.current?.focus(), 0);
                }}
              >
                {links.length > 0 && (
                  <div className="space-y-1">
                    {links.map((link, idx) => (
                      <div
                        key={link.id}
                        className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-accent/50 md:py-1.5"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
                        <a
                          href={link.url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {link.label || link.url}
                        </a>
                        <ReorderButtons
                          index={idx}
                          total={links.length}
                          onMove={(dir) => moveItem(topic.items, link.id, dir)}
                        />
                        <button
                          onClick={() => deleteItemMutation.mutate(link.id)}
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
                      <Button className="h-10 md:h-9" onClick={addLink} disabled={!linkUrl.trim()}>
                        Add Link
                      </Button>
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
                    onClick={() => {
                      setAddingLink(true);
                      setTimeout(() => linkUrlRef.current?.focus(), 0);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add a link...
                  </button>
                )}
              </Section>

              {/* ── Notes Section ── */}
              <Section
                icon={<StickyNote className="h-4 w-4" />}
                title="Notes"
                count={notes.length}
                onAdd={() => {
                  setAddingNote(true);
                  setTimeout(() => noteRef.current?.focus(), 0);
                }}
              >
                {notes.length > 0 && (
                  <div className="space-y-2">
                    {notes.map((note, idx) => (
                      <div key={note.id} className="group rounded-md border border-border bg-card/50 px-3 py-2.5">
                        {editingNoteId === note.id ? (
                          <div>
                            <textarea
                              ref={editNoteRef}
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              rows={4}
                              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary sm:text-sm"
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                  e.preventDefault();
                                  saveNoteEdit(note.id);
                                }
                                if (e.key === "Escape") setEditingNoteId(null);
                              }}
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <Button className="h-10 md:h-9" onClick={() => saveNoteEdit(note.id)}>Save</Button>
                              <Button className="h-10 md:h-9" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p
                              className={cn(
                                "whitespace-pre-wrap break-words text-sm text-foreground cursor-pointer",
                                !expandedNotes.has(note.id) && "line-clamp-3"
                              )}
                              onClick={() => {
                                setExpandedNotes((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(note.id)) next.delete(note.id);
                                  else next.add(note.id);
                                  return next;
                                });
                              }}
                            >
                              {note.content}
                            </p>
                            <div className="mt-2 flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditNoteContent(note.content ?? "");
                                  setTimeout(() => editNoteRef.current?.focus(), 0);
                                }}
                                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                              <ReorderButtons
                                index={idx}
                                total={notes.length}
                                onMove={(dir) => moveItem(topic.items, note.id, dir)}
                              />
                              <button
                                onClick={() => deleteItemMutation.mutate(note.id)}
                                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                              <span className="ml-auto text-[10px] text-muted-foreground/50">
                                {format(new Date(note.createdAt), "MMM d")}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {addingNote && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      ref={noteRef}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write a note..."
                      rows={3}
                      className="w-full resize-y rounded-md border border-border bg-card px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); addNote(); }
                        if (e.key === "Escape") { setAddingNote(false); setNoteContent(""); }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button className="h-10 md:h-9" onClick={addNote} disabled={!noteContent.trim()}>
                        Add Note
                      </Button>
                      <Button
                        className="h-10 md:h-9"
                        variant="ghost"
                        onClick={() => { setAddingNote(false); setNoteContent(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {!addingNote && notes.length === 0 && (
                  <button
                    onClick={() => {
                      setAddingNote(true);
                      setTimeout(() => noteRef.current?.focus(), 0);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add a note...
                  </button>
                )}
              </Section>

              {/* ── Images Section ── */}
              <Section
                icon={<ImageIcon className="h-4 w-4" />}
                title="Images"
                count={images.length}
                onAdd={() => imageUploadRef.current?.click()}
                addLabel={uploadMutation.isPending ? undefined : "Add"}
                addDisabled={uploadMutation.isPending}
                addIcon={uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin md:h-3 md:w-3" /> : undefined}
              >
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      const fileList = Array.from(e.target.files);
                      e.target.value = "";
                      uploadMutation.mutate({ files: fileList, type: "image" });
                    }
                  }}
                />

                {images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {images.map((img) => {
                      const isPdf = img.url?.includes("#pdf");
                      const imgIndex = isPdf ? -1 : imageItems.findIndex((i) => i.id === img.id);
                      const imgUrl = img.url || "";

                      return (
                        <div key={img.id}>
                          {isPdf ? (
                            <div className="overflow-hidden rounded-lg">
                              <PdfPreviewCard
                                url={imgUrl}
                                title={img.label || img.media?.filename || "PDF"}
                                thumbnailUrl={img.media?.id ? `/api/media/${img.media.id}/thumb` : null}
                                size={img.media?.size}
                                className="border-0 bg-muted p-2"
                              />
                            </div>
                          ) : (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setLightboxIndex(imgIndex)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setLightboxIndex(imgIndex);
                                }
                              }}
                              className="flex items-center justify-center w-full overflow-hidden rounded-lg bg-muted hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={img.label || "Image"}
                                className="max-w-full max-h-56 object-contain"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {img.label && (
                              <span className="flex-1 truncate text-xs text-muted-foreground">{img.label}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteItemMutation.mutate(img.id)}
                              className="flex items-center justify-center py-1.5 px-2.5 rounded-md bg-muted/50 text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageUploadRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Add images...
                  </button>
                )}
              </Section>

              {/* ── Files Section ── */}
              <Section
                icon={<FileText className="h-4 w-4" />}
                title="Files"
                count={files.length}
                onAdd={() => fileUploadRef.current?.click()}
                addLabel={uploadMutation.isPending ? undefined : "Add"}
                addDisabled={uploadMutation.isPending}
                addIcon={uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin md:h-3 md:w-3" /> : undefined}
              >
                <input
                  ref={fileUploadRef}
                  type="file"
                  accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      const fileList = Array.from(e.target.files);
                      e.target.value = "";
                      uploadMutation.mutate({ files: fileList, type: "file" });
                    }
                  }}
                />

                {files.length > 0 ? (
                  <div className="space-y-1">
                    {files.map((file, idx) => {
                      const isPdf = file.url?.includes("#pdf") || file.media?.mimeType?.includes("pdf");
                      const fileSize = file.media?.size
                        ? file.media.size < 1024 * 1024
                          ? `${(file.media.size / 1024).toFixed(0)} KB`
                          : `${(file.media.size / (1024 * 1024)).toFixed(1)} MB`
                        : null;

                      return (
                        <div
                          key={file.id}
                          className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 md:py-1.5"
                        >
                          {isPdf && file.media ? (
                            <PdfPreviewCard
                              url={file.url || ""}
                              title={file.label || file.media.filename || "PDF"}
                              thumbnailUrl={file.media.thumbnail ? `/api/media/${file.media.id}/thumb` : null}
                              size={file.media.size}
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 hover:bg-transparent"
                            />
                          ) : (
                            <>
                              <FileText className={cn("h-5 w-5 shrink-0", isPdf ? "text-red-400" : "text-muted-foreground")} />
                              <div className="min-w-0 flex-1">
                                <a
                                  href={(file.url || "").replace("#pdf", "")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate text-sm text-primary hover:underline"
                                >
                                  {file.label || file.media?.filename || "File"}
                                </a>
                                {fileSize && (
                                  <span className="text-[11px] text-muted-foreground/60">{fileSize}</span>
                                )}
                              </div>
                            </>
                          )}
                          <ReorderButtons
                            index={idx}
                            total={files.length}
                            onMove={(dir) => moveItem(topic.items, file.id, dir)}
                          />
                          <button
                            onClick={() => deleteItemMutation.mutate(file.id)}
                            className="shrink-0 p-1 text-muted-foreground hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileUploadRef.current?.click()}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent/50 md:py-2.5"
                  >
                    <FileText className="h-4 w-4" />
                    Add files...
                  </button>
                )}
              </Section>

              {/* Timestamps */}
              <div className="space-y-0.5 px-1 pt-1">
                <Separator className="mb-2" />
                <p className="text-[11px] text-muted-foreground/60">
                  Created {format(new Date(topic.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
                <p className="text-[11px] text-muted-foreground/60">
                  Updated {format(new Date(topic.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            {/* Right: sidebar actions */}
            <div className="flex w-full flex-col gap-2 md:w-48">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </p>

              {/* Category */}
              <Select
                value={topic.category ?? "none"}
                onValueChange={(v) =>
                  updateTopicMutation.mutate({ category: v === "none" ? null : v })
                }
              >
                <SelectTrigger className="h-10 text-sm font-normal md:h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
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

              {/* Icon */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                    <span className="flex items-center gap-2">
                      {isImageIcon(topic.icon) ? (
                        <span className="h-5 w-5 shrink-0 overflow-hidden rounded">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={topic.icon!} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : (
                        <span className="text-base">{topic.icon || "📌"}</span>
                      )}
                      Icon
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <IconPicker
                    value={topic.icon ?? ""}
                    onChange={(icon) => updateTopicMutation.mutate({ icon: icon || null })}
                  />
                </PopoverContent>
              </Popover>

              {/* Pin toggle */}
              <Button
                variant="secondary"
                className="h-10 w-full justify-start gap-2 text-sm font-normal md:h-9"
                onClick={() => updateTopicMutation.mutate({ pinned: !topic.pinned })}
              >
                {topic.pinned ? (
                  <>
                    <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                    Pin to top
                  </>
                )}
              </Button>

              <Separator className="my-1" />

              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 w-full justify-start text-red-400 hover:bg-red-400/10 hover:text-red-400 md:h-9"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Topic
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete topic?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{topic.title}&rdquo; and all its items. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteTopicMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      {lightboxIndex !== null && imageItems.length > 0 && createPortal(
        <ImageLightbox
          items={imageItems}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />,
        document.body,
      )}
    </>
  );
}

// ────────────────────────────────────────────
// Section wrapper
// ────────────────────────────────────────────

function Section({
  icon,
  title,
  count,
  onAdd,
  addLabel = "Add",
  addDisabled,
  addIcon,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  onAdd: () => void;
  addLabel?: string;
  addDisabled?: boolean;
  addIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium text-foreground">{title}</span>
          {count > 0 && (
            <span className="text-[11px] text-muted-foreground/60">{count}</span>
          )}
        </div>
        {count > 0 && (
          <button
            onClick={onAdd}
            disabled={addDisabled}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground md:rounded-md md:border-0 md:px-2 md:py-1 md:text-xs disabled:opacity-50"
          >
            {addIcon || <Plus className="h-4 w-4 md:h-3 md:w-3" />}
            {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────
// Reorder buttons (up/down arrows)
// ────────────────────────────────────────────

function ReorderButtons({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (dir: "up" | "down") => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100">
      <button
        onClick={() => onMove("up")}
        disabled={index === 0}
        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Move up"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => onMove("down")}
        disabled={index === total - 1}
        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        title="Move down"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────
// Image Lightbox (portaled)
// ────────────────────────────────────────────

function ImageLightbox({
  items,
  currentIndex,
  onIndexChange,
  onClose,
}: {
  items: TopicItem[];
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
      if (e.key === "ArrowRight" && currentIndex < items.length - 1) onIndexChange(currentIndex + 1);
    }
    // capture phase fires before Radix Dialog's Escape handler
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [currentIndex, items.length, onIndexChange, onClose]);

  const item = items[currentIndex];
  if (!item) return null;

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
        src={item.url || ""}
        alt={item.label || "Image"}
        className="block h-auto w-auto max-h-[85vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />
      {/* Desktop close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 hidden rounded-full bg-black/50 p-2 text-white hover:bg-black/80 cursor-pointer pointer-events-auto sm:block"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Mobile close bar */}
      <button
        type="button"
        className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center gap-2 bg-black/60 text-white active:bg-white/10 sm:hidden"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
        <span className="text-sm font-medium">Close</span>
      </button>
      {item.label && (
        <p className="absolute bottom-6 left-0 right-0 text-center text-sm text-white/80">
          {item.label}
        </p>
      )}
    </div>
  );
}
