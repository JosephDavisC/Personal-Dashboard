"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2, ImageIcon, FileText, Play, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoLightbox } from "./PhotoLightbox";
import { getMoodIcon } from "./MoodPicker";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GalleryPhoto {
  id: string;
  url: string;
  caption: string | null;
  mediaId: string | null;
  date: string;
  dateLabel: string;
  mood: string | null;
  entryContent: string | null;
  mimeType: string | null;
  duration: number | null;
}

export function DiaryGallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["diary-gallery"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/diary/gallery?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch gallery");
      return (await res.json()) as { photos: GalleryPhoto[]; nextCursor: string | null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const photos = data?.pages.flatMap((p) => p.photos) ?? [];

  if (isLoading) {
    return (
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="mb-3 aspect-square rounded-lg bg-muted/50 animate-pulse break-inside-avoid"
          />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
          No media yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Add photos or videos to your diary entries to see them here
        </p>
      </div>
    );
  }

  const lightboxPhotos = photos.filter(p => !p.url.includes("#pdf")).map((p) => {
    const mi = getMoodIcon(p.mood);
    return {
      id: p.id,
      url: p.url,
      caption: p.caption || `${p.dateLabel}${mi ? ` - ${mi.label}` : ""}`,
      isVideo: p.url.includes("#video") || p.mimeType?.startsWith("video/"),
    };
  });

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {photos.map((photo, i) => {
          const isPdf = photo.url.includes("#pdf") || photo.mimeType === "application/pdf";
          const isVideo = photo.url.includes("#video") || photo.mimeType?.startsWith("video/");
          const lightboxItems = photos.filter(p => !p.url.includes("#pdf") && p.mimeType !== "application/pdf");
          const lightboxIdx = isPdf ? -1 : lightboxItems.findIndex(p => p.id === photo.id);
          const slug = photo.url.match(/\/share\/([^#/]+)/)?.[1];
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => isPdf ? window.open(photo.url.replace("#pdf", ""), "_blank") : setLightboxIndex(lightboxIdx)}
              className="group relative mb-3 w-full overflow-hidden rounded-lg break-inside-avoid bg-muted"
            >
              {isPdf ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <FileText className="h-10 w-10 text-red-400" />
                  <span className="text-xs text-muted-foreground">PDF</span>
                </div>
              ) : isVideo ? (
                <div className="relative aspect-video">
                  {slug ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/share/${slug}/thumb`}
                      alt={photo.caption || `Video from ${photo.dateLabel}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2">
                    <Film className="h-4 w-4 text-white drop-shadow" />
                  </div>
                  {photo.duration != null && photo.duration > 0 && (
                    <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {formatDuration(photo.duration)}
                    </div>
                  )}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption || `Photo from ${photo.dateLabel}`}
                  className="w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <span className="flex items-center gap-1 text-xs text-white/90 font-medium">
                  {photo.dateLabel}
                  {(() => {
                    const mi = getMoodIcon(photo.mood);
                    return mi ? <mi.Icon className="h-3 w-3" /> : null;
                  })()}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
