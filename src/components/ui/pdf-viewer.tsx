"use client";

import { useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "radix-ui";

interface PdfViewerProps {
  url: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfViewer({ url, title, open, onOpenChange }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const cleanUrl = url.replace("#pdf", "");
  const displayTitle = title || "PDF Document";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-none flex-col gap-0 overflow-hidden rounded-xl p-0 h-[95dvh] w-[calc(100%-1rem)] sm:h-[85vh] sm:max-w-5xl"
      >
        <VisuallyHidden.Root>
          <DialogTitle>{displayTitle}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Title bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {displayTitle}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              onClick={() => window.open(cleanUrl, "_blank")}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              onClick={() => onOpenChange(false)}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF iframe — overflow-auto + WebkitOverflowScrolling for iOS multi-page scroll */}
        <div
          className="relative min-h-0 flex-1 overflow-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={cleanUrl}
            className="h-full w-full border-0"
            title={displayTitle}
            onLoad={() => setLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
