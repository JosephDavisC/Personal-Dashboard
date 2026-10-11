"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  HardDrive,
  Film,
  Image as ImageIcon,
  FileText,
  Eye,
  Download,
  Lock,
  Globe,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS } from "@/lib/constants";
import { formatFileSize } from "@/lib/media-format";
import { UploadDialog } from "./UploadDialog";
import { MediaDetailPanel } from "./MediaDetailPanel";
import type { MediaFile } from "@/generated/prisma/client";

interface MediaResponse {
  data: MediaFile[];
  meta: {
    total: number;
    storageUsed: number;
    storageLimit: number;
    storageLimitGB: number;
  };
}

export function MediaTracker() {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailFile, setDetailFile] = useState<MediaFile | null>(null);
  const [deletingFile, setDeletingFile] = useState<MediaFile | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: response } = useQuery<MediaResponse>({
    queryKey: ["media", typeFilter, sourceFilter, searchQuery, sortField],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (sourceFilter !== "all") params.set("tag", sourceFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("sort", sortField === "oldest" ? "createdAt" : sortField);
      if (sortField === "oldest") params.set("dir", "asc");
      params.set("limit", "200");
      const res = await fetch(`/api/media?${params}`);
      return (await res.json()) as MediaResponse;
    },
  });

  const files = response?.data ?? [];
  const meta = response?.meta;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      setDeletingFile(null);
      toast.success("File deleted");
    },
    onError: () => toast.error("Failed to delete file"),
  });

  // Stats
  const stats = useMemo(() => {
    const videos = files.filter((f) => f.mimeType.startsWith("video/")).length;
    const images = files.filter((f) => f.mimeType.startsWith("image/")).length;
    const docs = files.filter(
      (f) => !f.mimeType.startsWith("video/") && !f.mimeType.startsWith("image/")
    ).length;
    return { total: files.length, videos, images, docs };
  }, [files]);

  function getCategory(mime: string): "video" | "image" | "document" {
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("image/")) return "image";
    return "document";
  }

  function getCategoryIcon(mime: string) {
    const cat = getCategory(mime);
    if (cat === "video") return <Film className="h-3.5 w-3.5" />;
    if (cat === "image") return <ImageIcon className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  }

  function getPrivacyIcon(file: MediaFile) {
    if (file.password) return <Lock className="h-3 w-3" />;
    if (file.isPublic) return <Globe className="h-3 w-3" />;
    return <EyeOff className="h-3 w-3" />;
  }

  function copyShareLink(file: MediaFile) {
    const url = `${window.location.origin}/cdn/${file.shareSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  function copyDirectLink(file: MediaFile) {
    const url = `${window.location.origin}/api/media/share/${file.shareSlug}`;
    navigator.clipboard.writeText(url);
    toast.success("Direct link copied");
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <HardDrive className="h-[18px] w-[18px] text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Files</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10">
              <Film className="h-[18px] w-[18px] text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.videos}</p>
              <p className="text-xs text-muted-foreground">Videos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <ImageIcon className="h-[18px] w-[18px] text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.images}</p>
              <p className="text-xs text-muted-foreground">Images</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Storage</p>
              <p className="text-xs text-muted-foreground">
                {meta ? `${meta.storageLimitGB} GB` : ""}
              </p>
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">
              {meta ? formatFileSize(meta.storageUsed) : "0 B"}
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: meta
                    ? `${Math.min(100, (meta.storageUsed / meta.storageLimit) * 100)}%`
                    : "0%",
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Row 1: Search + Upload */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-base sm:text-sm"
            />
          </div>
          <div className="flex rounded-lg border border-border">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-r-none", viewMode === "grid" && "bg-muted")}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-l-none", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setUploadOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>
        {/* Row 2: Filters */}
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-auto min-w-0 flex-1 sm:flex-none sm:w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MEDIA_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-auto min-w-0 flex-1 sm:flex-none sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">From</SelectItem>
              <SelectItem value="upload">Uploads</SelectItem>
              <SelectItem value="diary">Diary</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-auto min-w-0 flex-1 sm:flex-none sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="size">Largest</SelectItem>
              <SelectItem value="views">Most Viewed</SelectItem>
              <SelectItem value="filename">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-2 grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => {
            const cat = getCategory(file.mimeType);
            return (
              <Card
                key={file.id}
                className="group cursor-pointer overflow-hidden transition-colors hover:border-primary/50"
                onClick={() => setDetailFile(file)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {file.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${file.id}/thumb`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : cat === "video" ? (
                    <video
                      src={`/api/media/${file.id}/download`}
                      preload="metadata"
                      muted
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : cat === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${file.id}/download`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  {/* Type badge */}
                  <span
                    className={cn(
                      "absolute left-2 top-2 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      MEDIA_TYPE_COLORS[cat]
                    )}
                  >
                    {getCategoryIcon(file.mimeType)}
                    {cat === "video" ? "Video" : cat === "image" ? "Image" : "PDF"}
                  </span>
                  {/* Hover actions */}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareLink(file);
                      }}
                      className="rounded-md bg-background/80 p-1.5 backdrop-blur-sm hover:bg-background"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingFile(file);
                      }}
                      className="rounded-md bg-background/80 p-1.5 backdrop-blur-sm hover:bg-background"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                <CardContent className="p-2 sm:p-3">
                  <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                    {file.title || file.filename}
                  </p>
                  <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="flex items-center gap-0.5">
                      <Eye className="h-3 w-3" />
                      {file.views}
                    </span>
                    <span>{getPrivacyIcon(file)}</span>
                    <span className="ml-auto hidden sm:inline">
                      {formatDistanceToNow(new Date(file.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Size
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Views
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const cat = getCategory(file.mimeType);
                return (
                  <tr
                    key={file.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => setDetailFile(file)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getPrivacyIcon(file)}
                        <span className="truncate font-medium text-foreground">
                          {file.title || file.filename}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
                          MEDIA_TYPE_COLORS[cat]
                        )}
                      >
                        {cat === "video"
                          ? "Video"
                          : cat === "image"
                            ? "Image"
                            : "PDF"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {file.views}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {formatDistanceToNow(new Date(file.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              copyShareLink(file);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Share Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              copyDirectLink(file);
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Copy Direct Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailFile(file);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/api/media/${file.id}/download`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingFile(file);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <HardDrive className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No files uploaded yet
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Upload your first file
          </Button>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["media"] });
        }}
      />

      {/* Detail Panel */}
      <MediaDetailPanel
        file={detailFile}
        onClose={() => setDetailFile(null)}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["media"] });
        }}
        onDelete={(file) => {
          setDetailFile(null);
          setDeletingFile(file);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingFile}
        onOpenChange={(open) => !open && setDeletingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deletingFile?.title || deletingFile?.filename}
              </span>{" "}
              and remove it from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingFile && deleteMutation.mutate(deletingFile.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
