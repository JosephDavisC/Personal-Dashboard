"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { SessionForm } from "./SessionForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TIMEZONE } from "@/lib/constants";


const TYPE_STYLES: Record<string, string> = {
  practice: "bg-blue-500/20 text-blue-400",
  lesson: "bg-green-500/20 text-green-400",
  match: "bg-orange-500/20 text-orange-400",
};

const TYPE_FILTERS = [
  { key: "", label: "All" },
  { key: "practice", label: "Practice" },
  { key: "lesson", label: "Lessons" },
  { key: "match", label: "Matches" },
];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "longest", label: "Longest" },
];

interface SessionsTabProps {
  onLogSession: () => void;
}

interface SessionData {
  id: string;
  type: string;
  date: string;
  duration: number | null;
  location: string | null;
  racketId: string | null;
  tags: string[];
  notes: string | null;
  cost: number | null;
  coach: string | null;
  playedWith: string | null;
  calendarEventId: string | null;
  calendarEventTitle: string | null;
  racket: { id: string; name: string; brand: string; model: string } | null;
  _count: { photos: number; videos: number; ratings: number };
}

interface StatsData {
  thisMonth: { total: number; hours: number; lessonCost: number; byType: { practice: number; lesson: number; match: number } };
  thisYear: { total: number; hours: number; lessonCost: number; byType: { practice: number; lesson: number; match: number } };
  allTime: { total: number; hours: number; lessonCost: number; byType: { practice: number; lesson: number; match: number } };
}

export function SessionsTab({ onLogSession }: SessionsTabProps) {
  const queryClient = useQueryClient();
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["tennis-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/sessions?limit=50");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const json = await res.json();
      return (json.data ?? []) as SessionData[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["tennis-stats"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json.data as StatsData;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tennis/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tennis-stats"] });
      toast.success("Session deleted");
      setDeleteId(null);
    },
  });

  const filteredSessions = useMemo(() => {
    let list = sessionsData ?? [];
    if (typeFilter) list = list.filter((s) => s.type === typeFilter);
    if (sortBy === "oldest") list = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    else if (sortBy === "longest") list = [...list].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
    // newest is the default API order
    return list;
  }, [sessionsData, typeFilter, sortBy]);

  function formatStat(d: { total: number; hours: number; lessonCost: number }) {
    let text = `${d.hours.toFixed(1)}h total`;
    if (d.lessonCost > 0) text += ` · $${d.lessonCost.toFixed(0)} lessons`;
    return text;
  }

  return (
    <div className="space-y-6">
      {/* Stats — 2+1 grid on mobile */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "This Month", data: stats.thisMonth },
            { label: "This Year", data: stats.thisYear },
          ].map(({ label, data }) => (
            <Card key={label} className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold font-heading">{data.total}</p>
              <p className="text-xs text-muted-foreground">{formatStat(data)}</p>
            </Card>
          ))}
          <Card className="col-span-2 p-4">
            <p className="text-xs font-medium text-muted-foreground">All Time</p>
            <p className="text-2xl font-bold font-heading">{stats.allTime.total}</p>
            <p className="text-xs text-muted-foreground">{formatStat(stats.allTime)}</p>
          </Card>
        </div>
      )}

      {/* Session list header + filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-lg font-semibold mr-2">Sessions</h2>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  typeFilter === f.key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse bg-card" />)}
          </div>
        ) : filteredSessions.length ? (
          <div className="space-y-2">
            {filteredSessions.map((session) => (
              <Card key={session.id} className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TYPE_STYLES[session.type] ?? ""}`}>
                      {session.type}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatInTimeZone(new Date(session.date), TIMEZONE, "MMM d, yyyy")}
                    </span>
                    {session.duration && (
                      <span className="text-sm text-muted-foreground">&middot; {session.duration}h</span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                    {session.location && <span className="text-muted-foreground">{session.location}</span>}
                    {session.racket && <span className="text-muted-foreground">{session.racket.name}</span>}
                    {session.cost != null && session.cost > 0 && <span className="text-green-400">${session.cost}</span>}
                    {session.coach && <span className="text-muted-foreground">w/ {session.coach}</span>}
                    {session.playedWith && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {session.playedWith}
                      </span>
                    )}
                  </div>
                  {session.calendarEventTitle && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-primary/70">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      <span className="truncate">{session.calendarEventTitle}</span>
                    </div>
                  )}

                  {session.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {session.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {session.notes && (
                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{session.notes}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditSession(session)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(session.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">{typeFilter ? `No ${typeFilter} sessions` : "No sessions logged yet"}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onLogSession}>
              Log your first session
            </Button>
          </Card>
        )}
      </div>

      {editSession && (
        <SessionForm
          open={!!editSession}
          onOpenChange={(v) => { if (!v) setEditSession(null); }}
          editingSession={editSession as unknown as Record<string, unknown>}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this session and its photos/videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
