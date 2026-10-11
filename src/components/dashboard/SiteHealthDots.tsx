"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { SiteHealth } from "@/types/site";

export function SiteHealthDots() {
  const { data: sites = [] } = useQuery<SiteHealth[]>({
    queryKey: ["sites-health"],
    queryFn: async () => {
      const res = await fetch("/api/sites/health");
      const json = (await res.json()) as { data?: SiteHealth[]; error?: string };
      if (json.error) return [];
      return json.data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (sites.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Link
        href="/dashboard/sites"
        className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground/80"
      >
        Sites
      </Link>
      <div className="space-y-1.5">
        {sites.map((site) => (
          <a
            key={site.url}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent/30"
          >
            <div
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                site.status === "up"
                  ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                  : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]"
              )}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">
              {site.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
