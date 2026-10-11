"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Table2,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
}

interface TableInfo {
  name: string;
  delegate: string;
  rowCount: number;
  columns: TableColumn[];
}

interface RowMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function DatabaseBrowser() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [inspectRow, setInspectRow] = useState<Record<string, unknown> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch tables list
  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableInfo[]>({
    queryKey: ["database-tables"],
    queryFn: async () => {
      const res = await fetch("/api/database");
      const json = (await res.json()) as { data: TableInfo[] };
      return json.data;
    },
  });

  // Fetch rows for selected table
  const {
    data: rowsData,
    isLoading: rowsLoading,
    isFetching,
  } = useQuery<{ data: Record<string, unknown>[]; meta: RowMeta }>({
    queryKey: ["database-rows", selectedTable, page, sort, dir, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        sort,
        dir,
        search,
      });
      const res = await fetch(`/api/database/${selectedTable}?${params}`);
      return res.json();
    },
    enabled: !!selectedTable,
  });

  const rows = rowsData?.data || [];
  const meta = rowsData?.meta;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/database/${selectedTable}?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["database-rows", selectedTable] });
      queryClient.invalidateQueries({ queryKey: ["database-tables"] });
      toast.success("Row deleted");
      setDeletingId(null);
      setInspectRow(null);
    },
    onError: () => toast.error("Failed to delete row"),
  });

  const currentTable = useMemo(
    () => tables.find((t) => t.name === selectedTable),
    [tables, selectedTable]
  );

  const handleSort = (col: string) => {
    if (sort === col) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(col);
      setDir("desc");
    }
    setPage(1);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSelectTable = (name: string) => {
    setSelectedTable(name);
    setPage(1);
    setSort("createdAt");
    setDir("desc");
    setSearch("");
    setSearchInput("");
    setInspectRow(null);
  };

  const formatCell = (value: unknown, colName: string): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value instanceof Date) return format(value, "yyyy-MM-dd HH:mm:ss");
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return format(new Date(value), "yyyy-MM-dd HH:mm:ss");
      } catch {
        return value;
      }
    }
    if (typeof value === "object") return JSON.stringify(value);
    const str = String(value);
    // Truncate long values in table view
    if (str.length > 80) return str.slice(0, 80) + "...";
    return str;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex gap-4">
      {/* Table list sidebar */}
      {sidebarOpen && (
        <div className="hidden w-56 shrink-0 lg:block">
          <Card className="border-border bg-card p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Tables
            </div>
            {tablesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-0.5">
                {tables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTable(t.name)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                      selectedTable === t.name
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Table2 className="h-3.5 w-3.5 shrink-0" />
                      {t.name}
                    </span>
                    <span className="ml-1 shrink-0 text-xs opacity-60">
                      {t.rowCount}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Mobile table selector */}
        <div className="mb-4 lg:hidden">
          <select
            value={selectedTable || ""}
            onChange={(e) => e.target.value && handleSelectTable(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground"
          >
            <option value="">Select a table...</option>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.rowCount})
              </option>
            ))}
          </select>
        </div>

        {!selectedTable ? (
          <Card className="border-border bg-card">
            <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <Database className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Select a table to browse its data
              </p>
              <p className="text-sm text-muted-foreground/60">
                {tables.length} tables available
              </p>
            </div>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            {/* Table header */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hidden rounded p-1 text-muted-foreground hover:bg-accent lg:block"
                >
                  <Database className="h-4 w-4" />
                </button>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  {selectedTable}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {meta?.total ?? "..."} rows
                </span>
                {isFetching && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="flex items-center gap-1"
                >
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search..."
                      className="h-8 w-40 pl-8 text-sm sm:w-56"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setSearch("");
                          setPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Table content */}
            <div className="overflow-x-auto">
              {rowsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  {search ? "No rows match your search" : "No data in this table"}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {currentTable?.columns.map((col) => (
                        <th
                          key={col.name}
                          onClick={() => handleSort(col.name)}
                          className="cursor-pointer whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.name}
                            {sort === col.name ? (
                              dir === "asc" ? (
                                <ArrowUp className="h-3 w-3 text-primary" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground/40">
                            {col.type}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={String(row.id ?? i)}
                        onClick={() => setInspectRow(row)}
                        className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/50"
                      >
                        {currentTable?.columns.map((col) => (
                          <td
                            key={col.name}
                            className={cn(
                              "max-w-[200px] truncate whitespace-nowrap px-4 py-2.5 text-sm",
                              row[col.name] === null
                                ? "italic text-muted-foreground/40"
                                : typeof row[col.name] === "boolean"
                                  ? row[col.name]
                                    ? "text-emerald-400"
                                    : "text-red-400"
                                  : "text-foreground"
                            )}
                          >
                            {formatCell(row[col.name], col.name)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Row detail modal */}
      <Dialog open={!!inspectRow} onOpenChange={(open) => !open && setInspectRow(null)}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-heading">Row Detail</DialogTitle>
          </DialogHeader>
          {inspectRow && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4">
                {Object.entries(inspectRow).map(([key, value]) => (
                  <div key={key} className="group">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">
                        {key}
                      </label>
                      <button
                        onClick={() => copyToClipboard(value === null ? "NULL" : String(value))}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    <div className="mt-1.5 rounded-lg border border-border bg-accent/30 px-3 py-2.5 font-mono text-sm text-foreground">
                      {value === null ? (
                        <span className="italic text-muted-foreground/40">NULL</span>
                      ) : typeof value === "boolean" ? (
                        <span className={value ? "text-emerald-400" : "text-red-400"}>
                          {String(value)}
                        </span>
                      ) : typeof value === "object" ? (
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? (
                        format(new Date(value), "yyyy-MM-dd HH:mm:ss")
                      ) : (
                        <span className="break-all">{String(value)}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Delete button */}
                {typeof inspectRow.id === "string" && (
                  <div className="pt-2 pb-1">
                    <Button
                      variant="destructive"
                      onClick={() => setDeletingId(String(inspectRow.id))}
                      className="w-full"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Row
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this row?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this row from the {selectedTable} table.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
