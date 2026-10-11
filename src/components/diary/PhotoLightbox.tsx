"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Photo {
  id: string;
  url: string;
  caption?: string | null;
  isVideo?: boolean;
}

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function PhotoLightbox({
  photos,
  currentIndex,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(currentIndex + 1);
  }, [hasNext, currentIndex, onIndexChange]);

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(currentIndex - 1);
  }, [hasPrev, currentIndex, onIndexChange]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
    >
      {/* Desktop: small close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 hidden text-white hover:bg-white/10 sm:flex"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
      </Button>
      {/* Mobile: large tappable close bar */}
      <button
        type="button"
        className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center gap-2 bg-black/60 text-white active:bg-white/10 sm:hidden"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
        <span className="text-sm font-medium">Close</span>
      </button>

      {/* Previous */}
      {hasPrev && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 z-10 text-white hover:bg-white/10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {/* Photo or Video */}
      <div
        className="relative max-h-[85vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {photo.isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={photo.url.replace("#video", "")}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[90vw] w-auto"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.caption || "Diary photo"}
            className="max-h-[85vh] max-w-[90vw] w-auto object-contain"
          />
        )}
      </div>

      {/* Next */}
      {hasNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 z-10 text-white hover:bg-white/10 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      {/* Caption + counter */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        {photo.caption && (
          <p className="mb-2 text-sm text-white/80">{photo.caption}</p>
        )}
        <p className="text-xs text-white/50">
          {currentIndex + 1} / {photos.length}
        </p>
      </div>
    </div>
  );
}
