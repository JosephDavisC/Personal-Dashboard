"use client";

import { Mail, Phone, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Contact } from "@/generated/prisma/client";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const INITIALS_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-violet-500/20 text-violet-400",
  "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
];

export function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length]!;
}

interface ContactCardProps {
  contact: Contact;
  onClick: (contact: Contact) => void;
}

export function ContactCard({ contact, onClick }: ContactCardProps) {
  return (
    <Card
      className="min-w-0 cursor-pointer overflow-hidden border-border bg-card p-4 transition-colors hover:bg-accent/30"
      onClick={() => onClick(contact)}
    >
      <div className="flex min-w-0 items-start gap-3">
        {/* Avatar */}
        {contact.photoUrl ? (
          <img
            src={contact.photoUrl}
            alt={contact.name}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorForName(contact.name)}`}>
            {getInitials(contact.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Name + title */}
          <p className="truncate font-semibold text-foreground">
            {contact.name}
          </p>
          {(contact.title || contact.company) && (
            <p className="truncate text-xs text-muted-foreground">
              {[contact.title, contact.company].filter(Boolean).join(" at ")}
            </p>
          )}

          {/* Contact info */}
          <div className="mt-2 space-y-1.5">
            {contact.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.company && !contact.title && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.company}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
