"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import { cn } from "@/lib/utils";

interface PdfPreviewCardProps {
  url: string;
  title?: string;
  thumbnailUrl?: string | null;
  size?: number | null;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfPreviewCard({
  url,
  title,
  thumbnailUrl,
  size,
  className,
}: PdfPreviewCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setViewerOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setViewerOpen(true);
          }
        }}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card/50 p-2 transition-colors hover:border-primary/30 hover:bg-accent/30",
          className
        )}
      >
        {/* Thumbnail or fallback */}
        {thumbnailUrl ? (
          <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileText className="h-6 w-6 text-red-400" />
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {title || "PDF Document"}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF{size ? ` · ${formatSize(size)}` : ""}
          </p>
        </div>
      </div>

      <PdfViewer
        url={url}
        title={title}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}
