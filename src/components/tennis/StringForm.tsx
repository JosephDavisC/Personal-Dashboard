"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Cable, ChevronLeft, ChevronRight } from "lucide-react";
import { compressImageClient } from "@/lib/compress-image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StringPhoto {
  id: string;
  url: string;
  mediaId: string | null;
}

interface StringFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingString?: {
    id: string;
    name: string;
    type: string;
    gauge: string | null;
    quantity: number;
    notes: string | null;
    photos?: StringPhoto[];
  } | null;
}

export function StringForm({ open, onOpenChange, editingString }: StringFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingString;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const isMobile = useIsMobile(640);

  const [form, setForm] = useState({
    name: "",
    type: "",
    gauge: "",
    quantity: "1",
    notes: "",
  });
  const [existingPhotos, setExistingPhotos] = useState<StringPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (open && editingString) {
      setForm({
        name: editingString.name,
        type: editingString.type,
        gauge: editingString.gauge ?? "",
        quantity: String(editingString.quantity),
        notes: editingString.notes ?? "",
      });
      setExistingPhotos(editingString.photos ?? []);
      setRemovedPhotoIds([]);
      setSelectedFiles([]);
      setPreviews([]);
      setHeroIndex(0);
    } else if (open) {
      setForm({ name: "", type: "", gauge: "", quantity: "1", notes: "" });
      setExistingPhotos([]);
      setRemovedPhotoIds([]);
      setSelectedFiles([]);
      setPreviews([]);
      setHeroIndex(0);
    }
  }, [open, editingString]);

  // Generate previews for selected files
  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [selectedFiles]);

  const activeExisting = existingPhotos.filter((p) => !removedPhotoIds.includes(p.id));
  const totalPhotos = activeExisting.length + selectedFiles.length;
  const allPhotos = [...activeExisting.map((p) => p.url), ...previews];
  const safeHeroIndex = Math.min(heroIndex, Math.max(0, allPhotos.length - 1));

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 4 - totalPhotos;
    if (files.length > remaining) {
      toast.error(`Max 4 photos. You can add ${remaining} more.`);
    }
    setSelectedFiles((prev) => [...prev, ...files.slice(0, remaining)]);
    e.target.value = "";
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type,
        gauge: form.gauge || null,
        quantity: Number(form.quantity),
        notes: form.notes || null,
      };

      const url = isEditing ? `/api/tennis/strings/${editingString!.id}` : "/api/tennis/strings";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }

      const json = await res.json();
      const stringId = isEditing ? editingString!.id : (json.data?.id as string);

      // Delete removed photos
      for (const photoId of removedPhotoIds) {
        await fetch(`/api/tennis/strings/${stringId}/photos/${photoId}`, { method: "DELETE" });
      }

      // Upload new photos
      for (let file of selectedFiles) {
        file = await compressImageClient(file);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", `String: ${form.name}`);
        formData.append("tags", JSON.stringify(["tennis", "string"]));

        const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
        if (!mediaRes.ok) continue;
        const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };

        await fetch(`/api/tennis/strings/${stringId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `/api/media/share/${media.data.shareSlug}`,
            mediaId: media.data.id,
            order: activeExisting.length,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tennis-strings"] });
      toast.success(isEditing ? "String updated" : "String added to inventory");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        showCloseButton={!isMobile}
        className={cn(
          "overflow-y-auto p-0",
          isMobile
            ? "max-h-[90dvh] rounded-t-xl"
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
          <SheetTitle>{isEditing ? "Edit String" : "Add String"}</SheetTitle>
        </SheetHeader>

        {/* Hero photo area */}
        {allPhotos.length > 0 ? (
          <div className="relative w-full aspect-[4/3] bg-white overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={allPhotos[safeHeroIndex]!}
              alt={form.name || "String"}
              className="w-full h-full object-contain"
            />
            {allPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60"
                  onClick={() => setHeroIndex((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60"
                  onClick={() => setHeroIndex((i) => (i + 1) % allPhotos.length)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                  {allPhotos.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === safeHeroIndex ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60"
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/80 to-muted/30 hover:from-muted to-muted/50 transition-colors"
          >
            <Cable className="w-8 h-8 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Tap to add photo</span>
          </button>
        )}

        <div className="px-4 pt-4 pb-6">
          <h2 className="text-base font-semibold mb-4">{isEditing ? "Edit String" : "Add String"}</h2>

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Poly Tour Pro 125" className="text-base sm:text-sm" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="text-base sm:text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poly">Polyester</SelectItem>
                    <SelectItem value="multi">Multifilament</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="natural">Natural Gut</SelectItem>
                    <SelectItem value="kevlar">Kevlar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Gauge</Label>
                <Input value={form.gauge} onChange={(e) => setForm({ ...form, gauge: e.target.value })} placeholder="1.25mm" className="text-base sm:text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Quantity (sets)</Label>
              <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="text-base sm:text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." className="text-base sm:text-sm" />
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : isEditing ? "Update" : "Add String"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
