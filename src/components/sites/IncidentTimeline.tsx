"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";

interface Incident {
  id: string;
  siteName: string;
  title: string;
  startedAt: string;
  resolvedAt: string | null;
  duration: number | null;
  isOngoing: boolean;
}

interface IncidentTimelineProps {
  incidents: Incident[];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

export function IncidentTimeline({ incidents }: IncidentTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? incidents : incidents.slice(0, 20);
  const hasMore = incidents.length > 20 && !showAll;

  if (incidents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
          Incident History
        </p>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <PartyPopper className="h-6 w-6 text-emerald-500/60" />
          <p className="text-sm text-muted-foreground">
            All clear for the last 90 days
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Incident History
      </p>
      <div className="space-y-3">
        {displayed.map((inc) => (
          <div key={inc.id} className="flex items-start gap-3">
            {inc.isOngoing ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 animate-pulse" />
            ) : (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {inc.title}
                </p>
                <Badge
                  variant="outline"
                  className={
                    inc.isOngoing
                      ? "border-red-500/30 bg-red-500/10 text-red-400 text-[10px]"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
                  }
                >
                  {inc.isOngoing ? "Ongoing" : "Resolved"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {inc.isOngoing ? (
                  <>Started {formatDistanceToNow(new Date(inc.startedAt), { addSuffix: true })}</>
                ) : (
                  <>
                    {format(new Date(inc.startedAt), "MMM d, h:mm a")}
                    {inc.duration !== null && (
                      <> &middot; Duration: {formatDuration(inc.duration)}</>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          Show all {incidents.length} incidents
        </Button>
      )}
    </div>
  );
}
