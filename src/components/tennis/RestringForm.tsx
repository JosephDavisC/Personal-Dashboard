"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X } from "lucide-react";
import { compressImageClient } from "@/lib/compress-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface RestringPhoto {
  id: string;
  url: string;
  caption: string | null;
  mediaId: string | null;
}

export interface EditingRestring {
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

interface RestringFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  racketId: string;
  racketName: string;
  editingRestring?: EditingRestring | null;
}

export function RestringForm({ open, onOpenChange, racketId, racketName, editingRestring }: RestringFormProps) {
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!editingRestring;

  const [isHybrid, setIsHybrid] = useState(false);
  const [form, setForm] = useState({
    stringName: "",
    stringType: "",
    tension: "",
    crossStringName: "",
    crossStringType: "",
    crossTension: "",
    date: new Date().toISOString().split("T")[0]!,
    notes: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<RestringPhoto[]>([]);
  const [dateOpen, setDateOpen] = useState(false);

  const { data: strings } = useQuery({
    queryKey: ["tennis-strings"],
    queryFn: async () => {
      const res = await fetch("/api/tennis/strings");
      if (!res.ok) throw new Error("Failed to fetch strings");
      const json = await res.json();
      return (json.data ?? []) as Array<{ name: string; type: string }>;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      if (editingRestring) {
        const dateStr = editingRestring.date.split("T")[0] || editingRestring.date;
        setForm({
          stringName: editingRestring.stringName,
          stringType: editingRestring.stringType || "",
          tension: editingRestring.tension,
          crossStringName: editingRestring.crossStringName || "",
          crossStringType: editingRestring.crossStringType || "",
          crossTension: editingRestring.crossTension || "",
          date: dateStr,
          notes: editingRestring.notes || "",
        });
        setIsHybrid(!!editingRestring.crossStringName);
        setExistingPhotos(editingRestring.photos ?? []);
      } else {
        setForm({
          stringName: "",
          stringType: "",
          tension: "",
          crossStringName: "",
          crossStringType: "",
          crossTension: "",
          date: new Date().toISOString().split("T")[0]!,
          notes: "",
        });
        setIsHybrid(false);
        setExistingPhotos([]);
      }
      setSelectedFiles([]);
      setPreviews([]);
    }
  }, [open, editingRestring]);

  // Clean up preview URLs
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p));
  }, [previews]);

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      if (!editingRestring) return;
      const res = await fetch(`/api/tennis/restrings/${editingRestring.id}/photos/${photoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete photo");
    },
    onSuccess: (_data, photoId) => {
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success("Photo deleted");
    },
    onError: () => toast.error("Failed to delete photo"),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        stringName: form.stringName,
        stringType: form.stringType || null,
        tension: form.tension,
        crossStringName: isHybrid ? (form.crossStringName || null) : null,
        crossStringType: isHybrid ? (form.crossStringType || null) : null,
        crossTension: isHybrid ? (form.crossTension || null) : null,
        date: form.date,
        notes: form.notes || null,
      };

      let restringId: string;

      if (isEditing) {
        // PATCH existing restring
        const res = await fetch(`/api/tennis/restrings/${editingRestring.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to update restring");
        }
        restringId = editingRestring.id;
      } else {
        // POST new restring
        const res = await fetch(`/api/tennis/rackets/${racketId}/restrings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to log restring");
        }
        const { data: restring } = (await res.json()) as { data: { id: string } };
        restringId = restring.id;
      }

      // Upload new photos if any
      if (selectedFiles.length > 0) {
        for (let file of selectedFiles) {
          file = await compressImageClient(file);
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", `Restring: ${racketName} - ${form.stringName}`);
          formData.append("tags", JSON.stringify(["tennis"]));

          const mediaRes = await fetch("/api/media", { method: "POST", body: formData });
          if (!mediaRes.ok) continue;
          const media = (await mediaRes.json()) as { data: { id: string; shareSlug: string } };

          await fetch(`/api/tennis/restrings/${restringId}/photos`, {
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
      queryClient.invalidateQueries({ queryKey: ["tennis-restrings", racketId] });
      queryClient.invalidateQueries({ queryKey: ["tennis-strings"] });
      toast.success(
        isEditing
          ? "Restring updated"
          : `Restrung ${racketName} with ${form.stringName} at ${form.tension}`
      );
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleStringNameChange(name: string) {
    const match = strings?.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setForm({ ...form, stringName: name, ...(match ? { stringType: match.type } : {}) });
  }

  function handleCrossStringNameChange(name: string) {
    const match = strings?.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setForm({ ...form, crossStringName: name, ...(match ? { crossStringType: match.type } : {}) });
  }

  function addFiles(files: File[]) {
    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]!);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Restring" : `Restring ${racketName}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          {/* Hybrid toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Different cross string</Label>
            <Switch checked={isHybrid} onCheckedChange={setIsHybrid} />
          </div>

          {/* Mains */}
          <div className="space-y-2">
            <Label>{isHybrid ? "Mains String *" : "String Name *"}</Label>
            <Input
              value={form.stringName}
              onChange={(e) => handleStringNameChange(e.target.value)}
              placeholder="e.g. Poly Tour Pro 125"
              className="text-base sm:text-sm"
              list="string-names"
              required
            />
            <datalist id="string-names">
              {strings?.map((s) => (
                <option key={s.name} value={s.name} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{isHybrid ? "Mains Type" : "String Type"}</Label>
              <Select value={form.stringType} onValueChange={(v) => setForm({ ...form, stringType: v })}>
                <SelectTrigger className="text-base sm:text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="poly">Polyester</SelectItem>
                  <SelectItem value="multi">Multifilament</SelectItem>
                  <SelectItem value="natural">Natural Gut</SelectItem>
                  <SelectItem value="kevlar">Kevlar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isHybrid ? "Mains Tension *" : "Tension *"}</Label>
              <Input
                value={form.tension}
                onChange={(e) => setForm({ ...form, tension: e.target.value })}
                placeholder={isHybrid ? "48" : "48/52"}
                className="text-base sm:text-sm"
                required
              />
            </div>
          </div>

          {/* Cross strings (hybrid only) */}
          {isHybrid && (
            <>
              <div className="space-y-2">
                <Label>Cross String *</Label>
                <Input
                  value={form.crossStringName}
                  onChange={(e) => handleCrossStringNameChange(e.target.value)}
                  placeholder="Wilson NXT 17"
                  className="text-base sm:text-sm"
                  list="string-names-cross"
                  required
                />
                <datalist id="string-names-cross">
                  {strings?.map((s) => (
                    <option key={s.name} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cross Type</Label>
                  <Select value={form.crossStringType} onValueChange={(v) => setForm({ ...form, crossStringType: v })}>
                    <SelectTrigger className="text-base sm:text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poly">Polyester</SelectItem>
                      <SelectItem value="multi">Multifilament</SelectItem>
                      <SelectItem value="natural">Natural Gut</SelectItem>
                      <SelectItem value="kevlar">Kevlar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cross Tension *</Label>
                  <Input
                    value={form.crossTension}
                    onChange={(e) => setForm({ ...form, crossTension: e.target.value })}
                    placeholder="52"
                    className="text-base sm:text-sm"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left text-base sm:text-sm font-normal",
                    !form.date && "text-muted-foreground"
                  )}
                >
                  {form.date ? format(parseISO(form.date), "MMM d, yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.date ? parseISO(form.date) : undefined}
                  onSelect={(d) => {
                    if (d) {
                      setForm({ ...form, date: format(d, "yyyy-MM-dd") });
                      setDateOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes..." className="text-base sm:text-sm" rows={2} />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {/* Existing photos (edit mode) */}
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => deletePhotoMutation.mutate(photo.id)}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {/* New file previews */}
              {previews.map((src, i) => (
                <div key={`new-${i}`} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:bg-accent/50"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
            </div>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Log Restring"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
