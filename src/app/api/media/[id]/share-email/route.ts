import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { shareEmailSchema } from "@/lib/validations/media";
import { sendAndLogEmail } from "@/lib/email";
import { buildMediaShareEmail } from "@/lib/email-templates";
import { CDN_BASE_URL } from "@/lib/constants";
import { formatFileSize, getMediaCategory } from "@/lib/media-format";

// Simple in-memory rate limit
let dailySendCount = 0;
let lastResetDate = new Date().toDateString();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  // Rate limit: 20 emails per day
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailySendCount = 0;
    lastResetDate = today;
  }
  if (dailySendCount >= 20) {
    return NextResponse.json(
      { error: "Daily email limit reached (20/day)" },
      { status: 429 }
    );
  }

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = shareEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!file.isPublic && !file.password) {
    return NextResponse.json(
      { error: "File must be public or password-protected to share" },
      { status: 400 }
    );
  }

  const { to, message, sharePassword } = parsed.data;
  const shareUrl = `${CDN_BASE_URL}/${file.shareSlug}`;
  const category = getMediaCategory(file.mimeType);

  let thumbnailUrl: string | undefined;
  if (file.isPublic && !file.password) {
    if (category === "image") {
      thumbnailUrl = `${CDN_BASE_URL}/api/media/share/${file.shareSlug}`;
    } else if (category === "video" && file.thumbnail) {
      thumbnailUrl = `${CDN_BASE_URL}/api/media/share/${file.shareSlug}/thumb`;
    }
  }

  const { subject, html, text } = buildMediaShareEmail({
    senderMessage: message,
    mediaType: category,
    fileName: file.title || file.filename,
    fileSize: formatFileSize(file.size),
    shareUrl,
    hasPassword: !!file.password,
    sharePassword,
    thumbnailUrl,
    expiresAt: file.expiresAt
      ? new Date(file.expiresAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null,
  });

  try {
    await sendAndLogEmail({
      to, subject, html, text,
      type: "media_share",
      preview: `Shared ${file.filename} with ${to}`,
      metadata: { fileId: file.id, fileName: file.filename, shareUrl },
    });
    dailySendCount++;
    return NextResponse.json({ data: { sent: true } });
  } catch (error) {
    console.error("POST /api/media/[id]/share-email error:", error);
    return NextResponse.json(
      { error: "Failed to send email. Check SMTP configuration." },
      { status: 500 }
    );
  }
}
