"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { StageBadge } from "./StageBadge";
import { RaterFilter } from "./RaterFilter";
import { StrokeRadarChart } from "./StrokeRadarChart";
import { StrokeBreakdown } from "./StrokeBreakdown";
import { UpdateRatingsDialog } from "./UpdateRatingsDialog";
import { RatingHistoryChart } from "./RatingHistoryChart";
import { RatingLog } from "./RatingLog";

interface StageData {
  stage: {
    id: string;
    stageNumber: number;
    stageLabel: string;
    utrRange: string;
    startedAt: string;
  };
  latestByRater: Record<string, Record<string, number | string>>;
  lastRated: Record<string, string>;
  averageRatings: Record<string, number>;
  canAdvance: boolean;
  strokesAtThreshold: number;
  totalStrokes: number;
}

export function ProgressTab() {
  const queryClient = useQueryClient();
  const [raterFilter, setRaterFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tennis-stage"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/ratings/stage");
      if (!res.ok) throw new Error("Failed to fetch stage");
      return res.json() as Promise<StageData>;
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tennis/ratings/stage/advance", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to advance");
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tennis-stage"] });
      queryClient.invalidateQueries({ queryKey: ["tennis-ratings-history"] });
      toast.success(
        `Stage Complete! You graduated from ${result.previousStage.stageLabel} to ${result.newStage.stageLabel}!`
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to advance");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="h-60 animate-pulse bg-card" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="h-80 animate-pulse bg-card" />
          <Card className="h-80 animate-pulse bg-card" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    stage,
    latestByRater,
    averageRatings,
    canAdvance,
    strokesAtThreshold,
    totalStrokes,
  } = data;

  const hasRatings = Object.keys(latestByRater).length > 0;
  const raters = Object.keys(latestByRater);

  return (
    <div className="space-y-6">
      {/* Stage Badge */}
      <StageBadge
        stageNumber={stage.stageNumber}
        stageLabel={stage.stageLabel}
        utrRange={stage.utrRange}
        strokesAtThreshold={strokesAtThreshold}
        totalStrokes={totalStrokes}
        canAdvance={canAdvance}
        onAdvance={() => advanceMutation.mutate()}
        isAdvancing={advanceMutation.isPending}
      />

      {hasRatings ? (
        <>
          {/* Rater filter */}
          <RaterFilter
            raters={raters}
            activeRater={raterFilter}
            onChange={setRaterFilter}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Radar Chart */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-semibold">
                  Stroke Ratings
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Update
                </Button>
              </div>
              <StrokeRadarChart
                averageRatings={averageRatings}
                latestByRater={latestByRater}
                raterFilter={raterFilter}
              />
            </Card>

            {/* Stroke Breakdown */}
            <Card className="p-4">
              <h3 className="font-heading text-lg font-semibold mb-4">
                Stroke Breakdown
              </h3>
              <StrokeBreakdown
                averageRatings={averageRatings}
                latestByRater={latestByRater}
                raterFilter={raterFilter}
              />
            </Card>
          </div>

          {/* History Chart */}
          <RatingHistoryChart raterFilter={raterFilter} />

          {/* Rating Log */}
          <RatingLog />
        </>
      ) : (
        /* Empty state */
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Target className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">
                Rate your strokes to track your progress
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                and work toward the next stage.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Rate My Strokes
            </Button>
            <div className="text-sm text-muted-foreground space-y-1 pt-2">
              <p>How it works:</p>
              <ul className="text-left space-y-0.5 list-disc list-inside">
                <li>Rate each stroke 1.0 to 10.0</li>
                <li>Get rated by coaches, family, or Claude</li>
                <li>When all strokes hit 9.0+, advance a stage</li>
                <li>6 stages from Beginner to Competitive</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Update Ratings Dialog */}
      <UpdateRatingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        latestByRater={latestByRater}
      />
    </div>
  );
}
