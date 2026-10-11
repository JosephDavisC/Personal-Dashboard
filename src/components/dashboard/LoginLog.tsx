"use client";

import { useQuery } from "@tanstack/react-query";
import { Shield, ShieldX } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface LoginEntry {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  success: boolean;
  ip: string | null;
  createdAt: string;
}

export function LoginLog() {
  const { data: logs = [] } = useQuery<LoginEntry[]>({
    queryKey: ["login-logs"],
    queryFn: async () => {
      const res = await fetch("/api/auth/logs");
      const json = (await res.json()) as { data?: LoginEntry[]; error?: string };
      if (json.error) return [];
      return json.data ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <Shield className="h-3.5 w-3.5" />
        Login Activity
      </div>
      <div className="space-y-1">
        {logs.map((log) => {
          const timeAgo = formatDistanceToNowStrict(new Date(log.createdAt), { addSuffix: true });

          return (
            <div
              key={log.id}
              className="flex items-center gap-2 rounded-md px-1 py-1"
            >
              {log.success ? (
                <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
              ) : (
                <ShieldX className="h-3 w-3 shrink-0 text-red-400" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
                {log.email}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                {timeAgo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
