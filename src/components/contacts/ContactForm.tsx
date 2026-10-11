"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Mail,
  Phone,
  User,
  Briefcase,
  StickyNote,
  X,
  Camera,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, colorForName } from "./ContactCard";
import type { Contact } from "@/generated/prisma/client";

const TAG_OPTIONS = [
  "friend",
  "colleague",
  "recruiter",
  "classmate",
  "mentor",
  "family",
  "professional",
  "other",
];

export interface ContactFormData {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  notes?: string | null;
  tags: string[];
  photoUrl?: string | null;
  photoMediaId?: string | null;
}

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSubmit: (data: ContactFormData) => void;
}

export function ContactForm({ open, onOpenChange, contact, onSubmit }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMediaId, setPhotoMediaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (contact) {
        setName(contact.name);
        setEmail(contact.email ?? "");
        setPhone(contact.phone ?? "");
        setCompany(contact.company ?? "");
        setTitle(contact.title ?? "");
        setNotes(contact.notes ?? "");
        setTags(contact.tags);
        setPhotoUrl(contact.photoUrl ?? null);
        setPhotoMediaId(contact.photoMediaId ?? null);
      } else {
        setName("");
        setEmail("");
        setPhone("");
        setCompany("");
        setTitle("");
        setNotes("");
        setTags([]);
        setPhotoUrl(null);
        setPhotoMediaId(null);
      }
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, contact]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", JSON.stringify(["contact"]));

      const res = await fetch("/api/media", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { data: media } = await res.json();

      setPhotoUrl(`/api/media/share/${media.shareSlug}`);
      setPhotoMediaId(media.id);
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      title: title.trim() || null,
      notes: notes.trim() || null,
      tags,
      photoUrl,
      photoMediaId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-lg"
        showCloseButton={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
          <DialogDescription>{contact ? "Edit contact details" : "Add a new contact"}</DialogDescription>
        </VisuallyHidden.Root>

        <div className="flex items-center justify-between px-4 pt-3 md:px-6 md:pt-4">
          <p className="text-sm text-muted-foreground">
            {contact ? "Edit Contact" : "New Contact"}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-4 pb-5 md:px-6 md:pb-6">
          {/* Photo */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={name || "Contact"}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold ${name ? colorForName(name) : "bg-muted text-muted-foreground"}`}
                >
                  {name ? getInitials(name) : <User className="h-5 w-5" />}
                </div>
              )}
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            {photoUrl && (
              <button
                type="button"
                onClick={() => { setPhotoUrl(null); setPhotoMediaId(null); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            )}
          </div>

          {/* Name */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name..."
              className="w-full border-none bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/50 md:text-lg"
            />
          </div>

          <Separator />

          {/* Email + Phone side by side on desktop */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email..."
                type="email"
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone..."
                type="tel"
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>
          </div>

          {/* Company + Title side by side on desktop */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4 shrink-0" />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Job title..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex items-start gap-2 text-muted-foreground">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes..."
              className="w-full resize-none border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
            />
          </div>

          <Separator />

          {/* Tags — larger touch targets */}
          <div>
            <p className="mb-2.5 text-xs font-medium text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    tags.includes(tag)
                      ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            {contact ? "Update" : "Add Contact"}
          </Button>

          <p className="hidden text-center text-xs text-muted-foreground sm:block">
            Press Cmd+Enter to submit
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
