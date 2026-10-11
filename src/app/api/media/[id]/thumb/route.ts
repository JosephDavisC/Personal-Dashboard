import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { openThumbnail } from "@/lib/media-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({
    where: { id },
    select: { thumbnail: true },
  });

  if (!file?.thumbnail) {
    return NextResponse.json({ error: "No thumbnail" }, { status: 404 });
  }

  const thumb = await openThumbnail(file.thumbnail);
  if (!thumb) {
    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  }

  return new Response(thumb.body, {
    headers: {
      "Content-Type": file.thumbnail.endsWith(".png") ? "image/png" : "image/jpeg",
      "Content-Length": String(thumb.size),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
