"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { compressImageClient } from "@/lib/compress-image";
import { Upload, X, FileText, CheckCircle2, ImageUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { MEDIA_ACCEPTED_TYPES } from "@/lib/constants";
import { formatFileSize } from "@/lib/media-format";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

interface QueuedFile {
  file: File;
  title: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export function UploadDialog({ open, onOpenChange, onUploaded }: UploadDialogProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [hd, setHd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: QueuedFile[] = Array.from(fileList)
      .filter((f) =>
        MEDIA_ACCEPTED_TYPES.includes(f.type as (typeof MEDIA_ACCEPTED_TYPES)[number])
      )
      .map((file) => ({
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        progress: 0,
        status: "pending" as const,
      }));

    if (newFiles.length === 0) {
      toast.error("No supported files selected");
      return;
    }
    setQueue((prev) => [...prev, ...newFiles]);
  }, []);

  function updateQueueItem(index: number, update: Partial<QueuedFile>) {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...update } : item))
    );
  }

  function removeFile(index: number) {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadAll() {
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (!item || item.status === "done") continue;

      updateQueueItem(i, { status: "uploading", progress: 0 });

      try {
        const file = hd ? item.file : await compressImageClient(item.file);
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", item.title);
          if (hd) formData.append("hd", "true");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updateQueueItem(i, {
                progress: Math.round((e.loaded / e.total) * 100),
              });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateQueueItem(i, { status: "done", progress: 100 });
              resolve();
            } else {
              try {
                const data = JSON.parse(xhr.responseText) as { error?: string };
                reject(new Error(data.error || "Upload failed"));
              } catch {
                reject(new Error(`Server error (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));
          xhr.open("POST", "/api/media");
          xhr.send(formData);
        });
      } catch (err) {
        updateQueueItem(i, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    onUploaded();
    const uploaded = queue.filter((q) => q.status !== "error").length;
    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} file${uploaded > 1 ? "s" : ""}`);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleClose() {
    if (queue.some((q) => q.status === "uploading")) return;
    setQueue([]);
    onOpenChange(false);
  }

  // Generate object URLs for previews
  const previewUrls = useMemo(() => {
    const urls = new Map<number, string>();
    queue.forEach((item, i) => {
      if (item.file.type.startsWith("image/") || item.file.type.startsWith("video/")) {
        urls.set(i, URL.createObjectURL(item.file));
      }
    });
    return urls;
  }, [queue]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const allDone = queue.length > 0 && queue.every((q) => q.status === "done" || q.status === "error");
  const isUploading = queue.some((q) => q.status === "uploading");
  const hasPending = queue.some((q) => q.status === "pending");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-background sm:max-w-lg">
        <VisuallyHidden.Root>
          <DialogTitle>Upload Files</DialogTitle>
        </VisuallyHidden.Root>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Upload Files</h2>

          {/* Drop zone */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Drop files here or click to browse
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                MP4, WebM, PNG, JPEG, WebP, GIF, PDF — up to 500MB
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={MEDIA_ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* File Queue */}
          {queue.length > 0 && (
            <div className="space-y-2">
              {queue.map((item, i) => {
                const previewUrl = previewUrls.get(i);
                const isImage = item.file.type.startsWith("image/");
                const isVideo = item.file.type.startsWith("video/");

                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-3"
                  >
                    {/* Preview thumbnail */}
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {isImage && previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : isVideo && previewUrl ? (
                        <video src={previewUrl} muted className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {item.status === "pending" ? (
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            updateQueueItem(i, { title: e.target.value })
                          }
                          className="h-7 text-sm"
                          placeholder="Title"
                        />
                      ) : (
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title || item.file.name}
                        </p>
                      )}
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                        {item.status === "uploading" && (
                          <div className="min-w-0 flex-1">
                            <div className="h-1 w-full rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {item.status === "done" && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                        )}
                      </div>
                      {item.status === "error" && (
                        <p className="mt-1 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                          Upload failed{item.error ? `: ${item.error}` : ""}
                        </p>
                      )}
                    </div>
                    {item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0"
                        onClick={() => removeFile(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!allDone && (
              <button
                type="button"
                onClick={() => setHd(!hd)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  hd
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={hd ? "HD: uploading at original quality" : "Images are auto-compressed. Click for HD."}
              >
                <ImageUp className="h-3.5 w-3.5" />
                HD
              </button>
            )}
            <div className="flex-1" />
            {allDone ? (
              <Button onClick={handleClose}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                  Cancel
                </Button>
                <Button
                  onClick={uploadAll}
                  disabled={!hasPending || isUploading}
                >
                  {isUploading
                    ? "Uploading..."
                    : `Upload ${queue.filter((q) => q.status === "pending").length} file${queue.filter((q) => q.status === "pending").length !== 1 ? "s" : ""}`}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
