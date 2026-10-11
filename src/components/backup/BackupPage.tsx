"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  CheckSquare,
  Clock,
  Briefcase,
  Link2,
  HardDrive,
  Loader2,
  PackageOpen,
  Database,
  Trash2,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Globe,
  LogIn,
  BookHeart,
  CloudUpload,
  FolderUp,
  CheckCircle2,
  XCircle,
  Mail,
  Bell,
  Users,
  Pin,
  RefreshCw,
  Copy,
  CircleDot,
} from "lucide-react";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { format, formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { toast } from "sonner";

interface BackupEntry {
  id: string;
  type: string;
  size: number;
  createdAt: string;
}

interface ExportConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  headers: string[];
  endpoint?: string;
  toRow?: (item: Record<string, unknown>) => string[];
  customExport?: () => Promise<number>;
}

const allExports: ExportConfig[] = [
  {
    key: "tasks",
    label: "Tasks",
    icon: <CheckSquare className="h-5 w-5" />,
    endpoint: "/api/tasks",
    headers: ["Title", "Description", "Status", "Priority", "Due Date", "Category", "Photos", "Created"],
    toRow: (t) => [
      String(t.title ?? ""),
      String(t.description ?? ""),
      String(t.status ?? ""),
      String(t.priority ?? ""),
      t.dueDate ? format(new Date(t.dueDate as string), "yyyy-MM-dd") : "",
      String(t.category ?? ""),
      String(Array.isArray(t.photos) ? t.photos.length : 0),
      t.createdAt ? format(new Date(t.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "shifts",
    label: "Shifts",
    icon: <Clock className="h-5 w-5" />,
    endpoint: "/api/shifts",
    headers: ["Date", "Day", "Start", "End", "Location", "Label", "Hours", "Gross Pay", "Net Pay", "Notes"],
    toRow: (s) => {
      const d = new Date(s.date as string);
      return [
        formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd"),
        formatInTimeZone(d, TIMEZONE, "EEE"),
        s.startTime ? formatInTimeZone(new Date(s.startTime as string), TIMEZONE, "HH:mm") : "",
        s.endTime ? formatInTimeZone(new Date(s.endTime as string), TIMEZONE, "HH:mm") : "",
        String(s.location ?? ""),
        String(s.label ?? ""),
        String(s.hours ?? ""),
        `$${Number(s.grossPay ?? 0).toFixed(2)}`,
        `$${Number(s.netPay ?? 0).toFixed(2)}`,
        String(s.notes ?? ""),
      ];
    },
  },
  {
    key: "jobs",
    label: "Applications",
    icon: <Briefcase className="h-5 w-5" />,
    endpoint: "/api/jobs",
    headers: [
      "#",
      "Title",
      "Company",
      "Status",
      "Date Applied",
      "Next Steps",
      "Salary",
      "Location",
      "URL",
      "Assessment Type",
      "Assessment Notes",
      "Notes",
    ],
    toRow: (j) => [
      String(j.order ?? ""),
      String(j.title ?? ""),
      String(j.company ?? ""),
      String(j.status ?? ""),
      j.dateApplied ? format(new Date(j.dateApplied as string), "yyyy-MM-dd") : "",
      String(j.nextSteps ?? ""),
      String(j.salary ?? ""),
      String(j.location ?? ""),
      String(j.jobUrl ?? ""),
      String(j.assessmentType ?? "NONE"),
      String(j.assessmentNotes ?? ""),
      String(j.notes ?? ""),
    ],
  },
  {
    key: "media",
    label: "Media Files",
    icon: <HardDrive className="h-5 w-5" />,
    endpoint: "/api/media",
    headers: ["Filename", "Title", "Type", "Size", "Tags", "Public", "Views", "Downloads", "Share Slug", "Created"],
    toRow: (m) => [
      String(m.filename ?? ""),
      String(m.title ?? ""),
      String(m.mimeType ?? ""),
      String(m.size ?? ""),
      Array.isArray(m.tags) ? (m.tags as string[]).join("; ") : "",
      m.isPublic ? "Yes" : "No",
      String(m.views ?? 0),
      String(m.downloads ?? 0),
      String(m.shareSlug ?? ""),
      m.createdAt ? format(new Date(m.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "links",
    label: "Links",
    icon: <Link2 className="h-5 w-5" />,
    endpoint: "/api/links",
    headers: ["Label", "URL", "Icon", "Order"],
    toRow: (l) => [
      String(l.label ?? ""),
      String(l.url ?? ""),
      String(l.icon ?? ""),
      String(l.order ?? ""),
    ],
  },
  {
    key: "sites",
    label: "Monitored Sites",
    icon: <Globe className="h-5 w-5" />,
    endpoint: "/api/sites",
    headers: ["Label", "URL", "Active", "Order", "Created"],
    toRow: (s) => [
      String(s.label ?? ""),
      String(s.url ?? ""),
      s.active === false ? "No" : "Yes",
      String(s.order ?? ""),
      s.createdAt ? format(new Date(s.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "diary",
    label: "Diary Entries",
    icon: <BookHeart className="h-5 w-5" />,
    endpoint: "/api/diary",
    headers: ["Date", "Mood", "Tags", "Content", "Media"],
    customExport: async () => {
      const date = format(new Date(), "yyyy-MM-dd");
      let allEntries: Record<string, unknown>[] = [];
      let cursor: string | undefined;
      for (;;) {
        const url = `/api/diary?limit=50${cursor ? `&cursor=${cursor}` : ""}`;
        const res = await fetch(url);
        const json = (await res.json()) as { entries: Record<string, unknown>[]; nextCursor?: string };
        allEntries = allEntries.concat(json.entries ?? []);
        if (!json.nextCursor) break;
        cursor = json.nextCursor;
      }
      const rows = allEntries.map((e) => [
        e.date ? formatInTimeZone(new Date(e.date as string), TIMEZONE, "yyyy-MM-dd") : "",
        String(e.mood ?? ""),
        Array.isArray(e.tags) ? (e.tags as string[]).join("; ") : "",
        String(e.content ?? ""),
        String(Array.isArray(e.photos) ? (e.photos as unknown[]).length : 0),
      ]);
      const csv = toCSV(["Date", "Mood", "Tags", "Content", "Media"], rows);
      downloadCSV(`diary-${date}.csv`, csv);
      return allEntries.length;
    },
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: <Users className="h-5 w-5" />,
    endpoint: "/api/contacts-db",
    headers: ["Name", "Email", "Phone", "Company", "Title", "Tags", "Notes", "Photo", "Google ID", "Last Synced", "Created"],
    toRow: (c) => [
      String(c.name ?? ""),
      String(c.email ?? ""),
      String(c.phone ?? ""),
      String(c.company ?? ""),
      String(c.title ?? ""),
      Array.isArray(c.tags) ? (c.tags as string[]).join("; ") : "",
      String(c.notes ?? ""),
      String(c.photoUrl ?? ""),
      String(c.googleContactId ?? ""),
      c.lastSyncedAt ? format(new Date(c.lastSyncedAt as string), "yyyy-MM-dd HH:mm") : "",
      c.createdAt ? format(new Date(c.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "tennis-rackets",
    label: "Tennis Rackets",
    icon: <CircleDot className="h-5 w-5" />,
    endpoint: "/api/tennis/equipment",
    headers: ["Name", "Brand", "Model", "Weight", "Head Size", "Balance", "Current String", "Tension", "Last Strung", "Notes", "Created"],
    toRow: (r) => [
      String(r.name ?? ""),
      String(r.brand ?? ""),
      String(r.model ?? ""),
      r.weight ? String(r.weight) : "",
      r.headSize ? String(r.headSize) : "",
      r.balance ? String(r.balance) : "",
      String(r.currentString ?? ""),
      String(r.tension ?? ""),
      r.lastStrung ? format(new Date(r.lastStrung as string), "yyyy-MM-dd") : "",
      String(r.notes ?? ""),
      r.createdAt ? format(new Date(r.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "tennis-sessions",
    label: "Tennis Sessions",
    icon: <CircleDot className="h-5 w-5" />,
    endpoint: "/api/tennis/sessions",
    headers: ["Date", "Type", "Duration (hrs)", "Racket", "Coach", "Location", "Tags", "Notes", "Created"],
    toRow: (s) => [
      s.date ? formatInTimeZone(new Date(s.date as string), TIMEZONE, "yyyy-MM-dd") : "",
      String(s.type ?? ""),
      s.duration ? String(s.duration) : "",
      s.racket ? String((s.racket as Record<string, unknown>).name ?? "") : "",
      String(s.coach ?? ""),
      String(s.location ?? ""),
      Array.isArray(s.tags) ? (s.tags as string[]).join("; ") : "",
      String(s.notes ?? ""),
      s.createdAt ? format(new Date(s.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "tennis-strings",
    label: "String Inventory",
    icon: <CircleDot className="h-5 w-5" />,
    endpoint: "/api/tennis/strings",
    headers: ["Name", "Type", "Gauge", "Quantity", "Photos", "Notes", "Created"],
    toRow: (s) => [
      String(s.name ?? ""),
      String(s.type ?? ""),
      String(s.gauge ?? ""),
      String(s.quantity ?? ""),
      String(Array.isArray(s.photos) ? s.photos.length : 0),
      String(s.notes ?? ""),
      s.createdAt ? format(new Date(s.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "tennis-ratings",
    label: "Tennis Ratings",
    icon: <CircleDot className="h-5 w-5" />,
    headers: ["Date", "Stage", "Rated By", "FH", "BH Topspin", "BH Slice", "Serve", "Volley", "Overhead", "Return", "Notes"],
    customExport: async () => {
      const date = format(new Date(), "yyyy-MM-dd");
      const res = await fetch("/api/tennis/ratings/history");
      const json = (await res.json()) as { history: { date: string; stageNumber: number; ratedBy: string; forehand: number; bhTopspin: number; bhSlice: number; serve: number; volley: number; overhead: number; returnOf: number; notes: string | null }[] };
      const history = json.history ?? [];
      const rows = history.map((r) => [
        r.date, `Stage ${r.stageNumber}`, r.ratedBy,
        r.forehand.toFixed(1), r.bhTopspin.toFixed(1), r.bhSlice.toFixed(1),
        r.serve.toFixed(1), r.volley.toFixed(1), r.overhead.toFixed(1),
        r.returnOf.toFixed(1), r.notes ?? "",
      ]);
      const csv = toCSV(["Date", "Stage", "Rated By", "FH", "BH Topspin", "BH Slice", "Serve", "Volley", "Overhead", "Return", "Notes"], rows);
      downloadCSV(`tennis-ratings-${date}.csv`, csv);
      return rows.length;
    },
  },
  {
    key: "pro-players",
    label: "Pro Players",
    icon: <Users className="h-5 w-5" />,
    endpoint: "/api/tennis/pros?active=false",
    headers: ["Name", "Nationality", "Country Code", "Ranking", "Hand", "Racket", "Strings", "Favorite", "Active", "ATP ID", "WTA ID", "Created"],
    toRow: (p) => [
      String(p.name ?? ""),
      String(p.nationality ?? ""),
      String(p.countryCode ?? ""),
      p.ranking ? String(p.ranking) : "",
      String(p.hand ?? ""),
      String(p.racket ?? ""),
      String(p.strings ?? ""),
      p.favorite ? "Yes" : "No",
      p.active ? "Yes" : "No",
      String(p.atpId ?? ""),
      String(p.wtaId ?? ""),
      p.createdAt ? format(new Date(p.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "important-topics",
    label: "Important Topics",
    icon: <Pin className="h-5 w-5" />,
    headers: ["Topic", "Icon", "Category", "Pinned", "Item Type", "Label", "URL", "Content", "Created"],
    customExport: async () => {
      const date = format(new Date(), "yyyy-MM-dd");
      const res = await fetch("/api/important?include=items");
      const json = (await res.json()) as { data: { title: string; icon: string | null; category: string | null; pinned: boolean; createdAt: string; items?: { type: string; label: string | null; url: string | null; content: string | null; createdAt: string }[] }[] };
      const topics = json.data ?? [];
      const rows: string[][] = [];
      for (const t of topics) {
        if (!t.items || t.items.length === 0) {
          rows.push([t.title, t.icon ?? "", t.category ?? "", t.pinned ? "Yes" : "No", "", "", "", "", format(new Date(t.createdAt), "yyyy-MM-dd HH:mm")]);
        } else {
          for (const i of t.items) {
            rows.push([
              t.title, t.icon ?? "", t.category ?? "", t.pinned ? "Yes" : "No",
              i.type, i.label ?? "", i.url ?? "", i.content ?? "",
              format(new Date(i.createdAt), "yyyy-MM-dd HH:mm"),
            ]);
          }
        }
      }
      const csv = toCSV(["Topic", "Icon", "Category", "Pinned", "Item Type", "Label", "URL", "Content", "Created"], rows);
      downloadCSV(`important-topics-${date}.csv`, csv);
      return rows.length;
    },
  },
  {
    key: "emails",
    label: "Email Logs",
    icon: <Mail className="h-5 w-5" />,
    endpoint: "/api/email/history?limit=200",
    headers: ["Type", "To", "Subject", "Preview", "Sent"],
    toRow: (e) => [
      String(e.type ?? ""),
      String(e.to ?? ""),
      String(e.subject ?? ""),
      String(e.preview ?? ""),
      e.createdAt ? format(new Date(e.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "login-logs",
    label: "Login Logs",
    icon: <LogIn className="h-5 w-5" />,
    endpoint: "/api/auth/logs",
    headers: ["Email", "Name", "Success", "IP", "User Agent", "Timestamp"],
    toRow: (l) => [
      String(l.email ?? ""),
      String(l.name ?? ""),
      l.success ? "Yes" : "No",
      String(l.ip ?? ""),
      String(l.userAgent ?? ""),
      l.createdAt ? format(new Date(l.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "push-subs",
    label: "Push Subscriptions",
    icon: <Bell className="h-5 w-5" />,
    endpoint: "/api/push/subscriptions",
    headers: ["Device", "Endpoint", "Registered"],
    toRow: (s) => [
      String(s.device ?? "Unknown"),
      String(s.endpoint ?? ""),
      s.createdAt ? format(new Date(s.createdAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
  {
    key: "notif-logs",
    label: "Notification Logs",
    icon: <Bell className="h-5 w-5" />,
    endpoint: "/api/push/notifications",
    headers: ["Type", "Reference ID", "Sent At"],
    toRow: (n) => [
      String(n.type ?? ""),
      String(n.refId ?? ""),
      n.sentAt ? format(new Date(n.sentAt as string), "yyyy-MM-dd HH:mm") : "",
    ],
  },
];

async function runExport(config: ExportConfig): Promise<number> {
  if (config.customExport) return config.customExport();
  const res = await fetch(config.endpoint!);
  const json = (await res.json()) as { data: Record<string, unknown>[] };
  const items = json.data ?? [];
  const rows = items.map(config.toRow!);
  const csv = toCSV(config.headers, rows);
  const date = format(new Date(), "yyyy-MM-dd");
  downloadCSV(`${config.key}-${date}.csv`, csv);
  return items.length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FullBackupProgress {
  step: string;
  message: string;
  current?: number;
  total?: number;
  uploaded?: number;
  skipped?: number;
  filename?: string;
}

interface FullBackupComplete {
  folderLink: string;
  uploaded: number;
  skipped: number;
  total: number;
  totalBytes: number;
}

export function BackupPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [fullBackupOpen, setFullBackupOpen] = useState(false);
  const [fullBackupProgress, setFullBackupProgress] = useState<FullBackupProgress | null>(null);
  const [fullBackupComplete, setFullBackupComplete] = useState<FullBackupComplete | null>(null);
  const [fullBackupError, setFullBackupError] = useState<string | null>(null);
  const [sheetsSyncSetupOpen, setSheetsSyncSetupOpen] = useState(false);
  const [sheetsSyncSetupResult, setSheetsSyncSetupResult] = useState<{ spreadsheetUrl: string; instructions: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const { data: backups = [] } = useQuery<BackupEntry[]>({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await fetch("/api/backup");
      const json = (await res.json()) as { data: BackupEntry[] };
      return json.data ?? [];
    },
  });

  async function handleSnapshot() {
    setLoading("snapshot");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const json = (await res.json()) as { data: BackupEntry };
      toast.success(`Snapshot saved (${formatBytes(json.data.size)})`);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    } catch {
      toast.error("Failed to create snapshot");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownloadBackup(id: string) {
    const res = await fetch(`/api/backup/${id}`);
    const json = (await res.json()) as { data: { data: unknown; createdAt: string } };
    const blob = new Blob([JSON.stringify(json.data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${format(new Date(json.data.createdAt), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportSheets() {
    setLoading("sheets");
    try {
      const res = await fetch("/api/backup/sheets", { method: "POST" });
      const json = (await res.json()) as { data?: { spreadsheetUrl: string }; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.data?.spreadsheetUrl) {
        window.open(json.data.spreadsheetUrl, "_blank");
        toast.success("Spreadsheet created in Google Drive");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to export";
      toast.error(msg.includes("access token") ? "Please re-login to grant Sheets access" : msg);
    } finally {
      setLoading(null);
    }
  }

  function handleExportPdf() {
    window.open("/api/backup/pdf", "_blank");
  }

  async function handleSendSummary() {
    setLoading("summary");
    try {
      const res = await fetch("/api/email/weekly-summary", { method: "POST" });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Failed to send");
      toast.success("Weekly summary sent to your email");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send summary");
    } finally {
      setLoading(null);
    }
  }

  async function handleSheetsSyncSetup() {
    setLoading("sheets-sync-setup");
    try {
      const res = await fetch("/api/backup/sheets-sync/setup", { method: "POST" });
      const json = (await res.json()) as { data?: { spreadsheetUrl: string; instructions: string[] }; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.data) {
        setSheetsSyncSetupResult(json.data);
        setSheetsSyncSetupOpen(true);
        toast.success("Sync spreadsheet created");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Setup failed";
      toast.error(msg.includes("access token") ? "Please re-login to grant Sheets access" : msg);
    } finally {
      setLoading(null);
    }
  }

  async function handleSheetsSyncNow() {
    setLoading("sheets-sync");
    try {
      const res = await fetch("/api/backup/sheets-sync", { method: "POST" });
      const json = (await res.json()) as { data?: { synced: boolean; tabs: number }; error?: string };
      if (json.error) throw new Error(json.error);
      toast.success(`Synced ${json.data?.tabs ?? 0} tabs to Google Sheets`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      if (msg.includes("not configured")) {
        toast.error("Sheets sync not configured. Run setup first.");
      } else {
        toast.error(msg.includes("access token") ? "Please re-login to grant Sheets access" : msg);
      }
    } finally {
      setLoading(null);
    }
  }

  function handleCopyInstruction(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function handleExportDrive() {
    setLoading("drive");
    try {
      const res = await fetch("/api/backup/drive", { method: "POST" });
      const json = (await res.json()) as { data?: { webViewLink: string; size: number }; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.data?.webViewLink) {
        window.open(json.data.webViewLink, "_blank");
        toast.success("Backup uploaded to Google Drive");
        queryClient.invalidateQueries({ queryKey: ["backups"] });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to upload";
      toast.error(msg.includes("access token") ? "Please re-login to grant Drive access" : msg);
    } finally {
      setLoading(null);
    }
  }

  const handleFullBackup = useCallback(async () => {
    setFullBackupOpen(true);
    setFullBackupProgress({ step: "init", message: "Starting full backup..." });
    setFullBackupComplete(null);
    setFullBackupError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/backup/drive/full", {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            step?: string;
            message?: string;
            current?: number;
            total?: number;
            uploaded?: number;
            skipped?: number;
            filename?: string;
            folderLink?: string;
            totalBytes?: number;
          };

          if (event.type === "progress") {
            setFullBackupProgress({
              step: event.step ?? "",
              message: event.message ?? "",
              current: event.current,
              total: event.total,
              uploaded: event.uploaded,
              skipped: event.skipped,
              filename: event.filename,
            });
          } else if (event.type === "complete") {
            setFullBackupProgress(null);
            setFullBackupComplete({
              folderLink: event.folderLink ?? "",
              uploaded: event.uploaded ?? 0,
              skipped: event.skipped ?? 0,
              total: event.total ?? 0,
              totalBytes: event.totalBytes ?? 0,
            });
            localStorage.setItem("lastDriveBackup", String(Date.now()));
            queryClient.invalidateQueries({ queryKey: ["backups"] });
          } else if (event.type === "error") {
            setFullBackupProgress(null);
            setFullBackupError(event.message ?? "Unknown error");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setFullBackupProgress(null);
        setFullBackupError("Backup cancelled");
      } else {
        const msg = e instanceof Error ? e.message : "Full backup failed";
        setFullBackupProgress(null);
        setFullBackupError(msg.includes("access token") ? "Please re-login to grant Drive access" : msg);
      }
    }

    abortRef.current = null;
  }, [queryClient]);

  function handleCancelFullBackup() {
    abortRef.current?.abort();
  }

  async function handleDeleteBackup(id: string) {
    try {
      await fetch(`/api/backup/${id}`, { method: "DELETE" });
      toast.success("Backup deleted");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    } catch {
      toast.error("Failed to delete backup");
    }
  }

  async function handleExport(config: ExportConfig) {
    setLoading(config.key);
    try {
      const count = await runExport(config);
      toast.success(`Exported ${count} ${config.label.toLowerCase()}`);
    } catch {
      toast.error(`Failed to export ${config.label.toLowerCase()}`);
    } finally {
      setLoading(null);
    }
  }

  async function handleExportAll() {
    setLoading("all");
    try {
      let total = 0;
      for (const config of allExports) {
        const count = await runExport(config);
        total += count;
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(`Exported ${total} records across ${allExports.length} files`);
    } catch {
      toast.error("Failed to export all data");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export your data as CSV files
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allExports.map((config) => (
            <Card key={config.key} className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {config.icon}
                  {config.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  {config.headers.join(", ")}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleExport(config)}
                  disabled={loading !== null}
                >
                  {loading === config.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Export CSV
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <PackageOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground">
                  Downloads {allExports.length} CSV files
                </p>
              </div>
            </div>
            <Button
              onClick={handleExportAll}
              disabled={loading !== null}
              className="gap-2"
            >
              {loading === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export All
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">Google Sheets</p>
                  <p className="text-xs text-muted-foreground">
                    Creates a new spreadsheet in Google Drive
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleExportSheets}
                disabled={loading !== null}
                className="gap-2"
              >
                {loading === "sheets" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Export
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <CloudUpload className="h-5 w-5 text-sky-500" />
                <div>
                  <p className="text-sm font-medium">Google Drive</p>
                  <p className="text-xs text-muted-foreground">
                    Uploads JSON snapshot to Drive
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleExportDrive}
                disabled={loading !== null}
                className="gap-2"
              >
                {loading === "drive" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                Upload
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">PDF Report</p>
                  <p className="text-xs text-muted-foreground">
                    Styled backup report for printing
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={loading !== null}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                Open
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FolderUp className="h-5 w-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium">Full Backup to Drive</p>
                <p className="text-xs text-muted-foreground">
                  Uploads snapshot + all media files to Google Drive
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleFullBackup}
              disabled={loading !== null || fullBackupProgress !== null}
              className="w-full gap-2 sm:w-auto"
            >
              <FolderUp className="h-4 w-4" />
              Full Backup
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Sheets Auto-Sync</p>
                <p className="text-xs text-muted-foreground">
                  Keeps a persistent Google Sheet updated every 15 min via cron
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSheetsSyncSetup}
                disabled={loading !== null}
                className="gap-2"
              >
                {loading === "sheets-sync-setup" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Setup
              </Button>
              <Button
                variant="outline"
                onClick={handleSheetsSyncNow}
                disabled={loading !== null}
                className="gap-2"
              >
                {loading === "sheets-sync" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={sheetsSyncSetupOpen} onOpenChange={setSheetsSyncSetupOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Sheets Sync Setup</DialogTitle>
            </DialogHeader>
            {sheetsSyncSetupResult && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <p className="text-sm">Spreadsheet created. Add these to your server <code className="rounded bg-accent px-1 py-0.5 text-xs">.env</code> file:</p>
                </div>
                <div className="space-y-2">
                  {sheetsSyncSetupResult.instructions.map((line, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-border/50 bg-accent/50 p-2">
                      <code className="min-w-0 flex-1 break-all text-xs">{line}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 shrink-0 p-0"
                        onClick={() => handleCopyInstruction(line)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    window.open(sheetsSyncSetupResult.spreadsheetUrl, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Spreadsheet
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={fullBackupOpen} onOpenChange={(open) => {
          if (!open && fullBackupProgress) return; // prevent close during upload
          setFullBackupOpen(open);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Full Backup to Google Drive</DialogTitle>
            </DialogHeader>

            {fullBackupProgress && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  <p className="text-sm">{fullBackupProgress.message}</p>
                </div>

                {fullBackupProgress.total != null && fullBackupProgress.total > 0 && (
                  <>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{
                          width: `${Math.round(((fullBackupProgress.current ?? 0) / fullBackupProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {fullBackupProgress.uploaded ?? 0} uploaded
                        {(fullBackupProgress.skipped ?? 0) > 0 && `, ${fullBackupProgress.skipped} skipped`}
                      </span>
                      <span>{fullBackupProgress.current ?? 0} / {fullBackupProgress.total}</span>
                    </div>
                  </>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelFullBackup}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}

            {fullBackupComplete && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">Backup complete</p>
                    <p className="text-xs text-muted-foreground">
                      {fullBackupComplete.uploaded} files uploaded ({formatBytes(fullBackupComplete.totalBytes)})
                      {fullBackupComplete.skipped > 0 && `, ${fullBackupComplete.skipped} skipped`}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    window.open(fullBackupComplete.folderLink, "_blank");
                    setFullBackupOpen(false);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Drive
                </Button>
              </div>
            )}

            {fullBackupError && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <p className="text-sm">{fullBackupError}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setFullBackupOpen(false)}
                >
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <BookHeart className="h-5 w-5 text-pink-500" />
              <div>
                <p className="text-sm font-medium">Diary PDF</p>
                <p className="text-xs text-muted-foreground">
                  Full diary with table of contents, stats, and all entries
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open("/api/diary/pdf", "_blank")}
              disabled={loading !== null}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Open
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium">Weekly Summary Email</p>
                <p className="text-xs text-muted-foreground">
                  Sends your week in review to your inbox now
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleSendSummary}
              disabled={loading !== null}
              className="w-full gap-2 sm:w-auto"
            >
              {loading === "summary" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Now
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Database Snapshots
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full JSON snapshots saved to database. Auto-backup runs daily.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Create Snapshot</p>
              <p className="text-xs text-muted-foreground">
                {backups[0]
                  ? `Last backup ${formatDistanceToNow(new Date(backups[0].createdAt), { addSuffix: true })}`
                  : "No backups yet"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSnapshot}
            disabled={loading !== null}
            className="w-full gap-2 sm:w-auto"
          >
            {loading === "snapshot" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Snapshot Now
          </Button>
        </CardContent>
      </Card>

      {backups.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Backup History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {b.type}
                  </span>
                  <div>
                    <p className="text-sm">
                      {formatInTimeZone(new Date(b.createdAt), TIMEZONE, "MMM d, yyyy h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatBytes(b.size)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownloadBackup(b.id)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteBackup(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
