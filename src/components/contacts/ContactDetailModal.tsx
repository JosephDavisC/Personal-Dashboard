"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  Building2,
  Briefcase,
  StickyNote,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  Camera,
  Loader2,
} from "lucide-react";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getInitials, colorForName } from "./ContactCard";
import type { Contact } from "@/generated/prisma/client";

interface ContactDetailModalProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}

export function ContactDetailModal({
  contact,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ContactDetailModalProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const photoMutation = useMutation({
    mutationFn: async ({ photoUrl, photoMediaId }: { photoUrl: string | null; photoMediaId: string | null }) => {
      const res = await fetch(`/api/contacts-db/${contact!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl, photoMediaId }),
      });
      if (!res.ok) throw new Error("Failed to update photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", JSON.stringify(["contact"]));

      const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { data: media } = await uploadRes.json();

      await photoMutation.mutateAsync({
        photoUrl: `/api/media/share/${media.shareSlug}`,
        photoMediaId: media.id,
      });
      toast.success("Photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    if (!contact) return;
    await photoMutation.mutateAsync({ photoUrl: null, photoMediaId: null });
    toast.success("Photo removed");
  }

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Contact Details</DialogTitle>
          <DialogDescription>View contact details</DialogDescription>
        </VisuallyHidden.Root>

        {/* Close button */}
        <div className="flex items-center justify-end px-4 pt-3 md:px-6 md:pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        <div className="space-y-5 px-4 pb-5 md:px-6 md:pb-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {contact.photoUrl ? (
                <img
                  src={contact.photoUrl}
                  alt={contact.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${colorForName(contact.name)}`}
                >
                  {getInitials(contact.name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold text-foreground">
                {contact.name}
              </h2>
              {(contact.title || contact.company) && (
                <p className="truncate text-sm text-muted-foreground">
                  {[contact.title, contact.company].filter(Boolean).join(" at ")}
                </p>
              )}
              {contact.photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="mt-1 text-xs text-muted-foreground hover:text-red-400"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <Separator />

          {/* Contact info */}
          <div className="space-y-3">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`mailto:${contact.email}`}
                  className="min-w-0 truncate text-sm text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contact.email}
                </a>
                <a
                  href={`mailto:${contact.email}`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`tel:${contact.phone}`}
                  className="text-sm text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {contact.phone}
                </a>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">{contact.company}</span>
              </div>
            )}
            {contact.title && (
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">{contact.title}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {contact.notes && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Notes</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {contact.notes}
                </p>
              </div>
            </>
          )}

          {/* Tags */}
          {contact.tags.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground/60">
              Added {format(new Date(contact.createdAt), "MMM d, yyyy")}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Updated {format(new Date(contact.updatedAt), "MMM d, yyyy")}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                onEdit(contact);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {contact.name}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      onDelete(contact.id);
                      onOpenChange(false);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
