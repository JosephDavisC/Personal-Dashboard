"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  RefreshCw,
  Users,
  Building2,
  Mail,
  Tag,
  Download,
  Upload,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactCard } from "./ContactCard";
import { ContactDetailModal } from "./ContactDetailModal";
import { ContactForm, type ContactFormData } from "./ContactForm";
import { ContactImport } from "./ContactImport";
import { downloadCSV, toCSV } from "@/lib/csv-export";
import type { Contact } from "@/generated/prisma/client";

const TAG_FILTERS = [
  "all",
  "friend",
  "colleague",
  "recruiter",
  "classmate",
  "mentor",
  "family",
  "professional",
  "other",
];

const EMAIL_FILTERS = [
  { value: "all", label: "All" },
  { value: "has-email", label: "Has email" },
  { value: "no-email", label: "No email" },
];

export function ContactsTracker() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [emailFilter, setEmailFilter] = useState("all");

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts-db");
      const json = (await res.json()) as { data: Contact[] };
      return json.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const res = await fetch("/api/contacts-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create contact");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setFormOpen(false);
      toast.success("Contact created");
    },
    onError: () => toast.error("Failed to create contact"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      const res = await fetch(`/api/contacts-db/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update contact");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setEditingContact(null);
      toast.success("Contact updated");
    },
    onError: () => toast.error("Failed to update contact"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts-db/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedContact(null);
      toast.success("Contact deleted");
    },
    onError: () => toast.error("Failed to delete contact"),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contacts-db/sync", { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync contacts");
      return (await res.json()) as { data: { synced: number; created: number; updated: number; debug?: { savedError: string | null; otherError: string | null; savedCount: number; otherCount: number } } };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const { created, updated, debug } = result.data;
      if (created === 0 && updated === 0) {
        if (debug?.savedError || debug?.otherError) {
          const errors = [debug.savedError, debug.otherError].filter(Boolean).join("; ");
          toast.error(`Sync failed: ${errors}`);
        } else {
          toast.info("No new contacts to sync");
        }
      } else {
        toast.success(`Synced: ${created} new, ${updated} updated`);
      }
    },
    onError: () => toast.error("Failed to sync from Google Contacts"),
  });

  const filtered = useMemo(() => {
    let list = contacts;

    if (tagFilter !== "all") {
      list = list.filter((c) => c.tags.includes(tagFilter));
    }

    if (emailFilter === "has-email") {
      list = list.filter((c) => c.email);
    } else if (emailFilter === "no-email") {
      list = list.filter((c) => !c.email);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      );
    }

    return list;
  }, [contacts, tagFilter, emailFilter, search]);

  function exportCSV() {
    if (contacts.length === 0) return;
    const headers = ["Name", "Email", "Phone", "Company", "Title", "Tags", "Notes"];
    const rows = contacts.map((c) => [
      c.name,
      c.email ?? "",
      c.phone ?? "",
      c.company ?? "",
      c.title ?? "",
      c.tags.join(", "),
      c.notes ?? "",
    ]);
    const csv = toCSV(headers, rows);
    downloadCSV(csv, "contacts.csv");
    toast.success("Contacts exported");
  }

  const hasContacts = contacts.length > 0;

  // Stats
  const totalContacts = contacts.length;
  const withEmail = contacts.filter((c) => c.email).length;
  const companies = new Set(contacts.map((c) => c.company).filter(Boolean)).size;
  const tagged = contacts.filter((c) => c.tags.length > 0).length;

  return (
    <div className="space-y-5 overflow-hidden">
      {hasContacts ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Card className="border-border bg-card">
              <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{totalContacts}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Mail className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{withEmail}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">With email</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                  <Building2 className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{companies}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Companies</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                  <Tag className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{tagged}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Tagged</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, company..."
                className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="h-10 sm:h-8"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="h-10 sm:h-8"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                Sync
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                className="h-10 sm:h-8"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button size="sm" onClick={() => setFormOpen(true)} className="h-10 sm:h-8">
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {/* Tag filter */}
            <div className="overflow-x-auto">
              <div className="flex gap-2 pb-1">
                {TAG_FILTERS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      tagFilter === tag
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {tag === "all" ? "All" : tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Email filter */}
            <div className="flex gap-2">
              {EMAIL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setEmailFilter(f.value)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    emailFilter === f.value
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {filtered.length !== contacts.length && (
                <span className="flex items-center text-xs text-muted-foreground">
                  {filtered.length} of {contacts.length}
                </span>
              )}
            </div>
          </div>

          {/* Contact grid */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No contacts match your search</p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onClick={(c) => setSelectedContact(c)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Empty state — action cards */
        <div className="mx-auto max-w-lg space-y-6 py-12">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-semibold text-foreground">Get started with Contacts</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Import your existing contacts or add them manually
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => setImportOpen(true)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                <Smartphone className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Apple Contacts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Import .vcf file</p>
              </div>
            </button>

            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30 disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                <RefreshCw className={`h-6 w-6 text-emerald-400 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {syncMutation.isPending ? "Syncing..." : "Google Contacts"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Sync from Google</p>
              </div>
            </button>

            <button
              onClick={() => setFormOpen(true)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                <Plus className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Add Manually</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Create a contact</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Import dialog */}
      <ContactImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["contacts"] })}
      />

      {/* Create form */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={null}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      {/* Detail modal */}
      <ContactDetailModal
        contact={selectedContact}
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
        onEdit={(c) => setEditingContact(c)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {/* Edit form */}
      <ContactForm
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        contact={editingContact}
        onSubmit={(data) =>
          editingContact && updateMutation.mutate({ id: editingContact.id, data })
        }
      />
    </div>
  );
}
