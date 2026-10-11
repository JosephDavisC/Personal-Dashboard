"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
  WORK_LOCATION_LABELS,
} from "@/lib/constants";

interface JobImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  title: string;
  company: string;
  status: string;
  dateApplied: string;
  nextSteps: string;
  salary: string;
  location: string;
  jobUrl: string;
}

// Map Notion status text to our enum values
const STATUS_MAP: Record<string, string> = {
  applied: "APPLIED",
  "phone screen": "PHONE_SCREEN",
  interview: "INTERVIEW",
  offer: "OFFER",
  rejected: "REJECTED",
  withdrawn: "WITHDRAWN",
};

const LOCATION_MAP: Record<string, string> = {
  remote: "REMOTE",
  hybrid: "HYBRID",
  "on site": "ON_SITE",
  "on-site": "ON_SITE",
  onsite: "ON_SITE",
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(current.trim());
        if (row.some((c) => c)) rows.push(row);
        row = [];
        current = "";
      } else {
        current += ch;
      }
    }
  }
  row.push(current.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

function detectColumn(header: string): string | null {
  const h = header.toLowerCase().trim();
  if (h.includes("job title") || h === "title" || h === "role" || h === "position") return "title";
  if (h === "company" || h.includes("company")) return "company";
  if (h === "status") return "status";
  if (h.includes("date") && h.includes("appl")) return "dateApplied";
  if (h.includes("next step")) return "nextSteps";
  if (h.includes("salary") || h.includes("pay") || h.includes("compensation")) return "salary";
  if (h === "location" || h.includes("location")) return "location";
  if (h.includes("url") || h.includes("link") || h === "job url") return "jobUrl";
  return null;
}

function parseDate(text: string): string | null {
  if (!text) return null;
  // Try "August 15, 2025" format
  const d = new Date(text);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try ISO
  const iso = new Date(text + "T12:00:00");
  if (!isNaN(iso.getTime())) return iso.toISOString();
  return null;
}

export function JobImport({ open, onOpenChange, onImported }: JobImportProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        setError("CSV must have a header row and at least one data row");
        return;
      }

      const headers = parsed[0]!;
      const columnMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const field = detectColumn(h);
        if (field) columnMap[field] = i;
      });

      if (!columnMap.title && !columnMap.company) {
        setError(
          "Could not detect Job Title or Company columns. Make sure your CSV has headers like 'Job Title' and 'Company'."
        );
        return;
      }

      const dataRows = parsed.slice(1);
      const mapped: ParsedRow[] = dataRows.map((row) => {
        const get = (field: string) => {
          const idx = columnMap[field];
          return idx !== undefined ? row[idx] ?? "" : "";
        };

        const rawStatus = get("status").toLowerCase();
        const rawLocation = get("location").toLowerCase();

        return {
          title: get("title"),
          company: get("company"),
          status: STATUS_MAP[rawStatus] ?? "APPLIED",
          dateApplied:
            parseDate(get("dateApplied")) ?? new Date().toISOString(),
          nextSteps: get("nextSteps"),
          salary: get("salary"),
          location: LOCATION_MAP[rawLocation] ?? "",
          jobUrl: get("jobUrl"),
        };
      });

      setRows(mapped.filter((r) => r.title || r.company));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);

    try {
      const jobs = rows.map((r) => ({
        title: r.title || "Untitled",
        company: r.company || "Unknown",
        status: r.status,
        dateApplied: r.dateApplied,
        nextSteps: r.nextSteps || null,
        salary: r.salary || null,
        location: r.location || null,
        jobUrl: r.jobUrl || null,
      }));

      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }

      const data = (await res.json()) as { data: { imported: number } };
      toast.success(`Imported ${data.data.imported} applications`);
      setRows([]);
      onImported();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import"
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setRows([]);
          setError("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Import from CSV</DialogTitle>
        <DialogDescription>
          Export your Notion table as CSV and upload it here. Columns like
          &quot;Job Title&quot;, &quot;Company&quot;, &quot;Status&quot;, and
          &quot;Date Applied&quot; will be auto-detected.
        </DialogDescription>

        {rows.length === 0 ? (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="h-8 w-8" />
              <div className="text-center">
                <p className="font-medium">Drop CSV file here or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports Notion CSV exports
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{rows.length} applications detected</span>
            </div>

            {/* Preview table */}
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Company
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-1.5 text-foreground">
                        {row.title || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-foreground">
                        {row.company || "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            APPLICATION_STATUS_COLORS[row.status]
                          )}
                        >
                          {APPLICATION_STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {row.location
                          ? WORK_LOCATION_LABELS[row.location] ?? row.location
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  ...and {rows.length - 20} more
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing
                  ? "Importing..."
                  : `Import ${rows.length} Applications`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
