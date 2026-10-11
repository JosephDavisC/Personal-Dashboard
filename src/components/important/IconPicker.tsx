"use client";

import { useState, useRef } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImageClient } from "@/lib/compress-image";
import { cn } from "@/lib/utils";

/** Returns true if the icon value is an uploaded image URL */
export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.startsWith("/api/media/") || icon.startsWith("http");
}

const ICON_CATEGORIES: { label: string; icons: string[] }[] = [
  {
    label: "Common",
    icons: [
      "📌", "⭐", "🔥", "💡", "🎯", "📋", "📝", "📎",
      "🔑", "🔒", "💰", "💳", "📧", "📞", "🔔", "⚡",
      "✅", "❗", "⚠️", "🏷️", "📁", "💾", "🗂️", "📊",
    ],
  },
  {
    label: "Work",
    icons: [
      "💼", "🏢", "💻", "🖥️", "⌨️", "📱", "🖨️", "📄",
      "📈", "📉", "🗓️", "⏰", "🤝", "👔", "🎤", "📡",
      "🔧", "⚙️", "🛠️", "🧪", "🔬", "📐", "✏️", "🖊️",
    ],
  },
  {
    label: "School",
    icons: [
      "📚", "🎓", "📖", "🏫", "✍️", "📏", "🔢", "🧮",
      "🗺️", "🌐", "🧠", "💭", "📓", "📔", "📒", "🎒",
      "🔎", "💡", "📣", "🏆", "🥇", "🎪", "🧩", "♟️",
    ],
  },
  {
    label: "Life",
    icons: [
      "🏠", "🚗", "✈️", "🏥", "💊", "🛒", "🍽️", "☕",
      "🎮", "🎵", "🎬", "📷", "🏋️", "🎾", "🧘", "🛌",
      "👨‍👩‍👧", "❤️", "🐱", "🌱", "☀️", "🌙", "🎂", "🎁",
    ],
  },
  {
    label: "Finance",
    icons: [
      "💵", "💴", "💶", "💷", "🏦", "💎", "📦", "🏪",
      "🧾", "💹", "🪙", "🏧", "💲", "📑", "🤑", "🏷️",
    ],
  },
  {
    label: "Tech",
    icons: [
      "🚀", "🤖", "🧬", "🔗", "☁️", "🌐", "🛡️", "🔐",
      "📡", "🖲️", "💿", "🔌", "📲", "🕹️", "🧲", "⚛️",
    ],
  },
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isImage = isImageIcon(value);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const compressed = await compressImageClient(file);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("title", "Topic icon");
      formData.append("tags", JSON.stringify(["important-icon"]));

      const res = await fetch("/api/media", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const media = (await res.json()) as { data: { shareSlug: string } };
      onChange(`/api/media/share/${media.data.shareSlug}`);
    } catch {
      toast.error("Failed to upload icon image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected preview + actions */}
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl overflow-hidden">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="icon" className="h-full w-full object-cover" />
          ) : (
            value || "📌"
          )}
        </div>

        {isImage ? (
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-muted-foreground truncate flex-1">Custom image</span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        ) : (
          <>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type emoji or pick below"
              className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary sm:text-sm"
              maxLength={10}
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </>
        )}
      </div>

      {/* Upload image button */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleImageUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent/30 hover:text-foreground disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
        {uploading ? "Uploading..." : "Upload custom image"}
      </button>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {ICON_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveTab(i)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === i
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Icon grid */}
      <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto rounded-lg border border-border bg-card/50 p-2">
        {ICON_CATEGORIES[activeTab]?.icons.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-md text-lg transition-all hover:bg-accent/50 hover:scale-110",
              value === icon && "bg-primary/15 ring-1 ring-primary/30"
            )}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
