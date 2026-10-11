"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Upload,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpDown,
  Briefcase,
  TrendingUp,
  Clock,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  WORK_LOCATION_LABELS,
  WORK_LOCATION_COLORS,
} from "@/lib/constants";
import { JobForm, type JobFormData } from "./JobForm";
import { JobImport } from "./JobImport";
import { downloadCSV, toCSV } from "@/lib/csv-export";
import type { JobApplication } from "@/generated/prisma/client";

type SortField = "order" | "dateApplied" | "company" | "status" | "title";
type SortDir = "asc" | "desc";

export function JobTracker() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [deletingJob, setDeletingJob] = useState<JobApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("dateApplied");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: jobs = [] } = useQuery<JobApplication[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      const json = (await res.json()) as { data: JobApplication[] };
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobFormData) => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setFormOpen(false);
      toast.success("Application added");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: JobFormData }) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setFormOpen(false);
      setEditingJob(null);
      toast.success("Application updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setDeletingJob(null);
      toast.success("Application deleted");
    },
    onError: () => toast.error("Failed to delete application"),
  });

  // Stats
  const stats = useMemo(() => {
    const total = jobs.length;
    const applied = jobs.filter((j) => j.status === "APPLIED").length;
    const active = jobs.filter(
      (j) => j.status === "PHONE_SCREEN" || j.status === "INTERVIEW"
    ).length;
    const offers = jobs.filter((j) => j.status === "OFFER").length;
    const responded = total - applied;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
    return { total, active, offers, responseRate };
  }, [jobs]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = statusFilter
      ? jobs.filter((j) => j.status === statusFilter)
      : jobs;

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "order":
          cmp = a.order - b.order;
          break;
        case "dateApplied":
          cmp =
            new Date(a.dateApplied).getTime() -
            new Date(b.dateApplied).getTime();
          break;
        case "company":
          cmp = a.company.localeCompare(b.company);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [jobs, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "dateApplied" ? "desc" : "asc");
    }
  }

  function handleExport() {
    if (jobs.length === 0) {
      toast.error("No applications to export");
      return;
    }
    const csv = toCSV(
      [
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
      jobs.map((j) => [
        String(j.order),
        j.title,
        j.company,
        APPLICATION_STATUS_LABELS[j.status] ?? j.status,
        format(new Date(j.dateApplied), "yyyy-MM-dd"),
        j.nextSteps ?? "",
        j.salary ?? "",
        j.location ? (WORK_LOCATION_LABELS[j.location] ?? j.location) : "",
        j.jobUrl ?? "",
        j.assessmentType ?? "NONE",
        j.assessmentNotes ?? "",
        j.notes ?? "",
      ])
    );
    downloadCSV(csv, "applications.csv");
    toast.success("Exported applications");
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Briefcase className="h-4 w-4" />}
          label="Total"
          value={stats.total}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Response Rate"
          value={`${stats.responseRate}%`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Active"
          value={stats.active}
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Offers"
          value={stats.offers}
        />
      </div>

      {/* Filters + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <FilterButton
            active={statusFilter === ""}
            onClick={() => setStatusFilter("")}
          >
            All ({jobs.length})
          </FilterButton>
          {APPLICATION_STATUSES.map((s) => {
            const count = jobs.filter((j) => j.status === s).length;
            if (count === 0) return null;
            return (
              <FilterButton
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {APPLICATION_STATUS_LABELS[s]} ({count})
              </FilterButton>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingJob(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <SortableHeader
                label="#"
                field="order"
                current={sortField}
                dir={sortDir}
                onSort={toggleSort}
                className="w-12"
              />
              <SortableHeader
                label="Job Title"
                field="title"
                current={sortField}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Company"
                field="company"
                current={sortField}
                dir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="Status"
                field="status"
                current={sortField}
                dir={sortDir}
                onSort={toggleSort}
                className="w-32"
              />
              <SortableHeader
                label="Applied"
                field="dateApplied"
                current={sortField}
                dir={sortDir}
                onSort={toggleSort}
                className="w-28"
              />
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                Next Steps
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                Salary
              </th>
              <th className="w-24 px-3 py-2.5 text-left font-medium text-muted-foreground">
                Location
              </th>
              <th className="w-16 px-3 py-2.5 text-left font-medium text-muted-foreground">
                URL
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No applications found
                </td>
              </tr>
            ) : (
              filtered.map((job) => (
                <tr
                  key={job.id}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-card/50"
                  onClick={() => {
                    setEditingJob(job);
                    setFormOpen(true);
                  }}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {job.order}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {job.title}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{job.company}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        APPLICATION_STATUS_COLORS[job.status]
                      )}
                    >
                      {APPLICATION_STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {format(new Date(job.dateApplied), "MMM d, yyyy")}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {job.nextSteps || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {job.salary || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {job.location ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          WORK_LOCATION_COLORS[job.location]
                        )}
                      >
                        {WORK_LOCATION_LABELS[job.location]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {job.jobUrl ? (
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-muted-foreground transition-colors hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingJob(job);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingJob(job);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No applications found
            </CardContent>
          </Card>
        ) : (
          filtered.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer transition-colors hover:bg-card/80"
              onClick={() => {
                setEditingJob(job);
                setFormOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.company}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingJob(job);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {job.jobUrl && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(job.jobUrl!, "_blank");
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open URL
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingJob(job);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      APPLICATION_STATUS_COLORS[job.status]
                    )}
                  >
                    {APPLICATION_STATUS_LABELS[job.status]}
                  </span>
                  {job.location && (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        WORK_LOCATION_COLORS[job.location]
                      )}
                    >
                      {WORK_LOCATION_LABELS[job.location]}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(job.dateApplied), "MMM d, yyyy")}
                  </span>
                  {job.salary && <span>{job.salary}</span>}
                </div>

                {job.nextSteps && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {job.nextSteps}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form dialog */}
      <JobForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingJob(null);
        }}
        job={editingJob}
        onSubmit={(data) => {
          if (editingJob) {
            updateMutation.mutate({ id: editingJob.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
      />

      {/* Import dialog */}
      <JobImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() =>
          queryClient.invalidateQueries({ queryKey: ["jobs"] })
        }
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deletingJob}
        onOpenChange={(o) => {
          if (!o) setDeletingJob(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the application for{" "}
              <strong>{deletingJob?.title}</strong> at{" "}
              <strong>{deletingJob?.company}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deletingJob) deleteMutation.mutate(deletingJob.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Helper Components ---

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th className={cn("px-3 py-2.5", className)}>
      <button
        onClick={() => onSort(field)}
        className={cn(
          "flex items-center gap-1 text-left font-medium transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            active ? "text-primary" : "text-muted-foreground/50"
          )}
        />
        {active && (
          <span className="text-[10px] text-primary">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  );
}
