"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BellRing, ArrowRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import type { JobApplication } from "@/generated/prisma/client";

export function JobFollowups() {
  const { data: jobs = [] } = useQuery<JobApplication[]>({
    queryKey: ["jobs-followups"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/followups");
      const json = (await res.json()) as { data: JobApplication[] };
      return json.data;
    },
    staleTime: 60_000,
  });

  if (jobs.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <BellRing className="h-4 w-4 text-amber-500" />
          </div>
          Follow Up
        </CardTitle>
        <Link
          href="/dashboard/jobs"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {jobs.slice(0, 5).map((job) => {
            const daysSince = differenceInDays(
              new Date(),
              new Date(job.updatedAt)
            );
            const hasFollowUp = !!job.followUpDate;
            const followUpPast =
              hasFollowUp && new Date(job.followUpDate!) <= new Date();

            return (
              <Link
                key={job.id}
                href="/dashboard/jobs"
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-4 py-3 transition-all hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {job.company}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {job.title}
                    </span>
                    {hasFollowUp && (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          followUpPast ? "text-red-400" : "text-muted-foreground"
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        {format(new Date(job.followUpDate!), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[11px]",
                    daysSince >= 21
                      ? "bg-red-900/50 text-red-300"
                      : "bg-amber-900/50 text-amber-300"
                  )}
                >
                  {daysSince}d ago
                </Badge>
              </Link>
            );
          })}
          {jobs.length > 5 && (
            <p className="text-center text-xs text-muted-foreground">
              +{jobs.length - 5} more
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
