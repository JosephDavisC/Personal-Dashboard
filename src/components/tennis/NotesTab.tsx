"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pin, PinOff, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const NOTE_TAGS = ["technique", "equipment", "court", "drill", "other"];

interface TennisNote {
  id: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export function NotesTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: notes, isLoading } = useQuery({
    queryKey: ["tennis-notes", search, filterTag],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterTag) params.set("tag", filterTag);
      const res = await fetch(`/api/tennis/notes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      const json = await res.json();
      return (json.data ?? []) as TennisNote[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tennis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, tags: newTags }),
      });
      if (!res.ok) throw new Error("Failed to create note");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-notes"] });
      setNewContent("");
      setNewTags([]);
      setAdding(false);
      toast.success("Note added");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; content?: string; pinned?: boolean; tags?: string[] }) => {
      const res = await fetch(`/api/tennis/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update note");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-notes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tennis/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-notes"] });
      toast.success("Note deleted");
    },
  });

  const debouncedUpdate = useCallback(
    (id: string, content: string) => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        updateMutation.mutate({ id, content });
      }, 2000);
    },
    [updateMutation]
  );

  return (
    <div className="space-y-4">
      {/* Search + filter + add button — single row on desktop */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-base sm:text-sm"
          />
        </div>
        <div className="flex flex-1 items-center gap-1 flex-wrap">
          <button
            onClick={() => setFilterTag("")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              !filterTag ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {NOTE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === filterTag ? "" : tag)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                filterTag === tag ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
          {!adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="ml-auto gap-1.5 hidden sm:inline-flex">
              <Plus className="h-3.5 w-3.5" />
              Add Note
            </Button>
          )}
        </div>
      </div>

      {/* Mobile add button */}
      {!adding && (
        <Button variant="outline" onClick={() => setAdding(true)} className="gap-1.5 sm:hidden">
          <Plus className="h-3.5 w-3.5" />
          Add Note
        </Button>
      )}

      {/* Add note card */}
      {adding && (
        <Card className="p-4 space-y-3">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write a note..."
            className="text-base sm:text-sm min-h-[80px]"
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            {NOTE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setNewTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  newTags.includes(tag)
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-card border border-border text-muted-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewContent(""); setNewTags([]); }}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newContent.trim() || createMutation.isPending}>
              Save Note
            </Button>
          </div>
        </Card>
      )}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse bg-card" />)}
        </div>
      ) : notes?.length ? (
        <div className="space-y-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={(content) => debouncedUpdate(note.id, content)}
              onTogglePin={() => updateMutation.mutate({ id: note.id, pinned: !note.pinned })}
              onDelete={() => deleteMutation.mutate(note.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {search || filterTag ? "No matching notes" : "No notes yet"}
        </p>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onUpdate,
  onTogglePin,
  onDelete,
}: {
  note: TennisNote;
  onUpdate: (content: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);

  return (
    <Card className={`p-4 ${note.pinned ? "border-primary/30" : ""}`}>
      {editing ? (
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onUpdate(e.target.value);
          }}
          onBlur={() => setEditing(false)}
          className="text-sm min-h-[60px]"
          autoFocus
        />
      ) : (
        <p
          className="text-sm whitespace-pre-wrap cursor-text"
          onClick={() => setEditing(true)}
        >
          {note.content}
        </p>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1 flex-wrap">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePin}>
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
