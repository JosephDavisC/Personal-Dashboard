"use client";

import { TENNIS_STAGES } from "@/lib/tennis/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

interface StageBadgeProps {
  stageNumber: number;
  stageLabel: string;
  utrRange: string;
  strokesAtThreshold: number;
  totalStrokes: number;
  canAdvance: boolean;
  onAdvance: () => void;
  isAdvancing?: boolean;
}

export function StageBadge({
  stageNumber,
  stageLabel,
  utrRange,
  strokesAtThreshold,
  totalStrokes,
  canAdvance,
  onAdvance,
  isAdvancing,
}: StageBadgeProps) {
  const stageConfig = TENNIS_STAGES[stageNumber - 1];
  const progress = totalStrokes > 0 ? (strokesAtThreshold / totalStrokes) * 100 : 0;
  const nextStage = TENNIS_STAGES[stageNumber];

  return (
    <div
      className={cn(
        "rounded-xl border p-6 text-center space-y-4",
        stageConfig?.bgColor,
        stageConfig?.borderColor
      )}
    >
      <div>
        <div className={cn("text-4xl font-bold", stageConfig?.color)}>
          {stageNumber}
        </div>
        <div className={cn("text-lg font-semibold mt-1", stageConfig?.color)}>
          {stageLabel}
        </div>
        <div className="text-sm text-muted-foreground">UTR {utrRange}</div>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm text-muted-foreground">
          {strokesAtThreshold}/{totalStrokes} strokes at 9.0+ to advance
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              canAdvance ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        {nextStage && (
          <div className="text-xs text-muted-foreground">
            Stage {stageNumber} → Stage {stageNumber + 1}
          </div>
        )}
      </div>

      {canAdvance && nextStage && (
        <Button
          onClick={onAdvance}
          disabled={isAdvancing}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Trophy className="w-4 h-4 mr-2" />
          {isAdvancing ? "Advancing..." : `Advance to ${nextStage.label}!`}
        </Button>
      )}
    </div>
  );
}
