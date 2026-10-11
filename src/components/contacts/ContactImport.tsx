"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";
import { parseVCF, type ParsedVCard } from "@/lib/vcf-parser";

interface ContactImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ContactImport({ open, onOpenChange, onImported }: ContactImportProps) {
  const [contacts, setContacts] = useState<ParsedVCard[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseVCF(text);

      if (parsed.length === 0) {
        setError("No contacts found in file. Make sure it's a valid .vcf file exported from Apple Contacts.");
        return;
      }

      setContacts(parsed);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (contacts.length === 0) return;
    setImporting(true);

    try {
      const res = await fetch("/api/contacts-db/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: contacts.map((c) => ({
            name: c.name,
            email: c.email,
            phone: c.phone,
            company: c.company,
            title: c.title,
            notes: c.notes,
            tags: [],
          })),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(err.error);
      }

      const data = (await res.json()) as { data: { imported: number; skipped: number } };
      const { imported, skipped } = data.data;

      if (imported === 0) {
        toast.info(`All ${skipped} contacts already exist`);
      } else {
        toast.success(
          `Imported ${imported} contact${imported > 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ""}`
        );
      }

      setContacts([]);
      onImported();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setContacts([]);
          setError("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Import from Apple Contacts</DialogTitle>
        <DialogDescription>
          Open Apple Contacts, select contacts (or Cmd+A for all), then File
          &rarr; Export &rarr; Export vCard. Upload the .vcf file here.
        </DialogDescription>

        {contacts.length === 0 ? (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="h-8 w-8" />
              <div className="text-center">
                <p className="font-medium">Drop .vcf file here or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports vCard files from Apple Contacts
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".vcf,.vcard"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{contacts.length} contacts detected</span>
            </div>

            {/* Preview list */}
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Email</th>
                    <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Phone</th>
                    <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 30).map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-1.5">
                        <span className="text-foreground">{c.name}</span>
                        {/* Mobile: show details below name */}
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:hidden">
                          {c.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.phone}
                            </span>
                          )}
                          {c.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {c.company}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden truncate px-3 py-1.5 text-muted-foreground sm:table-cell">
                        {c.email || "—"}
                      </td>
                      <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                        {c.phone || "—"}
                      </td>
                      <td className="hidden truncate px-3 py-1.5 text-muted-foreground sm:table-cell">
                        {c.company || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.length > 30 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  ...and {contacts.length - 30} more
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setContacts([]);
                  setError("");
                }}
                className="h-10 sm:h-9"
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing} className="h-10 sm:h-9">
                {importing
                  ? "Importing..."
                  : `Import ${contacts.length} Contact${contacts.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
