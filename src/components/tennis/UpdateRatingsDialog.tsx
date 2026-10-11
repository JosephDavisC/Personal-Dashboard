"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Minus, Plus, Settings2, Trash2 } from "lucide-react";
import { STROKES, getCustomRaters, saveCustomRaters } from "@/lib/tennis/constants";
import type { StrokeKey, Rater } from "@/lib/tennis/constants";
import { toast } from "sonner";

interface UpdateRatingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latestByRater: Record<string, Record<string, number | string>>;
  stageBaseRatings?: Record<string, number>;
}

interface SessionOption {
  id: string;
  type: string;
  date: string;
}

function StrokeRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          onClick={() => onChange(Math.max(1.0, value - 0.5))}
          disabled={value <= 1.0}
        >
          <Minus className="w-3.5 h-3.5" />
        </Button>
        <span className="w-10 text-center text-base font-semibold tabular-nums">
          {value.toFixed(1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          onClick={() => onChange(Math.min(10.0, value + 0.5))}
          disabled={value >= 10.0}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function UpdateRatingsDialog({
  open,
  onOpenChange,
  latestByRater,
  stageBaseRatings,
}: UpdateRatingsDialogProps) {
  const queryClient = useQueryClient();
  const [ratedBy, setRatedBy] = useState("self");
  const [customCoach, setCustomCoach] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [raters, setRaters] = useState<Rater[]>(() => getCustomRaters());

  // Manage raters inline mode
  const [managing, setManaging] = useState(false);
  const [editRaters, setEditRaters] = useState<Rater[]>([]);
  const [newRaterName, setNewRaterName] = useState("");

  const startManaging = () => {
    setEditRaters(raters.map((r) => ({ ...r })));
    setNewRaterName("");
    setManaging(true);
  };

  const handleEditLabel = (index: number, label: string) => {
    setEditRaters((prev) => {
      const updated = [...prev];
      updated[index] = { key: updated[index]!.key, label };
      return updated;
    });
  };

  const handleDeleteRater = (index: number) => {
    if (editRaters.length <= 1) {
      toast.error("Need at least one rater");
      return;
    }
    setEditRaters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRater = () => {
    const name = newRaterName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, "-");
    if (editRaters.some((r) => r.key === key)) {
      toast.error("Rater already exists");
      return;
    }
    setEditRaters((prev) => [...prev, { key, label: name }]);
    setNewRaterName("");
  };

  const saveRaters = () => {
    const valid = editRaters.filter((r) => r.label.trim());
    if (valid.length === 0) {
      toast.error("Need at least one rater");
      return;
    }
    const cleaned = valid.map((r) => ({ key: r.key, label: r.label.trim() }));
    saveCustomRaters(cleaned);
    setRaters(cleaned);
    // If current ratedBy was removed, reset to first
    if (ratedBy !== "coach" && !cleaned.some((r) => r.key === ratedBy)) {
      const first = cleaned[0]?.key || "self";
      setRatedBy(first);
      setRatings(getInitialRatings(first));
    }
    setManaging(false);
    toast.success("Raters updated");
  };

  // Initialize ratings from rater's latest or stage base
  const getInitialRatings = (rater: string): Record<StrokeKey, number> => {
    const raterKey = rater === "coach" ? `coach:${customCoach}` : rater;
    const existing = latestByRater[raterKey];
    const base = stageBaseRatings || {};
    const ratings = {} as Record<StrokeKey, number>;
    for (const s of STROKES) {
      ratings[s.key] = (existing?.[s.key] as number) || (base[s.key] as number) || 5.0;
    }
    return ratings;
  };

  const [ratings, setRatings] = useState<Record<StrokeKey, number>>(
    getInitialRatings("self")
  );

  const handleRaterChange = (newRater: string) => {
    setRatedBy(newRater);
    if (newRater !== "coach") {
      setRatings(getInitialRatings(newRater));
    }
  };

  // Fetch recent sessions
  const { data: sessions } = useQuery({
    queryKey: ["tennis-sessions-recent"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/sessions?limit=10");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as SessionOption[];
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const effectiveRater =
        ratedBy === "coach" ? `coach:${customCoach}` : ratedBy;
      const body = {
        ratedBy: effectiveRater,
        ...ratings,
        notes: notes || null,
        sessionId: sessionId || null,
      };
      const res = await fetch("/api/tennis/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save ratings");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tennis-stage"] });
      queryClient.invalidateQueries({ queryKey: ["tennis-ratings-history"] });
      onOpenChange(false);
      setNotes("");
      setSessionId(null);
      setManaging(false);

      if (data.advanceAvailable) {
        toast.success(
          "All strokes at 9.0+! You can advance to the next stage."
        );
      } else {
        toast.success("Ratings updated");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    },
  });

  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen) setManaging(false);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {managing ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1"
                  onClick={() => setManaging(false)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <DialogTitle>Manage Raters</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              {editRaters.map((rater, i) => (
                <div key={rater.key} className="flex items-center gap-2">
                  <Input
                    value={rater.label}
                    onChange={(e) => handleEditLabel(i, e.target.value)}
                    className="text-base sm:text-sm"
                    placeholder="Name"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteRater(i)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                <Input
                  value={newRaterName}
                  onChange={(e) => setNewRaterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRater();
                    }
                  }}
                  className="text-base sm:text-sm"
                  placeholder="Add new rater..."
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleAddRater}
                  disabled={!newRaterName.trim()}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setManaging(false)}>
                Cancel
              </Button>
              <Button onClick={saveRaters}>Save</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Update Ratings</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Rater selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Rating as</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={startManaging}
                  >
                    <Settings2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                </div>
                <Select value={ratedBy} onValueChange={handleRaterChange}>
                  <SelectTrigger className="text-base sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {raters.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="coach">Coach...</SelectItem>
                  </SelectContent>
                </Select>
                {ratedBy === "coach" && (
                  <Input
                    placeholder="Coach name"
                    value={customCoach}
                    onChange={(e) => setCustomCoach(e.target.value)}
                    className="text-base sm:text-sm"
                  />
                )}
              </div>

              {/* Stroke ratings */}
              <div className="divide-y divide-border/50">
                {STROKES.map((stroke) => (
                  <StrokeRatingInput
                    key={stroke.key}
                    label={stroke.label}
                    value={ratings[stroke.key]}
                    onChange={(v) =>
                      setRatings((prev) => ({ ...prev, [stroke.key]: v }))
                    }
                  />
                ))}
              </div>

              {/* Session link */}
              {sessions && sessions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Link to session (optional)
                  </label>
                  <Select
                    value={sessionId ?? "none"}
                    onValueChange={(v) =>
                      setSessionId(v === "none" ? null : v)
                    }
                  >
                    <SelectTrigger className="text-base sm:text-sm">
                      <SelectValue placeholder="Select session..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.type} —{" "}
                          {new Date(s.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="After practice session with..."
                  rows={2}
                  className="text-base sm:text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    saveMutation.isPending ||
                    (ratedBy === "coach" && !customCoach.trim())
                  }
                >
                  {saveMutation.isPending ? "Saving..." : "Save Ratings"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
