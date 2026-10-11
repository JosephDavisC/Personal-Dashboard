import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyPassword, createFileStream, getFileSize } from "@/lib/media-utils";
import { cookies } from "next/headers";
import { Readable } from "stream";

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

  const fileSize = getFileSize(file.storedName);
  const rangeHeader = request.headers.get("range");

  // Handle Range requests for video streaming
  if (rangeHeader) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    const start = parseInt(parts[0] ?? "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createFileStream(file.storedName, start, end);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Full file response
  const stream = createFileStream(file.storedName);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
