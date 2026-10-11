"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  X,
  Download,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Calendar,
  Film,
  Image as ImageIcon,
  FileText,
  Send,
  ShieldCheck,
  Mail,
  Loader2,
  CheckCircle2,
  Camera,
  Upload,
  Sun,
  Moon,
  Star,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatFileSize, formatDuration } from "@/lib/media-format";
import { CDN_BASE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { MediaFile } from "@/generated/prisma/client";
import { SITE } from "@/config/site";

interface MediaDetailPanelProps {
  file: MediaFile | null;
  onClose: () => void;
  onUpdated: () => void;
  onDelete: (file: MediaFile) => void;
}

export function MediaDetailPanel({
  file,
  onClose,
  onUpdated,
  onDelete,
}: MediaDetailPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState<{ email: string; name?: string }[]>([]);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const debouncedEmail = useDebouncedValue(shareEmail, 300);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [thumbKey, setThumbKey] = useState(0);
  const [previewDark, setPreviewDark] = useState(false);
  const [localThumbUrl, setLocalThumbUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Reset state when a different file is opened (keyed on file ID, not reference)
  const fileId = file?.id;
  useEffect(() => {
    if (file) {
      setTitle(file.title || "");
      setDescription(file.description || "");
      setTagsInput(file.tags.join(", "));
      setIsPublic(file.isPublic);
      setPassword("");
      setHasPassword(!!file.password);
      const pw = file.password || "";
      const isLegacyHash = /^[a-f0-9]{64}$/.test(pw);
      setStoredPassword(pw);
      setHasChanges(false);
      setShareEmail("");
      setShareMessage("");
      setSharePassword(isLegacyHash ? "" : pw);
      setEmailSent(false);
      setEmailError("");
      setLocalThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setLightboxOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Contact email autocomplete (searches local contacts DB + Google Contacts)
  useEffect(() => {
    if (!debouncedEmail || debouncedEmail.length < 2 || debouncedEmail.includes("@")) {
      setContactSuggestions([]);
      return;
    }
    const q = encodeURIComponent(debouncedEmail);
    Promise.all([
      fetch(`/api/contacts-db?q=${q}`).then((r) => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/contacts?q=${q}`).then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([local, google]) => {
      const seen = new Set<string>();
      const results: { email: string; name?: string }[] = [];
      // Local contacts first (more relevant)
      for (const c of (local.data ?? []) as { email?: string | null; name?: string }[]) {
        if (c.email && !seen.has(c.email)) {
          seen.add(c.email);
          results.push({ email: c.email, name: c.name });
        }
      }
      // Then Google contacts
      for (const c of (google.data ?? []) as { email: string; name?: string }[]) {
        if (c.email && !seen.has(c.email)) {
          seen.add(c.email);
          results.push({ email: c.email, name: c.name });
        }
      }
      setContactSuggestions(results.slice(0, 8));
    });
  }, [debouncedEmail]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/media/${file!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Update failed");
      }
      return (await res.json()) as { data: MediaFile };
    },
    onSuccess: (result) => {
      setHasPassword(!!result.data.password);
      setStoredPassword(result.data.password || "");
      setSharePassword(result.data.password || "");
      setPassword("");
      onUpdated();
      setHasChanges(false);
      toast.success("Updated");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/media/${file!.id}/share-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: shareEmail,
          message: shareMessage || undefined,
          sharePassword: sharePassword || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Failed to send email");
      }
    },
    onSuccess: () => {
      setEmailSent(true);
      setEmailError("");
      toast.success(`Email sent to ${shareEmail}`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to send email";
      setEmailError(msg);
      toast.error(msg);
    },
  });

  function resetEmailForm() {
    setShareEmail("");
    setShareMessage("");
    setSharePassword("");
    setEmailSent(false);
    setEmailError("");
  }

  const thumbMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      // Create instant local preview
      const previewUrl = URL.createObjectURL(blob);
      setLocalThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return previewUrl;
      });

      const form = new FormData();
      form.append("file", blob, "thumbnail.jpg");
      const res = await fetch(`/api/media/${file!.id}/thumbnail`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Upload failed");
      }
    },
    onSuccess: () => {
      onUpdated();
      setThumbKey((k) => k + 1);
      toast.success("Thumbnail updated");
    },
    onError: (err) => {
      setLocalThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.error(err instanceof Error ? err.message : "Upload failed");
    },
  });

  const thumbDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/media/${file!.id}/thumbnail`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      setLocalThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      onUpdated();
      setThumbKey((k) => k + 1);
      toast.success("Thumbnail removed");
    },
    onError: () => toast.error("Failed to remove thumbnail"),
  });

  const captureFrame = useCallback(() => {
    if (!file) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = `/api/media/${file.id}/download`;

    video.addEventListener("loadeddata", () => {
      video.currentTime = 0;
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) thumbMutation.mutate(blob);
          video.remove();
        },
        "image/jpeg",
        0.85
      );
    });
  }, [file, thumbMutation]);

  // Pin to Important
  const { data: pinnedStatus } = useQuery({
    queryKey: ["pinned-media-status", fileId],
    queryFn: async () => {
      const res = await fetch("/api/important/pin-media");
      const json = (await res.json()) as { data: { id: string; mediaId: string }[] };
      const match = json.data.find((p) => p.mediaId === fileId);
      return match ? { isPinned: true, pinnedId: match.id } : { isPinned: false, pinnedId: null };
    },
    enabled: !!fileId,
  });

  const pinMutation = useMutation({
    mutationFn: async () => {
      if (pinnedStatus?.isPinned && pinnedStatus.pinnedId) {
        await fetch(`/api/important/pin-media/${pinnedStatus.pinnedId}`, { method: "DELETE" });
      } else {
        await fetch("/api/important/pin-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId: fileId }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinned-media-status", fileId] });
      queryClient.invalidateQueries({ queryKey: ["pinned-media"] });
      toast.success(pinnedStatus?.isPinned ? "Unpinned from Important" : "Pinned to Important");
    },
    onError: () => toast.error("Failed to update pin"),
  });

  if (!file) return null;

  const category = file.mimeType.startsWith("video/")
    ? "video"
    : file.mimeType.startsWith("image/")
      ? "image"
      : "document";

  const shareUrl = `${CDN_BASE_URL}/${file.shareSlug}`;
  const directUrl = `${CDN_BASE_URL}/api/media/share/${file.shareSlug}`;

  function handleSave() {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data: Record<string, unknown> = {
      title: title || null,
      description: description || null,
      tags,
      isPublic,
    };

    if (password) data.password = password;

    updateMutation.mutate(data, {
      onSuccess: () => {
        if (password) setHasPassword(true);
      },
    });
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  function getEmbedCode() {
    if (category === "video") {
      return `<video src="${directUrl}" controls></video>`;
    }
    if (category === "image") {
      return `<img src="${directUrl}" alt="${title || file?.filename || ""}" />`;
    }
    return directUrl;
  }

  return (
    <Sheet open={!!file} onOpenChange={(open) => { if (!open && lightboxOpen) return; if (!open) onClose(); }}>
      <SheetContent
        className="w-full overflow-y-auto border-border sm:max-w-lg"
        showCloseButton={false}
        onPointerDownOutside={(e) => { if (lightboxOpen) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (lightboxOpen) e.preventDefault(); }}
      >
        <div className="space-y-6 px-6 pt-6 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">File Details</SheetTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Preview */}
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            {category === "video" && (
              <video
                controls
                playsInline
                className="w-full"
                src={`/api/media/${file.id}/download`}
              />
            )}
            {category === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${file.id}/download`}
                alt={file.title || file.filename}
                className="w-full cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
              />
            )}
            {category === "document" && (
              file.mimeType === "application/pdf" ? (
                <iframe
                  src={`/api/media/${file.id}/download`}
                  className="h-[50vh] w-full"
                  title={file.title || file.filename}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 p-8">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{file.filename}</p>
                </div>
              )
            )}
          </div>

          {/* Thumbnail */}
          {(category === "video" || category === "image") && (() => {
            const hasThumb = !!(localThumbUrl || file.thumbnail);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Thumbnail</Label>
                  <div className="flex gap-1">
                    {category === "video" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={thumbMutation.isPending}
                        onClick={captureFrame}
                      >
                        {thumbMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Camera className="h-3 w-3" />
                        )}
                        Auto-capture
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={thumbMutation.isPending}
                      onClick={() => thumbInputRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </Button>
                    {hasThumb && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                        disabled={thumbDeleteMutation.isPending}
                        onClick={() => thumbDeleteMutation.mutate()}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) thumbMutation.mutate(f);
                    e.target.value = "";
                  }}
                />
                {hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={thumbKey}
                    src={localThumbUrl || `/api/media/${file.id}/thumb?v=${thumbKey}`}
                    alt="Thumbnail"
                    className="w-full rounded-lg border border-border"
                  />
                ) : (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 py-6">
                    <p className="text-xs text-muted-foreground">
                      {category === "video"
                        ? "No thumbnail — click Auto-capture or Upload"
                        : "No thumbnail — click Upload"}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder={file.filename}
                className="mt-1 text-base sm:text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Description
              </Label>
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Add a description..."
                className="mt-1 text-base sm:text-sm"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Tags (comma separated)
              </Label>
              <Input
                value={tagsInput}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="e.g. demo, project, portfolio"
                className="mt-1 text-base sm:text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Sharing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Sharing</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="h-4 w-4 text-green-400" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground">
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={(v) => {
                  setIsPublic(v);
                  setHasChanges(true);
                }}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                {hasPassword ? "Change password" : "Set password (optional)"}
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder={hasPassword ? "Enter new password" : "No password"}
                  className="pr-9 text-base sm:text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {hasPassword && (
                <div className="mt-1.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      Password set
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                      onClick={() => {
                        updateMutation.mutate({ password: null }, {
                          onSuccess: () => {
                            setHasPassword(false);
                            setStoredPassword("");
                            setSharePassword("");
                            setPassword("");
                          },
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  {storedPassword && !/^[a-f0-9]{64}$/.test(storedPassword) && (
                    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                      <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate font-mono text-xs text-foreground">
                        {storedPassword}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 shrink-0 px-1.5"
                        onClick={() => copyText(storedPassword, "Password")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Share URL
              </Label>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="min-w-0 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyText(shareUrl, "Share URL")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Embed Code
              </Label>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Input
                  value={getEmbedCode()}
                  readOnly
                  className="min-w-0 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    copyText(getEmbedCode(), "Embed code")
                  }
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Direct Link
              </Label>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Input
                  value={directUrl}
                  readOnly
                  className="min-w-0 text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyText(directUrl, "Direct link")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Share via Email */}
            <div className="space-y-2 rounded-lg border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-medium text-foreground">Share via Email</Label>
              </div>

              {emailSent ? (
                <div className="space-y-3 py-2 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email sent!</p>
                    <p className="text-xs text-muted-foreground">Sent to {shareEmail}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={resetEmailForm}>
                      Send another
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEmailSent(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {!isPublic && !hasPassword && (
                    <p className="text-xs text-muted-foreground">
                      Make this file public or set a password so the recipient can access it.
                    </p>
                  )}
                  <div className="relative">
                    <Input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => {
                        setShareEmail(e.target.value);
                        setEmailError("");
                        setShowEmailDropdown(true);
                      }}
                      onFocus={() => setShowEmailDropdown(true)}
                      onBlur={() => setTimeout(() => setShowEmailDropdown(false), 200)}
                      placeholder="recipient@example.com"
                      className={`text-base sm:text-sm ${emailError ? "border-red-500" : ""}`}
                    />
                    {showEmailDropdown && contactSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                        {contactSuggestions.map((c) => (
                          <button
                            key={c.email}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setShareEmail(c.email);
                              setContactSuggestions([]);
                              setShowEmailDropdown(false);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              {c.name && c.name !== c.email && (
                                <p className="truncate text-sm text-foreground">{c.name}</p>
                              )}
                              <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-400">{emailError}</p>
                  )}
                  <Textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    className="text-base sm:text-sm"
                    rows={2}
                  />
                  {hasPassword && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Include password in email (optional)
                      </Label>
                      <Input
                        type="text"
                        value={sharePassword}
                        onChange={(e) => setSharePassword(e.target.value)}
                        placeholder="Paste the file password here"
                        className="mt-1 text-base sm:text-sm"
                      />
                    </div>
                  )}
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={!shareEmail.includes("@") || emailMutation.isPending || (!isPublic && !hasPassword)}
                    onClick={() => emailMutation.mutate()}
                  >
                    {emailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {emailMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>

                  {/* Email Preview */}
                  {shareEmail.includes("@") && (
                    <div className="overflow-hidden rounded-lg border border-border/50">
                      {/* Preview mode toggle */}
                      <div className="flex items-center justify-between border-b border-border/50 bg-muted/50 px-3 py-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email Preview</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setPreviewDark(!previewDark)}
                        >
                          {previewDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                        </Button>
                      </div>
                      {/* Navy header */}
                      <div className="flex items-center gap-2 bg-[#0f172a] px-3 py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="" className="h-6 w-6 rounded" />
                        <span className="text-[11px] font-medium text-white">{SITE.ownerName}</span>
                      </div>
                      {/* Body */}
                      <div className={`space-y-2 p-3 ${previewDark ? "bg-[#262626]" : "bg-white"}`}>
                        <div>
                          <p className={`text-xs font-medium ${previewDark ? "text-zinc-100" : "text-zinc-900"}`}>
                            {SITE.ownerName} shared {category === "image" ? "an image" : category === "video" ? "a video" : "a file"} with you
                          </p>
                          <p className={`text-[11px] ${previewDark ? "text-zinc-400" : "text-zinc-500"}`}>
                            {title || file.filename} &middot; {formatFileSize(file.size)}
                          </p>
                        </div>
                        {shareMessage && (
                          <div className={`border-l-2 px-2 py-1.5 rounded-r ${previewDark ? "border-zinc-500 bg-[#1a1a1a]" : "border-[#1e293b] bg-zinc-100"}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${previewDark ? "text-zinc-400" : "text-zinc-400"}`}>Message from {SITE.ownerName}</p>
                            <p className={`text-[11px] ${previewDark ? "text-zinc-200" : "text-zinc-700"}`}>{shareMessage}</p>
                          </div>
                        )}
                        {isPublic && !hasPassword && category === "image" && (
                          <div className="text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/media/${file.id}/download`}
                              alt={title || file.filename}
                              className="inline-block max-h-40 rounded-lg border border-zinc-200"
                            />
                          </div>
                        )}
                        {isPublic && !hasPassword && category === "video" && (
                          <div className="text-center">
                            <video
                              src={`/api/media/${file.id}/download`}
                              muted
                              playsInline
                              preload="metadata"
                              className="inline-block max-h-40 rounded-lg border border-zinc-200"
                            />
                          </div>
                        )}
                        <div className="text-center">
                          <span className="inline-block rounded-md bg-blue-500 px-4 py-1.5 text-[11px] font-semibold text-white">
                            View {category === "image" ? "Image" : category === "video" ? "Video" : "File"}
                          </span>
                        </div>
                        {hasPassword && (
                          <div className={`rounded-md px-2 py-1.5 text-center ${previewDark ? "bg-[#1a1a1a]" : "bg-zinc-100"}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide ${previewDark ? "text-zinc-400" : "text-zinc-400"}`}>
                              {sharePassword ? "Password" : "Password Required"}
                            </p>
                            {sharePassword ? (
                              <p className={`mt-0.5 rounded px-2 py-0.5 text-[11px] font-mono font-semibold ${previewDark ? "bg-[#333333] text-zinc-100" : "bg-white text-zinc-900 border border-zinc-200"}`}>
                                {sharePassword}
                              </p>
                            ) : (
                              <p className={`text-[11px] font-mono font-semibold tracking-widest ${previewDark ? "text-zinc-100" : "text-zinc-900"}`}>&bull;&bull;&bull;&bull;</p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div className={`px-3 py-1.5 text-center ${previewDark ? "bg-[#1f1f1f]" : "bg-zinc-50"}`}>
                        <p className={`font-mono text-[10px] ${previewDark ? "text-zinc-500" : "text-zinc-400"}`}>
                          Sent from {SITE.appName}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {hasChanges && (
            <Button onClick={handleSave} className="w-full">
              Save Changes
            </Button>
          )}

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">File name</p>
              <p className="mt-0.5 truncate font-mono text-xs text-foreground">
                {file.filename}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="mt-0.5 text-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="mt-0.5 flex items-center gap-1 text-foreground">
                {category === "video" && <Film className="h-3.5 w-3.5" />}
                {category === "image" && <ImageIcon className="h-3.5 w-3.5" />}
                {category === "document" && (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {file.mimeType}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Uploaded</p>
              <p className="mt-0.5 flex items-center gap-1 text-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(file.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            {file.width && file.height && (
              <div>
                <p className="text-xs text-muted-foreground">Dimensions</p>
                <p className="mt-0.5 text-foreground">
                  {file.width} x {file.height}
                </p>
              </div>
            )}
            {file.duration != null && (
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="mt-0.5 text-foreground">
                  {formatDuration(file.duration)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Views</p>
              <p className="mt-0.5 flex items-center gap-1 text-foreground">
                <Eye className="h-3.5 w-3.5" />
                {file.views}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Downloads</p>
              <p className="mt-0.5 flex items-center gap-1 text-foreground">
                <Download className="h-3.5 w-3.5" />
                {file.downloads}
              </p>
            </div>
          </div>

          <Separator />

          {/* Pin to Important */}
          <Button
            variant="outline"
            className={cn(
              "w-full gap-1.5",
              pinnedStatus?.isPinned && "border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:text-yellow-400"
            )}
            disabled={pinMutation.isPending}
            onClick={() => pinMutation.mutate()}
          >
            <Star className={cn("h-4 w-4", pinnedStatus?.isPinned && "fill-current")} />
            {pinnedStatus?.isPinned ? "Pinned to Important" : "Pin to Important"}
          </Button>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`/api/media/${file.id}/download?dl=1`}>
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </a>
            </Button>
            <Button
              variant="outline"
              className="text-red-400 hover:text-red-400"
              onClick={() => onDelete(file)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Fullscreen image lightbox — inside SheetContent so Radix doesn't dismiss */}
        {lightboxOpen && category === "image" && (
          <MediaLightbox
            src={`/api/media/${file.id}/download`}
            alt={file.title || file.filename}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function MediaLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 cursor-zoom-out"
      onClick={onClose}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      onPointerDown={(e) => e.stopPropagation()}
      tabIndex={0}
    >
      {/* Desktop: small icon button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 hidden text-white hover:bg-white/10 sm:flex"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
      </Button>
      {/* Mobile: large tappable close bar at top */}
      <button
        type="button"
        className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-center gap-2 bg-black/60 text-white active:bg-white/10 sm:hidden"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      >
        <X className="h-5 w-5" />
        <span className="text-sm font-medium">Close</span>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />
    </div>
  );
}
