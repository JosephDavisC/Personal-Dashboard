"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

let hasShownSplash = false;

export function SplashScreen() {
  const [visible, setVisible] = useState(() => !hasShownSplash);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!visible) return;
    hasShownSplash = true;

    const fadeTimer = setTimeout(() => setFadeOut(true), 450);
    const removeTimer = setTimeout(() => setVisible(false), 750);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[#1e293b] transition-opacity duration-300",
        fadeOut ? "opacity-0" : "opacity-100"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logo"
        width={80}
        height={80}
        className="rounded-full"
      />
    </div>
  );
}
