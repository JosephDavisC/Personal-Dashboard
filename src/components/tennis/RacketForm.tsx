"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Camera } from "lucide-react";
import { compressImageClient } from "@/lib/compress-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface RacketFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRacket?: Record<string, unknown> | null;
}

interface ExistingPhoto {
  id: string;
  url: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-1 pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function RacketForm({ open, onOpenChange, editingRacket }: RacketFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingRacket;
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [dateOpen, setDateOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    model: "",
    headSize: "",
    weight: "",
    pattern: "",
    balance: "",
    swingWeight: "",
    currentString: "",
    tension: "",
    lastStrung: "",
    notes: "",
  });

  useEffect(() => {
    if (open && editingRacket) {
      setForm({
        name: (editingRacket.name as string) ?? "",
        brand: (editingRacket.brand as string) ?? "",
        model: (editingRacket.model as string) ?? "",
        headSize: editingRacket.headSize ? String(editingRacket.headSize) : "",
        weight: editingRacket.weight ? String(editingRacket.weight) : "",
        pattern: (editingRacket.pattern as string) ?? "",
        balance: editingRacket.balance ? String(editingRacket.balance) : "",
        swingWeight: editingRacket.swingWeight ? String(editingRacket.swingWeight) : "",
        currentString: (editingRacket.currentString as string) ?? "",
        tension: (editingRacket.tension as string) ?? "",
        lastStrung: editingRacket.lastStrung
          ? new Date(editingRacket.lastStrung as string).toISOString().split("T")[0]!
          : "",
        notes: (editingRacket.notes as string) ?? "",
      });
      const photos = editingRacket.photos as ExistingPhoto[] | undefined;
      setExistingPhotos(photos ?? []);
    } else if (open) {
      setForm({ name: "", brand: "", model: "", headSize: "", weight: "", pattern: "", balance: "", swingWeight: "", currentString: "", tension: "", lastStrung: "", notes: "" });
      setExistingPhotos([]);
    }
    if (open) {
      setSelectedFiles([]);
      setPreviews([]);
      setRemovedPhotoIds([]);
    }
  }, [open, editingRacket]);

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p));
  }, [previews]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        brand: form.brand,
        model: form.model,
        headSize: form.headSize ? Number(form.headSize) : null,
        weight: form.weight ? Number(form.weight) : null,
        pattern: form.pattern || null,
        balance: form.balance ? Number(form.balance) : null,
        swingWeight: form.swingWeight ? Number(form.swingWeight) : null,
        currentString: form.currentString || null,
        tension: form.tension || null,
        lastStrung: form.lastStrung || null,
        notes: form.notes || null,
      };

      const url = isEditing ? `/api/tennis/rackets/${editingRacket!.id}` : "/api/tennis/rackets";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }

      let racketId: string;
      if (isEditing) {
        racketId = editingRacket!.id as string;
      } else {
        const { data: racket } = (await res.json()) as { data: { id: string } };
        racketId = racket.id;
      }

      for (const photoId of removedPhotoIds) {
        await fetch(`/api/tennis/rackets/${racketId}/photos/${photoId}`, { method: "DELETE" }).catch(() => {});
      }

      if (selectedFiles.length > 0) {
        for (let file of selectedFiles) {
          file = await compressImageClient(file);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", `Racket: ${form.name}`);
          formData.append("tags", JSON.stringify(["tennis"]));

          const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
          if (!mediaRes.ok) continue;
          const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };

          await fetch(`/api/tennis/rackets/${racketId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: `/api/media/share/${media.data.shareSlug}`,
              mediaId: media.data.id,
            }),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-rackets"] });
      toast.success(isEditing ? "Racket updated" : "Racket added");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function addFiles(files: File[]) {
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]!);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingPhoto(photoId: string) {
    setRemovedPhotoIds((prev) => [...prev, photoId]);
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  const allImages = [
    ...existingPhotos.map((p) => ({ type: "existing" as const, id: p.id, src: p.url })),
    ...previews.map((src, i) => ({ type: "new" as const, id: String(i), src })),
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Racket" : "Add Racket"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Racket Info */}
          <SectionLabel>Racket Info</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nickname *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Match Setup, Daily Driver" className="text-base sm:text-sm" required />
              <p className="text-xs text-muted-foreground">Your label for this setup</p>
            </div>
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Babolat, Wilson, Head" className="text-base sm:text-sm" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Model *</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="e.g. Pure Aero 2023, Clash 100" className="text-base sm:text-sm" required />
          </div>

          {/* Specs */}
          <SectionLabel>Specs (optional)</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Head Size (sq in)</Label>
              <Input type="number" step="0.5" value={form.headSize} onChange={(e) => setForm({ ...form, headSize: e.target.value })} className="text-base sm:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (g)</Label>
              <Input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="text-base sm:text-sm" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Pattern</Label>
              <Input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder="16x19" className="text-base sm:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Balance (mm)</Label>
              <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="text-base sm:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Swing Weight</Label>
              <Input type="number" value={form.swingWeight} onChange={(e) => setForm({ ...form, swingWeight: e.target.value })} className="text-base sm:text-sm" />
            </div>
          </div>

          {/* Current String */}
          <SectionLabel>Current String</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>String Name</Label>
              <Input value={form.currentString} onChange={(e) => setForm({ ...form, currentString: e.target.value })} placeholder="e.g. Poly Tour Pro 125" className="text-base sm:text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Tension</Label>
              <Input value={form.tension} onChange={(e) => setForm({ ...form, tension: e.target.value })} placeholder="55/55" className="text-base sm:text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Last Strung</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left text-base sm:text-sm font-normal",
                    !form.lastStrung && "text-muted-foreground"
                  )}
                >
                  {form.lastStrung ? format(parseISO(form.lastStrung), "MMM d, yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.lastStrung ? parseISO(form.lastStrung) : undefined}
                  onSelect={(d) => {
                    if (d) {
                      setForm({ ...form, lastStrung: format(d, "yyyy-MM-dd") });
                      setDateOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <SectionLabel>Notes</SectionLabel>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes about this racket..." className="text-base sm:text-sm" rows={2} />

          {/* Photos — 80px thumbnails */}
          <SectionLabel>Photos</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {allImages.map((img) => (
              <div key={`${img.type}-${img.id}`} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => img.type === "existing" ? removeExistingPhoto(img.id) : removeFile(Number(img.id))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:bg-accent/50"
            >
              {allImages.length === 0 ? (
                <Camera className="h-5 w-5" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) addFiles(files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEditing ? "Update" : "Add Racket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
