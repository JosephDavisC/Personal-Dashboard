"use client";

import { useState } from "react";
import { Globe, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SiteScreenshotData {
  id: string;
  label: string;
  url: string;
  isUp: boolean | null;
  responseTime: number | null;
}

interface SiteScreenshotsProps {
  sites: SiteScreenshotData[];
  managing?: boolean;
  onSiteClick?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function getScreenshotUrl(url: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=640&h=400`;
}

export function SiteScreenshots({
  sites,
  managing,
  onSiteClick,
  onEdit,
  onDelete,
}: SiteScreenshotsProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {sites.map((site) => (
        <ScreenshotCard
          key={site.id}
          site={site}
          managing={managing}
          onClick={() => onSiteClick?.(site.id)}
          onEdit={() => onEdit?.(site.id)}
          onDelete={() => onDelete?.(site.id)}
        />
      ))}
    </div>
  );
}

function ScreenshotCard({
  site,
  managing,
  onClick,
  onEdit,
  onDelete,
}: {
  site: SiteScreenshotData;
  managing?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group relative w-[200px] shrink-0">
      <button onClick={onClick} className="w-full text-left">
        <div className="relative h-[100px] overflow-hidden rounded-md bg-muted">
          {!imgError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={getScreenshotUrl(site.url)}
              alt={`${site.label} preview`}
              className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Globe className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
          <div
            className={cn(
              "absolute left-1.5 top-1.5 h-2 w-2 rounded-full",
              site.isUp === null
                ? "bg-muted-foreground/50"
                : site.isUp
                  ? "bg-emerald-500"
                  : "bg-red-500"
            )}
          />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="truncate text-xs font-medium text-foreground">
            {site.label}
          </p>
          {site.isUp && site.responseTime !== null && (
            <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/60">
              {site.responseTime}ms
            </span>
          )}
        </div>
      </button>

      {managing && (
        <div className="absolute right-1 top-1 flex gap-0.5 rounded bg-card/90 p-0.5 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-2.5 w-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-red-400"
            onClick={onDelete}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
