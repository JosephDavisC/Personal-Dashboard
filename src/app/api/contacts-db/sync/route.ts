import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { listAllContacts, listOtherContacts } from "@/lib/google-contacts";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  // Fetch both saved contacts and "Other Contacts" (Gmail auto-saved) in parallel
  let savedError: string | null = null;
  let otherError: string | null = null;

  const [savedContacts, otherContacts] = await Promise.all([
    listAllContacts().catch((e: Error) => {
      savedError = e.message;
      console.error("[contacts-sync] listAllContacts error:", e.message);
      return [];
    }),
    listOtherContacts().catch((e: Error) => {
      otherError = e.message;
      console.error("[contacts-sync] listOtherContacts error:", e.message);
      return [];
    }),
  ]);

  console.log(`[contacts-sync] saved: ${savedContacts.length}, other: ${otherContacts.length}`);

  // Deduplicate by resourceName (saved contacts take priority)
  const seen = new Set<string>();
  const allContacts = [];
  for (const c of savedContacts) {
    seen.add(c.resourceName);
    allContacts.push(c);
  }
  for (const c of otherContacts) {
    if (!seen.has(c.resourceName)) {
      seen.add(c.resourceName);
      allContacts.push(c);
    }
  }

  if (allContacts.length === 0) {
    return NextResponse.json({
      data: {
        synced: 0, created: 0, updated: 0,
        debug: { savedError, otherError, savedCount: savedContacts.length, otherCount: otherContacts.length },
      },
    });
  }

  let created = 0;
  let updated = 0;

  for (const gc of allContacts) {
    const existing = await prisma.contact.findUnique({
      where: { googleContactId: gc.resourceName },
    });

    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: gc.name,
          email: gc.email ?? existing.email,
          phone: gc.phone ?? existing.phone,
          company: gc.company ?? existing.company,
          title: gc.title ?? existing.title,
          lastSyncedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.contact.create({
        data: {
          googleContactId: gc.resourceName,
          name: gc.name,
          email: gc.email ?? null,
          phone: gc.phone ?? null,
          company: gc.company ?? null,
          title: gc.title ?? null,
          lastSyncedAt: new Date(),
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    data: { synced: allContacts.length, created, updated },
  });
}
