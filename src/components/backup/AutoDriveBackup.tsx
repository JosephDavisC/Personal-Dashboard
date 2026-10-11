"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface BackupEntry {
  id: string;
  type: string;
  createdAt: string;
}

async function checkSnapshotStaleness() {
  try {
    const res = await fetch("/api/backup");
    const json = (await res.json()) as { data: BackupEntry[] };
    const backups = json.data ?? [];
    if (backups.length === 0) {
      toast.warning("No database snapshots found", {
        description: "Go to Backup to create one, or set up the cron job.",
        duration: 10_000,
      });
      return;
    }
    const lastTime = new Date(backups[0]!.createdAt).getTime();
    const age = Date.now() - lastTime;
    if (age > SEVEN_DAYS_MS) {
      toast.warning("Database snapshot is over 7 days old", {
        description: "The backup cron may have stopped. Check your cron scheduler.",
        duration: 10_000,
      });
    }
  } catch {
    // silently ignore — don't block dashboard load
  }
}

export function AutoDriveBackup() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Check if DB snapshots are stale (cron may have stopped)
    checkSnapshotStaleness();

    (async () => {
      // Check server for last Drive backup time
      try {
        const res = await fetch("/api/backup/drive/last");
        if (res.ok) {
          const json = (await res.json()) as { data: { createdTime: string } | null };
          if (json.data) {
            const lastTime = new Date(json.data.createdTime).getTime();
            if (Date.now() - lastTime < TWO_DAYS_MS) return;
          }
        }
      } catch {
        // If check fails, skip auto-backup rather than risking duplicates
        return;
      }

      // Small delay so dashboard finishes loading first
      await new Promise((r) => setTimeout(r, 5000));

      const toastId = toast.loading("Starting scheduled Drive backup...");

      try {
        const res = await fetch("/api/backup/drive/full", { method: "POST" });
        if (!res.ok || !res.body) throw new Error("Backup request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let lastEvent: { type?: string; current?: number; total?: number; uploaded?: number; message?: string } = {};

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              lastEvent = JSON.parse(line);
            } catch {
              continue;
            }

            if (lastEvent.type === "progress" && lastEvent.total && lastEvent.total > 0) {
              toast.loading(
                `Drive backup: ${lastEvent.current ?? 0}/${lastEvent.total} files...`,
                { id: toastId }
              );
            }
          }
        }

        if (lastEvent.type === "complete") {
          toast.success(`Drive backup complete — ${lastEvent.uploaded ?? 0} files uploaded`, {
            id: toastId,
          });
        } else if (lastEvent.type === "error") {
          toast.error(`Drive backup failed: ${lastEvent.message ?? "Unknown error"}`, {
            id: toastId,
          });
        }
      } catch {
        toast.error("Drive backup failed", { id: toastId });
      }
    })();
  }, []);

  return null;
}
