"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compressImageClient } from "@/lib/compress-image";
import { formatInTimeZone } from "date-fns-tz";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MoreHorizontal,
  RotateCcw,
  Pencil,
  Trash2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Cable,
} from "lucide-react";
import { RacketForm } from "./RacketForm";
import { RestringForm } from "./RestringForm";
import { TIMEZONE } from "@/lib/constants";


// ---------- Types ----------

interface RacketPhoto {
  id: string;
  url: string;
  caption: string | null;
  mediaId: string | null;
}

interface RestringPhoto {
  id: string;
  url: string;
  caption: string | null;
  mediaId: string | null;
}

interface RestringData {
  id: string;
  stringName: string;
  stringType: string | null;
  tension: string;
  crossStringName: string | null;
  crossStringType: string | null;
  crossTension: string | null;
  date: string;
  notes: string | null;
  photos?: RestringPhoto[];
}

interface SessionData {
  id: string;
  type: string;
  date: string;
  duration: number | null;
  location: string | null;
}

// ---------- Constants ----------

const brandGradients: Record<string, string> = {
  Babolat: "from-yellow-600/40 via-amber-500/20 to-orange-600/40",
  Wilson: "from-red-600/40 via-red-500/20 to-rose-600/40",
  Head: "from-green-600/40 via-emerald-500/20 to-teal-600/40",
  Yonex: "from-blue-600/40 via-sky-500/20 to-cyan-600/40",
  Prince: "from-indigo-600/40 via-violet-500/20 to-purple-600/40",
  Tecnifibre: "from-cyan-600/40 via-teal-500/20 to-emerald-600/40",
  Dunlop: "from-orange-600/40 via-yellow-500/20 to-amber-600/40",
};
const defaultGradient = "from-zinc-700/40 via-zinc-600/20 to-zinc-500/40";

function getBrandGradient(brand: string | null | undefined): string {
  if (!brand) return defaultGradient;
  return brandGradients[brand] ?? defaultGradient;
}

function getStringHealthColor(days: number | null): string {
  if (days === null) return "bg-muted-foreground";
  if (days <= 45) return "bg-green-400";
  if (days <= 75) return "bg-yellow-400";
  return "bg-red-400";
}

function getStringHealthTextColor(days: number | null): string {
  if (days === null) return "text-muted-foreground";
  if (days <= 45) return "text-green-400";
  if (days <= 75) return "text-yellow-400";
  return "text-red-400";
}

// ---------- RacketCard (Card View) ----------

interface RacketCardProps {
  racket: Record<string, unknown>;
}

