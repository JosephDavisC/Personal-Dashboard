"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Image,
  ChevronDown,
  X,
  Link2,
  Pin,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IMPORTANT_CATEGORIES } from "@/lib/constants";
import type { Link } from "@/generated/prisma/client";

const ICON_OPTIONS = [
  "globe",
  "github",
  "linkedin",
  "mail",
  "book-open",
  "calendar",
  "code",
  "file-text",
  "folder",
  "home",
  "link",
  "search",
  "settings",
  "user",
  "video",
] as const;

interface LinkFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LinkFormData) => void;
  link?: Link | null;
}

export interface LinkFormData {
  label: string;
  url: string;
  icon?: string;
  pinned?: boolean;
  category?: string | null;
}

export function LinkForm({ open, onOpenChange, onSubmit, link }: LinkFormProps) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("globe");
  const [iconOpen, setIconOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [categoryVal, setCategoryVal] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (link) {
      setLabel(link.label);
      setUrl(link.url);
      setIcon(link.icon ?? "globe");
      setPinned(link.pinned);
      setCategoryVal(link.category ?? null);
    } else {
      setLabel("");
      setUrl("");
      setIcon("globe");
      setPinned(false);
      setCategoryVal(null);
    }
    if (open) {
      setTimeout(() => labelRef.current?.focus(), 50);
    }
  }, [link, open]);

  function handleSubmit() {
    if (!label.trim() || !url.trim()) return;
    onSubmit({ label: label.trim(), url: url.trim(), icon, pinned, category: categoryVal });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-3xl"
        showCloseButton={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{link ? "Edit Link" : "Add Link"}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Close button */}
        <div className="flex items-center justify-end px-4 pt-3 md:px-6 md:pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex flex-col gap-5 px-4 pb-5 md:flex-row md:gap-8 md:px-6 md:pb-6">
          {/* Left: content */}
          <div className="min-w-0 flex-1 space-y-4">
            {/* Label */}
            <input
              ref={labelRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Link label..."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />

            {/* URL */}
            <div className="px-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">URL</span>
              </div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
            </div>

            <Separator className="mx-3" />

            {/* Submit */}
            <div className="flex items-center gap-3 px-3">
              <Button className="h-11 md:h-9" onClick={handleSubmit} disabled={!label.trim() || !url.trim()}>
                {link ? "Save Link" : "Add Link"}
              </Button>
              <span className="text-xs text-muted-foreground/50">Cmd+Enter</span>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="flex w-full flex-col gap-2 md:w-48">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Options
            </p>

            {/* Pin toggle */}
            <Button
              variant="secondary"
              className={cn(
                "h-10 w-full justify-start text-sm font-normal md:h-9",
                pinned && "bg-primary/10 text-primary"
              )}
              onClick={() => setPinned(!pinned)}
            >
              <Pin className={cn("mr-2 h-4 w-4 md:h-3.5 md:w-3.5", pinned ? "text-primary" : "text-muted-foreground")} />
              {pinned ? "Pinned" : "Pin link"}
            </Button>

            {/* Category popover */}
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    {categoryVal
                      ? IMPORTANT_CATEGORIES.find((c) => c.value === categoryVal)?.label ?? categoryVal
                      : "No category"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <button
                  onClick={() => { setCategoryVal(null); setCatOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                    !categoryVal ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-accent"
                  )}
                >
                  None
                </button>
                {IMPORTANT_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { setCategoryVal(c.value); setCatOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      categoryVal === c.value
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Icon popover */}
            <Popover open={iconOpen} onOpenChange={setIconOpen}>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-10 w-full justify-between text-sm font-normal md:h-9">
                  <span className="flex items-center gap-2">
                    <Image className="h-3.5 w-3.5 text-muted-foreground" />
                    {icon}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 max-h-60 overflow-y-auto p-1" align="start">
                {ICON_OPTIONS.map((i) => (
                  <button
                    key={i}
                    onClick={() => { setIcon(i); setIconOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-1.5",
                      icon === i
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    {i}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
