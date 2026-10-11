"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Share2,
  CloudUpload,
  CalendarRange,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { useState } from "react";

interface EmailLogEntry {
  id: string;
  type: string;
  to: string;
  subject: string;
  preview: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface HistoryResponse {
  data: EmailLogEntry[];
  nextCursor: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  media_share: { label: "Media Share", icon: <Share2 className="h-4 w-4" />, color: "text-violet-400" },
  backup_complete: { label: "Backup", icon: <CloudUpload className="h-4 w-4" />, color: "text-sky-400" },
  weekly_summary: { label: "Weekly Summary", icon: <CalendarRange className="h-4 w-4" />, color: "text-blue-400" },
};

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "media_share", label: "Media Share" },
  { value: "backup_complete", label: "Backup" },
  { value: "weekly_summary", label: "Weekly Summary" },
];

export function EmailHistory() {
  const [filter, setFilter] = useState("");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["email-history", filter],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        if (filter) params.set("type", filter);
        if (pageParam) params.set("cursor", pageParam as string);
        params.set("limit", "30");
        const res = await fetch(`/api/email/history?${params}`);
        return res.json() as Promise<HistoryResponse>;
      },
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
    });

  const emails = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : emails.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No emails sent yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => {
            const config = TYPE_CONFIG[email.type] ?? {
              label: email.type,
              icon: <Mail className="h-4 w-4" />,
              color: "text-muted-foreground",
            };
            return (
              <Card key={email.id} className="border-border bg-card">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={`mt-0.5 shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatInTimeZone(new Date(email.createdAt), TIMEZONE, "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{email.subject}</p>
                    {email.preview && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {email.preview}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      To: {email.to}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
