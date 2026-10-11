"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBanner } from "./StatusBanner";
import { SiteScreenshots } from "./SiteScreenshots";
import { SiteDetailCard } from "./SiteDetailCard";
import { ResponseTimeChart } from "./ResponseTimeChart";
import { IncidentTimeline } from "./IncidentTimeline";
import { OverallStats } from "./OverallStats";
import { SiteForm, type SiteFormData } from "./SiteForm";
import type { DayData } from "./UptimeBar";

interface MonitoredSiteData {
  id: string;
  label: string;
  url: string;
  order: number;
  isUp: boolean | null;
  status: number | null;
  responseTime: number | null;
  lastChecked: string | null;
  uptime90d: number | null;
}

interface IncidentData {
  id: string;
  siteId: string;
  siteName: string;
  title: string;
  startedAt: string;
  resolvedAt: string | null;
  duration: number | null;
  isOngoing: boolean;
}

export function SitesMonitor() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<{ id: string; label: string; url: string } | null>(null);
  const [managing, setManaging] = useState(false);

  // Monitored sites with current status + uptime
  const { data: sites = [], isLoading: sitesLoading } = useQuery<
    MonitoredSiteData[]
  >({
    queryKey: ["monitored-sites"],
    queryFn: async () => {
      const res = await fetch("/api/sites/monitored");
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: MonitoredSiteData[] };
      return json.data ?? [];
    },
    refetchInterval: 30_000,
  });

  // Daily history for each site (90-day uptime bars)
  const { data: histories = {} } = useQuery<
    Record<string, (DayData | null)[]>
  >({
    queryKey: ["site-histories", sites.map((s) => s.id).join(",")],
    queryFn: async () => {
      const result: Record<string, (DayData | null)[]> = {};
      for (const site of sites) {
        const res = await fetch(`/api/sites/${site.id}/history?days=90`);
        if (!res.ok) continue;
        const json = (await res.json()) as { data?: DayData[] };
        result[site.id] = padDailyHistory(json.data ?? []);
      }
      return result;
    },
    enabled: sites.length > 0,
    refetchInterval: 300_000,
  });

  // Response times for sparklines (last 24h)
  const { data: responseTimes = {} } = useQuery<
    Record<string, { time: string; responseTime: number }[]>
  >({
    queryKey: ["site-response-times", sites.map((s) => s.id).join(",")],
    queryFn: async () => {
      const result: Record<
        string,
        { time: string; responseTime: number }[]
      > = {};
      for (const site of sites) {
        const res = await fetch(
          `/api/sites/${site.id}/response-times?hours=24`
        );
        if (!res.ok) continue;
        const json = (await res.json()) as {
          data?: { time: string; responseTime: number }[];
        };
        result[site.id] = json.data ?? [];
      }
      return result;
    },
    enabled: sites.length > 0,
    refetchInterval: 60_000,
  });

  // Incidents
  const { data: incidents = [] } = useQuery<IncidentData[]>({
    queryKey: ["site-incidents"],
    queryFn: async () => {
      const res = await fetch("/api/sites/incidents?days=90");
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: IncidentData[] };
      return json.data ?? [];
    },
    refetchInterval: 60_000,
  });

  // Check now mutation
  const checkNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sites/check-now", { method: "POST" });
      return (await res.json()) as { data: { checked: number } };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["monitored-sites"] });
      queryClient.invalidateQueries({ queryKey: ["site-response-times"] });
      queryClient.invalidateQueries({ queryKey: ["site-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["sites-health"] });
      toast.success(`Checked ${result.data.checked} sites`);
    },
    onError: () => toast.error("Failed to check sites"),
  });

  // CRUD mutations
  const createMutation = useMutation({
    mutationFn: async (data: SiteFormData) => {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return (await res.json()) as { data: unknown };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["monitored-sites"] });
      toast.success("Site added");
    },
    onError: () => toast.error("Failed to add site"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SiteFormData }) => {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return (await res.json()) as { data: unknown };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["monitored-sites"] });
      toast.success("Site updated");
    },
    onError: () => toast.error("Failed to update site"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/sites/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["monitored-sites"] });
      toast.success("Site removed");
    },
    onError: () => toast.error("Failed to remove site"),
  });

  function handleSubmit(data: SiteFormData) {
    if (editingSite) {
      updateMutation.mutate({ id: editingSite.id, data });
    } else {
      createMutation.mutate(data);
    }
    setEditingSite(null);
  }

  const downCount = sites.filter((s) => s.isUp === false).length;
  const allUp = sites.length > 0 && downCount === 0;
  const hasData = sites.some((s) => s.lastChecked !== null);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => checkNowMutation.mutate()}
          disabled={checkNowMutation.isPending}
        >
          <RefreshCw
            className={cn(
              "mr-1.5 h-3.5 w-3.5",
              checkNowMutation.isPending && "animate-spin"
            )}
          />
          Check Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setManaging(!managing)}
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          {managing ? "Done" : "Manage"}
        </Button>
        {managing && (
          <Button
            size="sm"
            onClick={() => {
              setEditingSite(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Site
          </Button>
        )}
      </div>

      {/* Status Banner */}
      <StatusBanner
        health={sites.map((s) => ({
          url: s.url,
          label: s.label,
          status: s.isUp === null ? ("error" as const) : s.isUp ? ("up" as const) : ("down" as const),
          checkedAt: s.lastChecked ?? new Date().toISOString(),
        }))}
        isLoading={sitesLoading && !hasData}
      />

      {/* Screenshots Grid */}
      <SiteScreenshots
        sites={sites.map((s) => ({
          id: s.id,
          label: s.label,
          url: s.url,
          isUp: s.isUp,
          responseTime: s.responseTime,
        }))}
        managing={managing}
        onSiteClick={(id) => {
          document
            .getElementById(`site-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onEdit={(id) => {
          const site = sites.find((s) => s.id === id);
          if (site) {
            setEditingSite({ id: site.id, label: site.label, url: site.url });
            setFormOpen(true);
          }
        }}
        onDelete={(id) => {
          deleteMutation.mutate(id);
        }}
      />

      {/* Detailed Status Cards */}
      {sites.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
              Detailed Status
            </h2>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <div className="space-y-2">
            {sites.map((site) => (
              <SiteDetailCard
                key={site.id}
                id={site.id}
                label={site.label}
                url={site.url}
                isUp={site.isUp}
                responseTime={site.responseTime}
                uptime90d={site.uptime90d}
                dailyHistory={histories[site.id] ?? padDailyHistory([])}
                responseTimes={responseTimes[site.id] ?? []}
              />
            ))}
          </div>
        </div>
      )}

      {/* Response Time Chart */}
      <ResponseTimeChart
        sites={sites.map((site) => ({
          id: site.id,
          label: site.label,
          data: responseTimes[site.id] ?? [],
        }))}
      />

      {/* Incident Timeline */}
      <IncidentTimeline incidents={incidents} />

      {/* Overall Stats */}
      {sites.length > 0 && (
        <OverallStats sites={sites} siteCount={sites.length} />
      )}

      {/* Edit/Add Form */}
      <SiteForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        site={editingSite}
      />
    </div>
  );
}

/** Pad daily history to exactly 90 entries (null for missing days) */
function padDailyHistory(data: DayData[]): (DayData | null)[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result: (DayData | null)[] = [];
  const today = new Date();

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0] ?? "";
    result.push(map.get(key) ?? null);
  }

  return result;
}
