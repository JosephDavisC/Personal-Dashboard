import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openThumbnail } from "@/lib/media-storage";
import { auth } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const file = await prisma.mediaFile.findUnique({
    where: { shareSlug: slug },
    select: { thumbnail: true, isPublic: true, password: true },
  });

  if (!file?.thumbnail) {
    return NextResponse.json({ error: "No thumbnail" }, { status: 404 });
  }

  // Owner bypass — authenticated user can see any thumbnail
  const session = await auth();
  if (!session?.user && !file.isPublic && !file.password) {
    return NextResponse.json({ error: "Private" }, { status: 403 });
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
