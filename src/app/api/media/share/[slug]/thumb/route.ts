import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { existsSync, createReadStream, statSync } from "fs";
import { getThumbPath } from "@/lib/media-utils";
import { Readable } from "stream";
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
