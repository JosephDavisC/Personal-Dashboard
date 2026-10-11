"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { AutoContextInline, type DayContext } from "./AutoContext";
import { getMoodIcon, MOOD_BORDER_COLORS } from "./MoodPicker";
import { getTagIcon } from "./TagPicker";
import { PhotoLightbox } from "./PhotoLightbox";
import { FileText, Play } from "lucide-react";
import type { DiaryEntry, DiaryPhoto } from "@/generated/prisma/client";
import React from "react";

/** Strip any HTML tags from content, then render **bold** markers as <strong> */
function renderBoldText(text: string): React.ReactNode[] {
  // Strip HTML tags that may have been saved by contentEditable editor
  const clean = text.replace(/<[^>]+>/g, "");
  const parts = clean.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

type PhotoWithMime = DiaryPhoto & { mimeType?: string | null };
type EntryWithPhotos = DiaryEntry & { photos: PhotoWithMime[] };

interface DiaryCardProps {
  entry: EntryWithPhotos;
  onClick: () => void;
}

export function DiaryCard({ entry, onClick }: DiaryCardProps) {
  const dateStr = formatInTimeZone(new Date(entry.date), TIMEZONE, "yyyy-MM-dd");
  const displayDate = formatInTimeZone(new Date(entry.date), TIMEZONE, "EEEE, MMMM d, yyyy");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: context } = useQuery<DayContext>({
    queryKey: ["diary-context", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/diary/${dateStr}/context`);
      if (!res.ok) throw new Error("Failed to fetch context");
      return ((await res.json()) as { data: DayContext }).data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const truncatedContent =
    entry.content && entry.content.length > 150
      ? entry.content.slice(0, 150) + "..."
      : entry.content;

  const moodInfo = getMoodIcon(entry.mood);

  return (
    <>
      <Card
        className={`cursor-pointer transition-colors hover:border-primary/30 ${
          entry.mood && MOOD_BORDER_COLORS[entry.mood]
            ? `border-l-4 ${MOOD_BORDER_COLORS[entry.mood]}`
            : ""
        }`}
        onClick={onClick}
      >
        <CardContent className="space-y-3 p-4 sm:p-5">
          {/* Header: date (bold, left) + mood icon (right) */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-base sm:text-lg font-bold text-foreground">
              {displayDate}
            </h3>
            {moodInfo && (
              <div className={`flex items-center gap-1.5 shrink-0 ${moodInfo.color}`}>
                <moodInfo.Icon className="h-5 w-5" />
                <span className="text-xs font-medium hidden sm:inline">{moodInfo.label}</span>
              </div>
            )}
          </div>

          {/* Tag pills + context inline */}
          <div className="flex items-center gap-2 flex-wrap">
            {entry.tags.map((tag) => {
              const TagIcon = getTagIcon(tag);
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary"
                >
                  {TagIcon && <TagIcon className="h-3 w-3" />}
                  {tag}
                </span>
              );
            })}
            <AutoContextInline context={context ?? null} />
          </div>

          {/* Content preview */}
          {truncatedContent && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed whitespace-pre-line">
              {renderBoldText(truncatedContent)}
            </p>
          )}

          {/* Photo thumbnails as small circles */}
          {entry.photos.length > 0 && (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {entry.photos.slice(0, 4).map((photo) => {
                const isPdf = photo.url.includes("#pdf") || photo.mimeType === "application/pdf";
                const isVideo = photo.url.includes("#video") || (photo.mimeType?.startsWith("video/") ?? false);
                const lightboxPhotos = entry.photos.filter(p => !p.url.includes("#pdf") && p.mimeType !== "application/pdf");
                const lightboxIdx = isPdf ? -1 : lightboxPhotos.findIndex(p => p.id === photo.id);
                const slug = photo.url.match(/\/share\/([^#/]+)/)?.[1];
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => isPdf ? window.open(photo.url.replace("#pdf", ""), "_blank") : setLightboxIndex(lightboxIdx)}
                    className="relative h-8 w-8 overflow-hidden rounded-full bg-muted ring-2 ring-background hover:ring-primary/30 transition-all shrink-0"
                  >
                    {isPdf ? (
                      <div className="flex items-center justify-center w-full h-full">
                        <FileText className="h-4 w-4 text-red-400" />
                      </div>
                    ) : isVideo ? (
                      <>
                        {slug ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/share/${slug}/thumb`}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-3 w-3 text-white fill-white" />
                        </div>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.url}
                        alt={photo.caption || ""}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </button>
                );
              })}
              {entry.photos.length > 4 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-background">
                  +{entry.photos.length - 4}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={entry.photos.filter(p => !p.url.includes("#pdf") && p.mimeType !== "application/pdf").map(p => ({
            ...p,
            isVideo: p.url.includes("#video") || (p.mimeType?.startsWith("video/") ?? false),
          }))}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
