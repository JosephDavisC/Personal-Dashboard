"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Globe,
  Github,
  Linkedin,
  Mail,
  BookOpen,
  Calendar,
  Code,
  FileText,
  Folder,
  Home,
  Link as LinkIcon,
  Search,
  Settings,
  User,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkForm, type LinkFormData } from "./LinkForm";
import type { Link } from "@/generated/prisma/client";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  github: Github,
  linkedin: Linkedin,
  mail: Mail,
  "book-open": BookOpen,
  calendar: Calendar,
  code: Code,
  "file-text": FileText,
  folder: Folder,
  home: Home,
  link: LinkIcon,
  search: Search,
  settings: Settings,
  user: User,
  video: Video,
};

export function QuickLinks() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [managing, setManaging] = useState(false);

  const { data: links = [] } = useQuery<Link[]>({
    queryKey: ["links"],
    queryFn: async () => {
      const res = await fetch("/api/links");
      const json = (await res.json()) as { data: Link[] };
      return json.data;
    },
    refetchInterval: 5_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: LinkFormData) => {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: Link }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Link added");
    },
    onError: () => toast.error("Failed to add link"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LinkFormData }) => {
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return ((await res.json()) as { data: Link }).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Link updated");
    },
    onError: () => toast.error("Failed to update link"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/links/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Link deleted");
    },
    onError: () => toast.error("Failed to delete link"),
  });

  function handleSubmit(data: LinkFormData) {
    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, data });
    } else {
      createMutation.mutate(data);
    }
    setEditingLink(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Quick Links</h2>
        <div className="flex gap-1">
          {links.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManaging(!managing)}
              className="h-7 text-xs text-muted-foreground"
            >
              {managing ? "Done" : "Edit"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingLink(null);
              setFormOpen(true);
            }}
            className="h-7 text-xs text-muted-foreground"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {links.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="py-6 text-center">
            <p className="text-xs text-muted-foreground/60">
              No links yet. Add your favorite bookmarks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {links.map((link) => {
            const Icon = iconMap[link.icon ?? "globe"] ?? Globe;
            return (
              <div key={link.id} className="relative">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="border-border/60 bg-card transition-all hover:border-border/60 hover:bg-accent/50">
                    <CardContent className="flex items-center gap-2.5 p-3">
                      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                      <span className="truncate text-[15px] font-medium text-foreground">
                        {link.label}
                      </span>
                      <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </CardContent>
                  </Card>
                </a>
                {managing && (
                  <div className="absolute -right-1 -top-1 flex gap-0.5 rounded bg-card p-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground/80"
                      onClick={() => {
                        setEditingLink(link);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-red-400"
                      onClick={() => deleteMutation.mutate(link.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LinkForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        link={editingLink}
      />
    </div>
  );
}
