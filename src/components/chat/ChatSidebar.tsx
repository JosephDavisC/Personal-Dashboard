"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MessageSquare, PanelLeftClose, PanelLeft, History, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ChatSidebarProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function ConversationList({ activeId, onSelect }: ChatSidebarProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations?limit=50");
      const json = (await res.json()) as { data: Conversation[] };
      return json.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeId === id) onSelect(null);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setEditingId(null);
    },
  });

  function startRename(conv: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  }

  function submitRename() {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    renameMutation.mutate({ id: editingId, title: editTitle.trim() });
  }

  const conversations = data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => onSelect(null)}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
              activeId === conv.id
                ? "bg-primary/10 text-primary"
                : "hover:bg-accent text-foreground"
            }`}
            onClick={() => editingId !== conv.id && onSelect(conv.id)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
            <div className="flex-1 min-w-0">
              {editingId === conv.id ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); submitRename(); }}
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <button type="submit" className="shrink-0 p-1 rounded hover:bg-accent text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <>
                  <p className="text-sm truncate">
                    {conv.title || "New conversation"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.updatedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </>
              )}
            </div>
            {editingId !== conv.id && (
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={(e) => startRename(conv, e)}
                  className="shrink-0 p-1.5 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-accent hover:text-foreground text-muted-foreground transition-opacity"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 p-1.5 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this conversation and all its
                        messages.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(conv.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatSidebarDesktop(props: ChatSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="hidden lg:flex shrink-0 w-12 border-r border-border bg-sidebar flex-col items-center pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
          title="Show sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex shrink-0 w-64 border-r border-border bg-sidebar flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-0">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          History
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          title="Hide sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <ConversationList {...props} />
    </div>
  );
}

export function ChatSidebarMobile(props: ChatSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="lg:hidden shrink-0 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent"
          title="Chat history"
        >
          <History className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Chat History</SheetTitle>
        {/* Custom header with close button properly aligned */}
        <div className="flex items-center justify-between px-3 pt-3 pb-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            History
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ConversationList
          {...props}
          onSelect={(id) => {
            props.onSelect(id);
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
