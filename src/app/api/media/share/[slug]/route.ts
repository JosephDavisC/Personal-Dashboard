import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyPassword } from "@/lib/media-utils";
import { openMediaFile } from "@/lib/media-storage";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const file = await prisma.mediaFile.findUnique({
    where: { shareSlug: slug },
  });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Authenticated users (dashboard owner) can see all files
  const session = await auth();
  const isOwner = !!session?.user;

  // Check expiration (skip for owner)
  if (!isOwner && file.expiresAt && new Date() > file.expiresAt) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Check password protection (skip for owner)
  if (!isOwner && file.password) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`media_auth_${slug}`);
    if (!authCookie || !verifyPassword(authCookie.value, file.password)) {
      return NextResponse.json(
        { error: "Password required", needsPassword: true },
        { status: 401 }
      );
    }
  }

  if (!isOwner && !file.isPublic && !file.password) {
    return NextResponse.json({ error: "This file is private" }, { status: 403 });
  }

  // Views are tracked in the CDN share page (server component), not here
  // This endpoint is hit multiple times per view (Range requests, buffering)

  // Track actual downloads (user clicked Download button)
  const url = new URL(request.url);
  if (url.searchParams.get("dl") === "1") {
    await prisma.mediaFile.update({
      where: { id: file.id },
      data: { downloads: { increment: 1 } },
    });
  }

  const rangeHeader = request.headers.get("range");

  // Handle Range requests for video streaming
  if (rangeHeader) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(parts[0] ?? "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;

    const obj = await openMediaFile(file.storedName, { start, end });
    if (!obj) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });

    return new Response(obj.body, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${obj.start}-${obj.end}/${obj.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(obj.end - obj.start + 1),
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Full file response
  const obj = await openMediaFile(file.storedName);
  if (!obj) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(obj.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
