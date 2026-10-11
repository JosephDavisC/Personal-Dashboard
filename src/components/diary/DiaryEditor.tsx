"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";
import {
  ChevronLeft,
  Check,
  ImagePlus,
  Loader2,
  Trash2,
  X,
  Save,
  Link2,
  ExternalLink,
  Pencil,
  Plus,
  Sparkles,
  FileText,
  Film,
  Play,
  Pin,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { compressImageClient } from "@/lib/compress-image";
import { TIMEZONE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { MoodPicker } from "./MoodPicker";
import { TagPicker } from "./TagPicker";
import { AutoContext, type DayContext } from "./AutoContext";
import { PhotoLightbox } from "./PhotoLightbox";
import type { DiaryEntry, DiaryPhoto, DiaryLink } from "@/generated/prisma/client";

/** Convert **bold** markdown to <strong> HTML for contentEditable */
function markdownToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

/** Convert <strong> HTML back to **bold** markdown */
function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return html
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div><br><\/div>/gi, "\n")
    .replace(/<div>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/^\n/, "");
}

const WRITING_PROMPTS = [
  "How was your day?",
  "What made you smile today?",
  "What's on your mind?",
  "What did you learn today?",
  "What are you grateful for?",
  "How are you feeling right now?",
  "What was the highlight of your day?",
  "What challenged you today?",
  "What's something you're looking forward to?",
  "Describe your day in three words...",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getPromptForDate(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return WRITING_PROMPTS[Math.abs(hash) % WRITING_PROMPTS.length] ?? WRITING_PROMPTS[0]!;
}

interface DiaryEditorProps {
  date: string; // yyyy-MM-dd
  onClose: () => void;
}

type PhotoWithMime = DiaryPhoto & { mimeType?: string | null };
type EntryWithRelations = DiaryEntry & { photos: PhotoWithMime[]; links: DiaryLink[] };

export function DiaryEditor({ date, onClose }: DiaryEditorProps) {
  const queryClient = useQueryClient();
  const dateObj = parseISO(date);
  const displayDate = formatInTimeZone(dateObj, TIMEZONE, "EEEE, MMMM d, yyyy");

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasInitialized = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isUserInputRef = useRef(false);

  // Fetch existing entry
  const { data: entry, isLoading } = useQuery<EntryWithRelations | null>({
    queryKey: ["diary-entry", date],
    queryFn: async () => {
      const res = await fetch(`/api/diary/${date}`);
      if (!res.ok) throw new Error("Failed to fetch entry");
      const json = (await res.json()) as { data: EntryWithRelations | null };
      return json.data;
    },
  });

  // Fetch auto-context
  const { data: context, isLoading: contextLoading } = useQuery<DayContext>({
    queryKey: ["diary-context", date],
    queryFn: async () => {
      const res = await fetch(`/api/diary/${date}/context`);
      if (!res.ok) throw new Error("Failed to fetch context");
      const json = (await res.json()) as { data: DayContext };
      return json.data;
    },
  });

  // Initialize form from entry data
  useEffect(() => {
    if (entry && !hasInitialized.current) {
      setContent(entry.content ?? "");
      setMood(entry.mood ?? null);
      setTags(entry.tags ?? []);
      hasInitialized.current = true;
    } else if (!entry && !isLoading && !hasInitialized.current) {
      hasInitialized.current = true;
    }
  }, [entry, isLoading]);

  // Save mutation (upsert)
  const saveMutation = useMutation({
    mutationFn: async (data: { content?: string | null; mood?: string | null; tags?: string[] }) => {
      const res = await fetch(`/api/diary/${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to save");
      }
      return ((await res.json()) as { data: EntryWithRelations }).data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["diary-entry", date], data);
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      queryClient.invalidateQueries({ queryKey: ["diary-calendar"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      toast.error("Failed to save diary entry");
      setSaveStatus("idle");
    },
  });

  // Autosave content with debounce
  const autoSave = useCallback(
    (newContent: string) => {
      clearTimeout(debounceRef.current);
      setSaveStatus("idle");
      debounceRef.current = setTimeout(() => {
        setSaveStatus("saving");
        saveMutation.mutate({ content: newContent, mood, tags });
      }, 2000);
    },
    [mood, tags, saveMutation]
  );

  // Sync content → innerHTML only for external changes (AI summary, initial load)
  useEffect(() => {
    if (editorRef.current && !isUserInputRef.current) {
      editorRef.current.innerHTML = markdownToHtml(content);
    }
    isUserInputRef.current = false;
  }, [content]);

  function handleEditorInput() {
    if (!editorRef.current) return;
    const markdown = htmlToMarkdown(editorRef.current.innerHTML);
    isUserInputRef.current = true;
    setContent(markdown);
    autoSave(markdown);
  }

  function toggleBold() {
    document.execCommand("bold", false);
    editorRef.current?.focus();
    if (editorRef.current) {
      const markdown = htmlToMarkdown(editorRef.current.innerHTML);
      isUserInputRef.current = true;
      setContent(markdown);
      autoSave(markdown);
    }
  }

  function handleEditorKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      toggleBold();
    }
  }

  // Save mood/tags immediately
  function handleMoodChange(newMood: string | null) {
    setMood(newMood);
    clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    saveMutation.mutate({ content, mood: newMood, tags });
  }

  function handleTagsChange(newTags: string[]) {
    setTags(newTags);
    clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    saveMutation.mutate({ content, mood, tags: newTags });
  }

  // Manual save
  function handleSave() {
    clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    saveMutation.mutate({ content, mood, tags });
    toast.success("Entry saved");
  }

  // Force save on Cmd+Enter
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  // Delete entry with undo
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Snapshot current entry for undo
      const snapshot = {
        content: content ?? entry?.content ?? null,
        mood: mood ?? entry?.mood ?? null,
        tags: tags.length ? tags : (entry?.tags ?? []),
      };
      const res = await fetch(`/api/diary/${date}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return snapshot;
    },
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
      queryClient.invalidateQueries({ queryKey: ["diary-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["diary-gallery"] });
      onClose();
      toast.success("Entry deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await fetch(`/api/diary/${date}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snapshot),
              });
              queryClient.invalidateQueries({ queryKey: ["diary-entries"] });
              queryClient.invalidateQueries({ queryKey: ["diary-calendar"] });
              toast.success("Entry restored");
            } catch {
              toast.error("Failed to restore entry");
            }
          },
        },
        duration: 8000,
      });
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  // --- Links ---
  const addLinkMutation = useMutation({
    mutationFn: async (url: string) => {
      // Ensure entry exists first
      let entryId = entry?.id;
      if (!entryId) {
        const createRes = await fetch("/api/diary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, content, mood, tags }),
        });
        if (!createRes.ok) throw new Error("Failed to create entry");
        const created = ((await createRes.json()) as { data: EntryWithRelations }).data;
        entryId = created.id;
        queryClient.setQueryData(["diary-entry", date], created);
      }

      const res = await fetch("/api/diary/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, url }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to add link");
      }
      return ((await res.json()) as { data: DiaryLink }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entry", date] });
      setNewLinkUrl("");
      setAddingLink(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add link"),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await fetch(`/api/diary/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete link");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entry", date] });
    },
    onError: () => toast.error("Failed to delete link"),
  });

  // --- AI Summary ---
  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/diary/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to generate summary");
      }
      return ((await res.json()) as { data: { summary: string } }).data;
    },
    onSuccess: (data) => {
      const newContent = content
        ? `${content}\n\n${data.summary}`
        : data.summary;
      setContent(newContent);
      autoSave(newContent);
      toast.success("Summary added");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to summarize"),
  });

  const hasContext = context && (
    context.eventsCount > 0 || context.shifts.length > 0 || context.tasksCompleted.length > 0 || (context.tasksCreated?.length ?? 0) > 0 || (context.tasksMoved?.length ?? 0) > 0 || (context.manualTasks?.length ?? 0) > 0
  );

  // --- Pin Tasks ---
  const [showTaskSearch, setShowTaskSearch] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const taskSearchRef = useRef<HTMLInputElement>(null);

  const { data: allTasks } = useQuery<{ id: string; title: string; status: string }[]>({
    queryKey: ["tasks-for-diary"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) return [];
      const json = (await res.json()) as { data: { id: string; title: string; status: string }[] };
      return json.data;
    },
    enabled: showTaskSearch,
  });

  const filteredTasks = useMemo(() => {
    if (!allTasks || !taskSearch.trim()) return allTasks ?? [];
    const q = taskSearch.toLowerCase();
    return allTasks.filter((t) => t.title.toLowerCase().includes(q));
  }, [allTasks, taskSearch]);

  // IDs already in context (auto + manual) to hide from search
  const contextTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (context?.manualTasks) for (const t of context.manualTasks) ids.add(t.id);
    return ids;
  }, [context?.manualTasks]);

  const addTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/diary/${date}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error("Failed to add task");
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ["diary-context", date] });
      const prev = queryClient.getQueryData<DayContext>(["diary-context", date]);
      const task = allTasks?.find((t) => t.id === taskId);
      if (prev && task) {
        queryClient.setQueryData<DayContext>(["diary-context", date], {
          ...prev,
          manualTasks: [...(prev.manualTasks ?? []), { id: task.id, title: task.title, status: task.status }],
        });
      }
      return { prev };
    },
    onError: (_err, _taskId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["diary-context", date], ctx.prev);
      toast.error("Failed to pin task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-context", date] });
    },
  });

  const removeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/diary/${date}/tasks?taskId=${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove task");
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ["diary-context", date] });
      const prev = queryClient.getQueryData<DayContext>(["diary-context", date]);
      if (prev) {
        queryClient.setQueryData<DayContext>(["diary-context", date], {
          ...prev,
          manualTasks: (prev.manualTasks ?? []).filter((t) => t.id !== taskId),
        });
      }
      return { prev };
    },
    onError: (_err, _taskId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["diary-context", date], ctx.prev);
      toast.error("Failed to unpin task");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-context", date] });
    },
  });

  function handleAddLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    // Auto-prepend https if no protocol
    const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;
    addLinkMutation.mutate(fullUrl);
  }

  // --- Photos ---
  const photoUploadRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let entryId = entry?.id;
      if (!entryId) {
        const createRes = await fetch("/api/diary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, content, mood, tags }),
        });
        if (!createRes.ok) throw new Error("Failed to create entry");
        const created = ((await createRes.json()) as { data: EntryWithRelations }).data;
        entryId = created.id;
        queryClient.setQueryData(["diary-entry", date], created);
      }

      const uploaded: DiaryPhoto[] = [];
      for (const rawFile of files) {
        const isVideo = rawFile.type.startsWith("video/");
        const file = isVideo || rawFile.type === "application/pdf"
          ? rawFile
          : await compressImageClient(rawFile);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", `Diary ${date}`);
        formData.append("tags", JSON.stringify(["diary"]));

        const mediaRes = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        if (!mediaRes.ok) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };

        const isPdf = file.type === "application/pdf";
        const suffix = isPdf ? "#pdf" : isVideo ? "#video" : "";
        const photoRes = await fetch("/api/diary/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId,
            url: `/api/media/share/${media.data.shareSlug}${suffix}`,
            mediaId: media.data.id,
            order: (entry?.photos.length ?? 0) + uploaded.length,
          }),
        });
        if (photoRes.ok) {
          const photo = ((await photoRes.json()) as { data: DiaryPhoto }).data;
          uploaded.push(photo);
        }
      }
      return uploaded;
    },
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ["diary-entry", date] });
      queryClient.invalidateQueries({ queryKey: ["diary-gallery"] });
      if (uploaded.length > 0) {
        toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
      }
    },
    onError: () => toast.error("Failed to upload photos"),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/diary/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete photo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entry", date] });
      queryClient.invalidateQueries({ queryKey: ["diary-gallery"] });
    },
    onError: () => toast.error("Failed to delete photo"),
  });

  // Caption editing
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");

  const captionMutation = useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: string; caption: string }) => {
      const res = await fetch(`/api/diary/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption || null }),
      });
      if (!res.ok) throw new Error("Failed to update caption");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["diary-entry", date] });
      setEditingCaptionId(null);
    },
    onError: () => toast.error("Failed to update caption"),
  });

  function startEditCaption(photo: DiaryPhoto) {
    setEditingCaptionId(photo.id);
    setCaptionValue(photo.caption ?? "");
  }

  function saveCaption(photoId: string) {
    captionMutation.mutate({ photoId, caption: captionValue });
  }

  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  }, [content]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-24 bg-muted rounded-full" />
          <div className="h-7 w-20 bg-muted rounded-full" />
        </div>
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  const photos = entry?.photos ?? [];
  const links = entry?.links ?? [];

  return (
    <div className="space-y-4 sm:space-y-6 p-4 md:p-6 max-w-4xl mx-auto" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 sm:gap-3 min-w-0 -ml-2 sm:-ml-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-heading text-lg sm:text-2xl font-bold text-foreground truncate flex-1">
            {displayDate}
          </h2>
          {/* Desktop: inline buttons */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {saveStatus === "saving" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {saveStatus === "saved" && (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
            {entry && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(`/api/diary/${date}/pdf`, "_blank")}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            )}
            {entry && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="gap-1.5 text-red-400 hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this diary entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the entry for {displayDate} and all attached photos and links.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate()}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {/* Mobile: full-width buttons under date */}
        <div className="flex sm:hidden items-center gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save"}
          </Button>
          {entry && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="flex-1 gap-1.5 text-red-400 hover:text-red-300 border-red-400/20">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this diary entry?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the entry for {displayDate} and all attached photos and links.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Auto-context */}
      <div className="space-y-2">
        <AutoContext
          context={context ?? null}
          loading={contextLoading}
          onRemoveManualTask={(taskId) => removeTaskMutation.mutate(taskId)}
        />

        {/* Pin Task button + search */}
        {!showTaskSearch ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setShowTaskSearch(true);
              setTimeout(() => taskSearchRef.current?.focus(), 100);
            }}
          >
            <Pin className="h-3.5 w-3.5" />
            Pin Task
          </Button>
        ) : (
          <div className="rounded-lg border border-border bg-card p-2 sm:p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  ref={taskSearchRef}
                  type="text"
                  placeholder="Search tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setShowTaskSearch(false); setTaskSearch(""); }
                  }}
                  autoFocus
                  className="w-full bg-muted/30 border border-border rounded-md pl-8 pr-3 py-1.5 text-base sm:text-sm placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30 focus:border-primary/30 focus:outline-none"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => { setShowTaskSearch(false); setTaskSearch(""); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filteredTasks.filter((t) => !contextTaskIds.has(t.id)).length === 0 ? (
                <p className="text-xs text-muted-foreground/50 py-2 text-center">
                  {taskSearch ? "No matching tasks" : "Loading..."}
                </p>
              ) : (
                filteredTasks
                  .filter((t) => !contextTaskIds.has(t.id))
                  .slice(0, 20)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        addTaskMutation.mutate(t.id);
                        setTaskSearch("");
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <Pin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{t.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                        {t.status === "TODO" ? "To Do" : t.status === "IN_PROGRESS" ? "In Progress" : t.status === "DONE" ? "Done" : t.status}
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main editor card */}
      <Card className="border border-border">
        <CardContent className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Mood */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Mood
            </p>
            <MoodPicker value={mood} onChange={handleMoodChange} />
          </div>

          <Separator className="opacity-30" />

          {/* Tags */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Tags
            </p>
            <TagPicker value={tags} onChange={handleTagsChange} />
          </div>

          <Separator className="opacity-30" />

          {/* Write */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Write
                </p>
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 ml-1 border-l border-border/50 pl-2">
                  <button
                    type="button"
                    onClick={toggleBold}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Bold (⌘B)"
                  >
                    B
                  </button>
                  <span className="text-[10px] text-muted-foreground/30 ml-0.5 hidden sm:inline">⌘B</span>
                </div>
              </div>
              {hasContext && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex gap-1.5 text-xs h-7 text-muted-foreground hover:text-primary"
                  onClick={() => summarizeMutation.mutate()}
                  disabled={summarizeMutation.isPending}
                >
                  {summarizeMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Summarize my day
                </Button>
              )}
            </div>
            <div className="relative">
              {!content && (
                <div className="absolute inset-0 rounded-lg p-3 sm:p-4 text-base font-medium text-muted-foreground/50 pointer-events-none">
                  {getPromptForDate(date)}
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                className="w-full min-h-[180px] sm:min-h-[250px] bg-card border border-border rounded-lg p-3 sm:p-4 text-base font-medium leading-relaxed outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 [&_strong]:font-bold [&_strong]:text-foreground"
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground/30">
                {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? "s" : ""}` : ""}
              </span>
              <span className="text-xs text-muted-foreground/50 hidden sm:block">
                ⌘B bold · ⌘Enter save
              </span>
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Links (multi) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Links
            </p>
            {/* Existing links */}
            {links.length > 0 && (
              <div className="space-y-2 mb-3">
                {links.map((lnk) => (
                  <div
                    key={lnk.id}
                    className="flex items-center gap-2 group rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
                  >
                    {lnk.favicon && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={lnk.favicon}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <a
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-sm text-foreground hover:text-primary truncate"
                    >
                      {lnk.title || lnk.url}
                    </a>
                    <a
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteLinkMutation.mutate(lnk.id)}
                      className="shrink-0 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Add link input */}
            {addingLink ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <input
                    type="url"
                    placeholder="Paste a URL..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
                      if (e.key === "Escape") { setAddingLink(false); setNewLinkUrl(""); }
                    }}
                    autoFocus
                    className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-base sm:text-sm font-medium placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30 focus:border-primary/30 focus:outline-none"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddLink}
                  disabled={addLinkMutation.isPending || !newLinkUrl.trim()}
                >
                  {addLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setAddingLink(false); setNewLinkUrl(""); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setAddingLink(true)}
                disabled={links.length >= 5}
              >
                <Plus className="h-3.5 w-3.5" />
                Add link
                {links.length >= 5 && <span className="text-xs text-muted-foreground">(max 5)</span>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photos card */}
      <Card className="border border-border">
        <CardHeader className="p-3 pb-2 sm:p-4 sm:pb-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Media
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => photoUploadRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Add Media
            </Button>
            <input
              ref={photoUploadRef}
              type="file"
              accept="image/*,application/pdf,video/mp4,video/webm,video/quicktime"
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
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, i) => (
                <div key={photo.id}>
                  {(() => {
                    const isPdf = photo.url.includes("#pdf") || photo.mimeType === "application/pdf";
                    const isVideo = photo.url.includes("#video") || (photo.mimeType?.startsWith("video/") ?? false);
                    const lightboxPhotos = photos.filter(p => !p.url.includes("#pdf") && p.mimeType !== "application/pdf");
                    const lightboxIdx = (isPdf) ? -1 : lightboxPhotos.findIndex(p => p.id === photo.id);
                    const slug = photo.url.match(/\/share\/([^#/]+)/)?.[1];
                    return (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => isPdf ? window.open(photo.url.replace("#pdf", ""), "_blank") : setLightboxIndex(lightboxIdx)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isPdf ? window.open(photo.url.replace("#pdf", ""), "_blank") : setLightboxIndex(lightboxIdx); } }}
                      className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                    >
                      {isPdf ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <FileText className="h-10 w-10 text-red-400" />
                          <span className="text-xs text-muted-foreground">PDF</span>
                        </div>
                      ) : isVideo ? (
                        <div className="absolute inset-0">
                          {slug ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`/api/media/share/${slug}/thumb`}
                              alt={photo.caption || "Video thumbnail"}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : null}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                              <Play className="h-5 w-5 text-white fill-white" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2">
                            <Film className="h-4 w-4 text-white drop-shadow" />
                          </div>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={photo.caption || "Diary photo"}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    );
                  })()}
                  {/* Action buttons + caption — always visible */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => startEditCaption(photo)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-muted/50 text-xs text-muted-foreground hover:bg-muted active:bg-muted transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Caption
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePhotoMutation.mutate(photo.id)}
                      className="flex items-center justify-center py-1.5 px-2.5 rounded-md bg-muted/50 text-xs text-red-400 hover:bg-red-500/10 active:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Caption display or edit */}
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
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoUploadRef.current?.click()}
              className="w-full border-2 border-dashed border-border/50 rounded-lg p-6 sm:p-8 text-center text-muted-foreground hover:border-border transition-colors"
            >
              <ImagePlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Drop photos or videos here, or click to upload</p>
            </button>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos.filter(p => !p.url.includes("#pdf") && p.mimeType !== "application/pdf").map(p => ({
            ...p,
            isVideo: p.url.includes("#video") || (p.mimeType?.startsWith("video/") ?? false),
          }))}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Sticky mobile summarize button */}
      {hasContext && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] left-0 right-0 z-40 px-4 pb-2 sm:hidden">
          <Button
            variant="outline"
            className="w-full gap-2 bg-card/95 backdrop-blur-sm border-border shadow-lg"
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
          >
            {summarizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Summarize my day
          </Button>
        </div>
      )}
    </div>
  );
}
