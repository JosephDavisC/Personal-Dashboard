import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { openMediaFile } from "@/lib/media-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({ where: { id } });

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only count actual downloads (when user clicks Download button)
  const url = new URL(_request.url);
  if (url.searchParams.get("dl") === "1") {
    await prisma.mediaFile.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });
  }

  const obj = await openMediaFile(file.storedName);
  if (!obj) {
    return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Content-Length": String(obj.size),
    "Cache-Control": "private, max-age=3600",
  };

  // Only set attachment disposition for actual downloads
  if (url.searchParams.get("dl") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(file.filename)}"`;
  }

  return new Response(obj.body, { headers });
}