export function RacketCard({ racket }: RacketCardProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [restringOpen, setRestringOpen] = useState(false);
  const [editingRestring, setEditingRestring] = useState<RestringData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/tennis/rackets/${racket.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
      toast.success("Racket deleted");
    },
  });

  const photos = (racket.photos as RacketPhoto[]) ?? [];
  const restrings = (racket.restrings as RestringData[]) ?? [];
  const uploadMutation = useRacketPhotoUpload(racket.id as string, photos.length);

  const days = racket.daysSinceStrung as number | null;
  const name = racket.name as string;
  const brand = racket.brand as string;
  const model = racket.model as string;
  const currentString = racket.currentString as string | null;
  const tension = racket.tension as string | null;

  const specsText = [
    typeof racket.headSize === "number" && `${racket.headSize} sq in`,
    typeof racket.weight === "number" && `${racket.weight}g`,
    typeof racket.pattern === "string" && racket.pattern,
  ]
    .filter(Boolean)
    .join(" \u00B7 ");

  return (
    <>
      <div
        className="group rounded-lg border bg-card overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, [role=menuitem], input")) return;
          setDetailOpen(true);
        }}
      >
        {/* Hero photo area */}
        {photos.length > 0 ? (
          <div className="relative w-full aspect-square overflow-hidden bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[0]!.url}
              alt={name}
              className="w-full h-full object-contain"
            />
            {photos.length > 1 && (
              <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                {photos.length}
              </div>
            )}
          </div>
        ) : (
          <button
            className={cn(
              "w-full aspect-square flex flex-col items-center justify-center gap-2",
              "bg-gradient-to-br",
              getBrandGradient(brand),
            )}
            onClick={(e) => {
              e.stopPropagation();
              photoInputRef.current?.click();
            }}
          >
            <span className="text-3xl font-bold text-white/20">
              {brand?.charAt(0) || "?"}
            </span>
            <span className="text-[10px] text-white/30">Tap to add photo</span>
          </button>
        )}

        {/* Card content */}
        <div className="p-3 space-y-1.5">
          {/* Title row */}
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {brand} {model}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Racket
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
                  <Camera className="w-3.5 h-3.5 mr-2" /> Add Photo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* String info */}
          {currentString ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span>🎾</span>
                <span className="truncate">
                  {currentString}
                  {tension && (
                    <span className="text-muted-foreground"> @ {tension}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      getStringHealthColor(days),
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      days !== null && days > 75
                        ? "text-red-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {days === null
                      ? "Unknown"
                      : days === 0
                        ? "Today"
                        : `${days} days`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRestringOpen(true);
                  }}
                >
                  Restring
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No string configured</p>
          )}

          {/* Restring history (compact) */}
          {restrings.length > 0 && (
            <div className="space-y-0 pt-1 border-t border-border/50">
              {restrings.slice(0, 2).map((r, i) => (
                <div key={r.id} className="flex items-center justify-between text-[10px] leading-relaxed">
                  <span className={cn("truncate", i === 0 ? "text-muted-foreground" : "text-muted-foreground/60")}>
                    {r.stringName}
                    {r.tension && ` @ ${r.tension}`}
                  </span>
                  <span className="text-muted-foreground/60 shrink-0 ml-1.5">
                    {formatInTimeZone(new Date(r.date), TIMEZONE, "MMM yy")}
                  </span>
                </div>
              ))}
              {restrings.length > 2 && (
                <p className="text-[10px] text-muted-foreground/50">
                  +{restrings.length - 2} more
                </p>
              )}
            </div>
          )}

          {/* Specs line */}
          {specsText && (
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              {specsText}
            </p>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) uploadMutation.mutate(files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Detail Modal */}
      <RacketDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        racketId={racket.id as string}
        racket={racket}
        onEdit={() => {
          setDetailOpen(false);
          setEditOpen(true);
        }}
        onRestring={() => {
          setDetailOpen(false);
          setEditingRestring(null);
          setRestringOpen(true);
        }}
        onEditRestring={(r) => {
          setDetailOpen(false);
          setEditingRestring(r);
          setRestringOpen(true);
        }}
        onDelete={() => {
          setDetailOpen(false);
          setDeleteOpen(true);
        }}
      />

      <RacketForm open={editOpen} onOpenChange={setEditOpen} editingRacket={racket} />
      <RestringForm
        open={restringOpen}
        onOpenChange={(v) => {
          setRestringOpen(v);
          if (!v) setEditingRestring(null);
        }}
        racketId={racket.id as string}
        racketName={racket.name as string}
        editingRestring={editingRestring}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the racket, its photos, and restring
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------- Shared upload hook ----------

function useRacketPhotoUpload(racketId: string, existingCount: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      let count = 0;
      for (let file of files) {
        file = await compressImageClient(file);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", `Racket photo`);
        formData.append("tags", JSON.stringify(["tennis"]));

        const mediaRes = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        if (!mediaRes.ok) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        const media = (await mediaRes.json()) as {
          data: { id: string; shareSlug: string };
        };

        const photoRes = await fetch(
          `/api/tennis/rackets/${racketId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: `/api/media/share/${media.data.shareSlug}`,
              mediaId: media.data.id,
              order: existingCount + count,
            }),
          },
        );
        if (photoRes.ok) count++;
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
      if (count > 0)
        toast.success(`${count} photo${count > 1 ? "s" : ""} uploaded`);
    },
    onError: () => toast.error("Failed to upload photos"),
  });
}

// ---------- Racket Detail Modal ----------

function RacketDetailModal({
  open,
  onOpenChange,
  racketId,
  racket,
  onEdit,
  onRestring,
  onEditRestring,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  racketId: string;
  racket: Record<string, unknown>;
  onEdit: () => void;
  onRestring: () => void;
  onEditRestring: (r: RestringData) => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const isMobile = useIsMobile(640);

  const name = racket.name as string;
  const brand = racket.brand as string;
  const model = racket.model as string;
  const currentString = racket.currentString as string | null;
  const tension = racket.tension as string | null;
  const lastStrung = racket.lastStrung as string | null;
  const days = racket.daysSinceStrung as number | null;
  const notes = racket.notes as string | null;
  const photos = (racket.photos as RacketPhoto[]) ?? [];

  const uploadMutation = useRacketPhotoUpload(racketId, photos.length);

  // Fetch restring history
  const { data: restrings } = useQuery({
    queryKey: ["tennis-restrings", racketId],
    queryFn: async () => {
      const res = await fetch(`/api/tennis/rackets/${racketId}/restrings`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as RestringData[];
    },
    enabled: open,
  });

  // Fetch sessions with this racket
  const { data: sessions } = useQuery({
    queryKey: ["tennis-racket-sessions", racketId],
    queryFn: async () => {
      const res = await fetch(
        `/api/tennis/sessions?racketId=${racketId}&limit=10`,
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as SessionData[];
    },
    enabled: open,
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(
        `/api/tennis/rackets/${racketId}/photos/${photoId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete photo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
      toast.success("Photo deleted");
      setCurrentPhotoIndex((i) => Math.max(0, i - 1));
    },
  });

  // Notes mutation with debounce
  const notesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const res = await fetch(`/api/tennis/rackets/${racketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: newNotes || null }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
    },
  });

  // Reset photo index when opening or when photos change
  useEffect(() => {
    if (open) setCurrentPhotoIndex(0);
  }, [open]);

  // Clamp index
  const safeIndex = Math.min(currentPhotoIndex, Math.max(0, photos.length - 1));

  const prevPhoto = useCallback(() => {
    setCurrentPhotoIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const nextPhoto = useCallback(() => {
    setCurrentPhotoIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0]!.clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0]!.clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPhoto();
      else prevPhoto();
    }
    setTouchStart(null);
  };

  // Build specs
  const specs = [
    typeof racket.headSize === "number" && {
      label: "Head Size",
      value: `${racket.headSize}`,
      suffix: " sq in",
    },
    typeof racket.weight === "number" && {
      label: "Weight",
      value: `${racket.weight}`,
      suffix: "g",
    },
    typeof racket.pattern === "string" &&
      racket.pattern && { label: "Pattern", value: racket.pattern as string },
    typeof racket.balance === "number" && {
      label: "Balance",
      value: `${racket.balance}`,
      suffix: "mm",
    },
    typeof racket.swingWeight === "number" && {
      label: "Swing Wt",
      value: `${racket.swingWeight}`,
    },
  ].filter(Boolean) as { label: string; value: string; suffix?: string }[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={!isMobile}
        className={cn(
          "overflow-y-auto p-0",
          isMobile
            ? "max-h-[85dvh] rounded-t-xl"
            : "w-full sm:max-w-xl"
        )}
      >
        {/* Drag handle (mobile only) */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        <SheetHeader className="sr-only">
          <SheetTitle>{name}</SheetTitle>
        </SheetHeader>

        {/* Hero photo area */}
        {photos.length > 0 ? (
          <div
            className="relative w-full aspect-[4/3] bg-white"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[safeIndex]!.url}
              alt={name}
              className="w-full h-full object-contain"
            />

            {/* Dot indicators */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === safeIndex ? "bg-foreground" : "bg-foreground/30",
                    )}
                    onClick={() => setCurrentPhotoIndex(i)}
                  />
                ))}
              </div>
            )}

            {/* Arrow buttons (desktop only) */}
            {photos.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white hidden md:flex items-center justify-center hover:bg-black/60"
                  onClick={prevPhoto}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white hidden md:flex items-center justify-center hover:bg-black/60"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Camera button overlay */}
            <button
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60"
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Delete photo button */}
            {photos[safeIndex] && (
              <button
                className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-600/80"
                onClick={() =>
                  deletePhotoMutation.mutate(photos[safeIndex]!.id)
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => photoInputRef.current?.click()}
            className={cn(
              "w-full aspect-[4/3] flex flex-col items-center justify-center gap-3",
              "bg-gradient-to-br",
              getBrandGradient(brand),
              "hover:opacity-80 transition-opacity cursor-pointer",
            )}
          >
            <Camera className="w-8 h-8 text-white/30" />
            <span className="text-sm text-white/40">Add a photo</span>
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) uploadMutation.mutate(files);
            e.target.value = "";
          }}
        />

        {/* Title section */}
        <div className="px-4 pt-3 pb-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{name}</h2>
              <p className="text-sm text-muted-foreground">
                {brand} {model}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onEdit}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Current String section */}
        <div className="mx-4 mt-3 rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current String
          </h4>
          {currentString ? (
            <>
              <div>
                <p className="font-medium text-sm">{currentString}</p>
                {tension && (
                  <p className="text-xs text-muted-foreground">{tension} lbs</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    getStringHealthColor(days),
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    getStringHealthTextColor(days),
                  )}
                >
                  {days === null
                    ? "Unknown"
                    : days === 0
                      ? "Strung today"
                      : `${days} days`}
                </span>
                {lastStrung && (
                  <span className="text-xs text-muted-foreground">
                    &middot;{" "}
                    {formatInTimeZone(
                      new Date(lastStrung),
                      TIMEZONE,
                      "MMM d, yyyy",
                    )}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1"
                onClick={onRestring}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Restring
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No string configured
            </p>
          )}
        </div>

        {/* Specs grid */}
        {specs.length > 0 && (
          <div className="px-4 mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Specs
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="rounded-lg bg-muted/50 p-2.5 text-center"
                >
                  <div className="text-sm font-semibold">
                    {spec.value}
                    {spec.suffix || ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {spec.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restring History */}
        <div className="mt-4 px-4">
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
              <span>
                Restring History ({restrings?.length ?? 0})
              </span>
              <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0 pb-2">
              {restrings && restrings.length > 0 ? (
                restrings.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="block text-sm py-1.5 border-b border-border/50 last:border-0 w-full text-left hover:bg-accent/50 rounded px-1 -mx-1 transition-colors"
                    onClick={() => onEditRestring(r)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="font-medium">{r.stringName}</span>
                        {r.tension && (
                          <span className="text-muted-foreground">
                            {" "}
                            @ {r.tension}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatInTimeZone(
                          new Date(r.date),
                          TIMEZONE,
                          "MMM d, yyyy",
                        )}
                      </span>
                    </div>
                    {r.photos && r.photos.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {r.photos.slice(0, 4).map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={p.id}
                            src={p.url}
                            alt={p.caption || "Restring photo"}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ))}
                        {r.photos.length > 4 && (
                          <div className="h-10 w-10 rounded bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
                            +{r.photos.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No restrings recorded yet
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Sessions with this racket */}
        <div className="px-4">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
              <span>Sessions ({sessions?.length ?? 0})</span>
              <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0 pb-2">
              {sessions && sessions.length > 0 ? (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {s.type}
                      </Badge>
                      <span className="truncate">
                        {formatInTimeZone(
                          new Date(s.date),
                          TIMEZONE,
                          "MMM d, yyyy",
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {s.duration ? `${s.duration}min` : ""}
                      {s.duration && s.location ? " \u00B7 " : ""}
                      {s.location || ""}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No sessions recorded yet
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Notes */}
        <div className="px-4 mt-2 pb-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Notes
          </h4>
          <DebouncedTextarea
            value={notes || ""}
            placeholder="Add notes about this racket..."
            onSave={(value) => notesMutation.mutate(value)}
            className="min-h-[60px] bg-muted/30 border-0 resize-none w-full rounded-lg p-3 text-base sm:text-sm"
          />
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Added{" "}
              {racket.createdAt
                ? formatInTimeZone(
                    new Date(racket.createdAt as string),
                    TIMEZONE,
                    "MMM d, yyyy",
                  )
                : "unknown"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Racket
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Debounced Textarea ----------

function DebouncedTextarea({
  value: initialValue,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync when initial value changes from external source
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(newValue);
    }, 2000);
  };

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={cn(
        "focus:outline-none focus:ring-1 focus:ring-primary/50",
        className,
      )}
    />
  );
}
