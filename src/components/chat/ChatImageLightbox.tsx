"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ImagePreviewContext = createContext<(src: string) => void>(() => {});

export function useImagePreview() {
  return useContext(ImagePreviewContext);
}

export function ChatImagePreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(null);
  return (
    <ImagePreviewContext.Provider value={setSrc}>
      {children}
      <ChatImageLightbox src={src} onClose={() => setSrc(null)} />
    </ImagePreviewContext.Provider>
  );
}

interface ChatImageLightboxProps {
  src: string | null;
  onClose: () => void;
}

export function ChatImageLightbox({ src, onClose }: ChatImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger enter animation after mount
  useEffect(() => {
    if (!src) {
      setVisible(false);
      return;
    }
    // Next tick so the transition runs
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [src]);

  // ESC key close
  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Lock body scroll while open
  useEffect(() => {
    if (!src) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [src]);

  function handleClose() {
    setVisible(false);
    // Wait for transition before unmounting
    window.setTimeout(onClose, 180);
  }

  if (!mounted || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        backgroundColor: visible ? "rgba(0,0,0,0.92)" : "rgba(0,0,0,0)",
        transition: "background-color 180ms ease-out",
      }}
      onClick={handleClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative max-h-[92vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.96)",
          transition: "opacity 180ms ease-out, transform 180ms ease-out",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="max-h-[92vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
