"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface BackupEntry {
  id: string;
  type: string;
  size: number;
  createdAt: string;
}

interface DriveBackup {
  name: string;
  createdTime: string;
}

const STALE_HOURS = 48;
const CRITICAL_HOURS = 168;

function getStatus(dateStr: string | null): "ok" | "stale" | "critical" | "none" {
  if (!dateStr) return "none";
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (hours > CRITICAL_HOURS) return "critical";
  if (hours > STALE_HOURS) return "stale";
  return "ok";
}

function StatusDot({ status }: { status: "ok" | "stale" | "critical" | "none" }) {
  return (
    <div
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "ok" && "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]",
        status === "stale" && "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.4)]",
        status === "critical" && "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]",
        status === "none" && "bg-zinc-500"
      )}
    />
  );
}

export function BackupStatusCard() {
  const { data: lastSnapshot } = useQuery<string | null>({
    queryKey: ["backup-status-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/backup");
      const json = (await res.json()) as { data: BackupEntry[] };
      const backups = json.data ?? [];
      return backups.length > 0 ? backups[0]!.createdAt : null;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: lastDrive } = useQuery<string | null>({
    queryKey: ["backup-status-drive"],
    queryFn: async () => {
      const res = await fetch("/api/backup/drive/last");
      const json = (await res.json()) as { data: DriveBackup | null };
      return json.data?.createdTime ?? null;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  const snapshotStatus = getStatus(lastSnapshot ?? null);
  const driveStatus = getStatus(lastDrive ?? null);
  const worstStatus = [snapshotStatus, driveStatus].includes("critical")
    ? "critical"
    : [snapshotStatus, driveStatus].includes("stale")
      ? "stale"
      : [snapshotStatus, driveStatus].includes("none")
        ? "none"
        : "ok";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Link
        href="/dashboard/backup"
        className="mb-2.5 flex items-center justify-between"
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground/80">
          Backups
        </span>
        {(worstStatus === "stale" || worstStatus === "critical") && (
          <AlertTriangle
            className={cn(
              "h-3.5 w-3.5",
              worstStatus === "critical" ? "text-red-500" : "text-amber-500"
            )}
          />
        )}
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusDot status={snapshotStatus} />
          <span className="text-xs font-medium text-muted-foreground">DB Snapshot</span>
          <span className="ml-auto min-w-0 truncate text-xs text-foreground/70">
            {lastSnapshot
              ? formatDistanceToNow(new Date(lastSnapshot), { addSuffix: true })
              : "None"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StatusDot status={driveStatus} />
          <span className="text-xs font-medium text-muted-foreground">Google Drive</span>
          <span className="ml-auto min-w-0 truncate text-xs text-foreground/70">
            {lastDrive
              ? formatDistanceToNow(new Date(lastDrive), { addSuffix: true })
              : "None"}
          </span>
        </div>
      </div>
    </div>
  );
}
