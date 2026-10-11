"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STROKES, getRaterLabel as getLabel } from "@/lib/tennis/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface RatingEntry {
  id: string;
  date: string;
  ratedBy: string;
  forehand: number;
  bhTopspin: number;
  bhSlice: number;
  serve: number;
  volley: number;
  overhead: number;
  returnOf: number;
  notes: string | null;
  session: { id: string; type: string; date: string } | null;
}

function getRaterLabel(rater: string): string {
  if (rater === "self") return "You";
  return getLabel(rater);
}

export function RatingLog() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["tennis-ratings-history", "all", "current"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/ratings/history?currentOnly=true");
      if (!res.ok) return { history: [] };
      return res.json() as Promise<{ history: RatingEntry[] }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tennis/ratings/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-stage"] });
      queryClient.invalidateQueries({ queryKey: ["tennis-ratings-history"] });
      toast.success("Rating deleted");
    },
  });

  const ratings = data?.history
    ? [...data.history].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    : [];

  if (ratings.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-heading text-lg font-semibold">Rating Log</h3>
      <div className="space-y-3">
        {ratings.map((rating) => (
          <div
            key={rating.id}
            className="rounded-lg border bg-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {new Date(rating.date + "T12:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric" }
                  )}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getRaterLabel(rating.ratedBy)}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(rating.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {STROKES.map((stroke) => (
                <span key={stroke.key} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {stroke.shortLabel}
                  </span>
                  : {(rating[stroke.key] as number).toFixed(1)}
                </span>
              ))}
            </div>

            {rating.notes && (
              <p className="text-xs text-muted-foreground italic">
                &ldquo;{rating.notes}&rdquo;
              </p>
            )}

            {rating.session && (
              <p className="text-xs text-muted-foreground">
                Linked to {rating.session.type} on{" "}
                {new Date(rating.session.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
