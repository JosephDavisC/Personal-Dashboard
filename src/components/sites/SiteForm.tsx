"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface SiteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SiteFormData) => void;
  site?: { id: string; label: string; url: string } | null;
}

export interface SiteFormData {
  label: string;
  url: string;
}

export function SiteForm({ open, onOpenChange, onSubmit, site }: SiteFormProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (site) {
      setLabel(site.label);
      setUrl(site.url);
    } else {
      setLabel("");
      setUrl("");
    }
  }, [site, open]);

  function handleSubmit() {
    if (!label.trim() || !url.trim()) return;
    onSubmit({ label: label.trim(), url: url.trim() });
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-border bg-background sm:max-w-md"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {site ? "Edit Site" : "Add Site"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="site-label">Label</Label>
            <Input
              id="site-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Portfolio"
              className="mt-1 border-border bg-card"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="site-url">URL</Label>
            <Input
              id="site-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 border-border bg-card"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!label.trim() || !url.trim()}
            >
              {site ? "Save" : "Add Site"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
