import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PasswordForm } from "./PasswordForm";
import { cookies } from "next/headers";
import { verifyPassword } from "@/lib/media-utils";
import { formatFileSize, formatDuration } from "@/lib/media-format";
import { CDN_BASE_URL } from "@/lib/constants";
import type { Metadata } from "next";
import { SITE } from "@/config/site";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const file = await prisma.mediaFile.findUnique({
    where: { shareSlug: slug },
  });

  if (!file || (!file.isPublic && !file.password)) {
    return { title: "Shared File" };
  }

  const title = file.title || file.filename;
  const description = file.description || `Shared via ${SITE.appName}`;
  const category = file.mimeType.startsWith("video/")
    ? "video"
    : file.mimeType.startsWith("image/")
      ? "image"
      : "document";

  // Use thumbnail for videos, direct file for images
  const imageUrl =
    category === "image"
      ? `${CDN_BASE_URL}/api/media/share/${slug}`
      : file.thumbnail
        ? `${CDN_BASE_URL}/api/media/share/${slug}/thumb`
        : undefined;

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE.appName,
      type: category === "video" ? "video.other" : "website",
      ...(imageUrl && {
        images: [
          {
            url: imageUrl,
            ...(file.width && { width: file.width }),
            ...(file.height && { height: file.height }),
          },
        ],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };

  // Add video-specific OG tags
  if (category === "video") {
    metadata.openGraph = {
      ...metadata.openGraph,
      videos: [
        {
          url: `${CDN_BASE_URL}/api/media/share/${slug}`,
          type: file.mimeType,
          ...(file.width && { width: file.width }),
          ...(file.height && { height: file.height }),
        },
      ],
    };
  }

  return metadata;
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;

  const file = await prisma.mediaFile.findUnique({
    where: { shareSlug: slug },
  });

  if (!file) notFound();

  // Check expiration
  if (file.expiresAt && new Date() > file.expiresAt) {
    return (
      <Shell>
        <StatusCard
          icon="clock"
          title="Link Expired"
          description="This shared link has expired and is no longer available."
        />
      </Shell>
    );
  }

  // Check password
  if (file.password) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(`media_auth_${slug}`);
    const isVerified =
      authCookie && verifyPassword(authCookie.value, file.password);

    if (!isVerified) {
      return (
        <Shell>
          <div className="mx-auto w-full max-w-sm">
            <StatusCard
              icon="lock"
              title="Password Protected"
              description="Enter the password to access this file."
            />
            <PasswordForm slug={slug} />
          </div>
        </Shell>
      );
    }
  }

  // Private files without password are inaccessible
  if (!file.isPublic && !file.password) {
    return (
      <Shell>
        <StatusCard
          icon="lock"
          title="Private File"
          description="This file is not publicly available."
        />
      </Shell>
    );
  }

  // Increment views
  await prisma.mediaFile.update({
    where: { id: file.id },
    data: { views: { increment: 1 } },
  });

  const category = file.mimeType.startsWith("video/")
    ? "video"
    : file.mimeType.startsWith("image/")
      ? "image"
      : "document";

  const fileUrl = `/api/media/share/${slug}`;
  const displayTitle = file.title || file.filename;

  return (
    <Shell>
      <div className="mx-auto w-full max-w-4xl">
        {/* Preview */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur-sm">
          {category === "video" && (
            <video
              controls
              playsInline
              className="w-full"
              poster={
                file.thumbnail
                  ? `/api/media/share/${slug}/thumb`
                  : undefined
              }
            >
              <source src={fileUrl} type={file.mimeType} />
              Your browser does not support the video tag.
            </video>
          )}
          {category === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={displayTitle}
              className="mx-auto max-h-[80vh] w-auto"
            />
          )}
          {category === "document" && (
            file.mimeType === "application/pdf" ? (
              <iframe
                src={fileUrl}
                className="h-[80vh] w-full"
                title={displayTitle}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-12 sm:p-16">
                <div className="rounded-2xl bg-white/5 p-6">
                  <svg
                    className="h-16 w-16 text-white/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-white/90">
                  {displayTitle}
                </p>
              </div>
            )
          )}
        </div>

        {/* Info bar */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-white sm:text-xl">
              {displayTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
              <span>{formatFileSize(file.size)}</span>
              {file.width && file.height && (
                <>
                  <span className="text-white/20">&middot;</span>
                  <span>{file.width} &times; {file.height}</span>
                </>
              )}
              {file.duration != null && (
                <>
                  <span className="text-white/20">&middot;</span>
                  <span>{formatDuration(file.duration)}</span>
                </>
              )}
              <span className="text-white/20">&middot;</span>
              <span>{file.mimeType.split("/")[1]?.toUpperCase()}</span>
            </div>
            {file.description && (
              <p className="mt-2 text-sm text-white/50">
                {file.description}
              </p>
            )}
          </div>

          <a
            href={`${fileUrl}?dl=1`}
            download={file.filename}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 active:bg-white/80"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-xs text-white/25">
        Shared via {SITE.appName}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0a0a0f] px-4 py-8 sm:px-6 sm:py-12">
      {/* Subtle gradient backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-600/5 blur-3xl" />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: "lock" | "clock";
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
        {icon === "lock" ? (
          <svg className="h-7 w-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ) : (
          <svg className="h-7 w-7 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-white/50">{description}</p>
    </div>
  );
}
