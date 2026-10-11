import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { updateContactSchema } from "@/lib/validations/contact";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const contact = await prisma.contact.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: contact });
  } catch (err) {
    console.error("Contact PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up linked media file if exists
  if (contact.photoMediaId) {
    try {
      const media = await prisma.mediaFile.findUnique({
        where: { id: contact.photoMediaId },
      });
      if (media) {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "uploads", media.storedName);
        await fs.unlink(filePath).catch(() => {});
        await prisma.mediaFile.delete({ where: { id: media.id } });
      }
    } catch {
      // Best-effort cleanup
    }
  }

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ data: { ok: true } });
}
