import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { existsSync, createReadStream, statSync } from "fs";
import { getThumbPath } from "@/lib/media-utils";
import { Readable } from "stream";

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

  const thumbPath = getThumbPath(file.thumbnail);
  if (!existsSync(thumbPath)) {
    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  }

  const size = statSync(thumbPath).size;
  const stream = createReadStream(thumbPath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
