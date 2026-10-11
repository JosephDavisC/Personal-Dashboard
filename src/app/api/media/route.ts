import { NextResponse } from "next/server";
import { Readable } from "stream";
import { createWriteStream, unlinkSync } from "fs";
import { join } from "path";
import Busboy from "busboy";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  MEDIA_ACCEPTED_TYPES,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_STORAGE_LIMIT_BYTES,
  MEDIA_STORAGE_LIMIT_GB,
  MEDIA_UPLOAD_DIR,
} from "@/lib/constants";
import {
  generateShareSlug,
  generateStoredName,
  hashPassword,
  ensureMediaDirs,
  deleteFile,
  getMediaCategory,
  generateVideoThumbnail,
  generateImageThumbnail,
  generatePdfThumbnail,
  getVideoMetadata,
  getImageDimensions,
  compressImage,
  compressVideo,
} from "@/lib/media-utils";
import { persistMediaFile, persistThumbnail } from "@/lib/media-storage";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const sort = searchParams.get("sort") || "createdAt";
  const dir = searchParams.get("dir") || "desc";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "50")));

  const where: Prisma.MediaFileWhereInput = {};

  if (type === "video") where.mimeType = { startsWith: "video/" };
  else if (type === "image") where.mimeType = { startsWith: "image/" };
  else if (type === "document") where.mimeType = "application/pdf";

  if (tag === "diary") where.tags = { has: "diary" };
  else if (tag === "task") where.tags = { has: "task" };
  else if (tag === "upload") {
    where.NOT = { OR: [{ tags: { has: "diary" } }, { tags: { has: "task" } }] };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { filename: { contains: search, mode: "insensitive" } },
      { tags: { has: search } },
    ];
  }

  const orderField = ["createdAt", "size", "views", "downloads", "filename"].includes(sort)
    ? sort
    : "createdAt";

  const [files, total, storageResult] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      orderBy: { [orderField]: dir === "asc" ? "asc" : "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mediaFile.count({ where }),
    prisma.mediaFile.aggregate({ _sum: { size: true } }),
  ]);

  return NextResponse.json({
    data: files,
    meta: {
      total,
      page,
      limit,
      storageUsed: storageResult._sum.size ?? 0,
      storageLimit: MEDIA_STORAGE_LIMIT_BYTES,
      storageLimitGB: MEDIA_STORAGE_LIMIT_GB,
    },
  });
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }

  return new Promise<Response>((resolve) => {
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { fileSize: MEDIA_MAX_UPLOAD_BYTES, files: 1 },
    });

    const fields: Record<string, string> = {};
    let uploadedFile: {
      filename: string;
      mimeType: string;
      storedName: string;
      size: number;
    } | null = null;
    let fileError: string | null = null;
    let sizeLimitHit = false;
    let fileWritten: Promise<void> = Promise.resolve();

    busboy.on("file", (fieldname, stream, info) => {
      if (fieldname !== "file") {
        stream.resume();
        return;
      }

      const { filename, mimeType } = info;

      if (!MEDIA_ACCEPTED_TYPES.includes(mimeType as (typeof MEDIA_ACCEPTED_TYPES)[number])) {
        fileError = `File type ${mimeType} is not supported`;
        stream.resume();
        return;
      }

      const storedName = generateStoredName(filename);
      ensureMediaDirs();
      const filePath = join(MEDIA_UPLOAD_DIR, storedName);
      const ws = createWriteStream(filePath);
      // Resolves once every byte is on disk, so processing never reads a partial file
      fileWritten = new Promise((res, rej) => {
        ws.on("finish", () => res());
        ws.on("error", rej);
      });

      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
      });

      stream.on("limit", () => {
        sizeLimitHit = true;
        ws.end();
        try { unlinkSync(filePath); } catch { /* ignore */ }
      });

      stream.pipe(ws);

      stream.on("end", () => {
        if (!sizeLimitHit) {
          uploadedFile = { filename, mimeType, storedName, size };
        }
      });
    });

    busboy.on("field", (fieldname, value) => {
      fields[fieldname] = value;
    });

    busboy.on("finish", async () => {
      try {
        if (fileError) {
          resolve(NextResponse.json({ error: fileError }, { status: 400 }));
          return;
        }
        if (sizeLimitHit) {
          resolve(NextResponse.json({ error: "File exceeds 500MB limit" }, { status: 400 }));
          return;
        }
        if (!uploadedFile) {
          resolve(NextResponse.json({ error: "No file provided" }, { status: 400 }));
          return;
        }
        await fileWritten;

        // Check storage quota
        const storageResult = await prisma.mediaFile.aggregate({ _sum: { size: true } });
        const currentUsage = storageResult._sum.size ?? 0;
        if (currentUsage + uploadedFile.size > MEDIA_STORAGE_LIMIT_BYTES) {
          await deleteFile(uploadedFile.storedName);
          resolve(NextResponse.json({ error: "Storage quota exceeded" }, { status: 400 }));
          return;
        }

        // Generate share slug (retry on collision)
        let shareSlug = generateShareSlug();
        let retries = 0;
        while (retries < 5) {
          const existing = await prisma.mediaFile.findUnique({
            where: { shareSlug },
            select: { id: true },
          });
          if (!existing) break;
          shareSlug = generateShareSlug();
          retries++;
        }

        // Compress media (unless HD mode requested)
        const category = getMediaCategory(uploadedFile.mimeType);
        if (category === "image" && fields.hd !== "true") {
          const compressedSize = await compressImage(uploadedFile.storedName, uploadedFile.mimeType);
          uploadedFile.size = compressedSize;
        } else if (category === "video" && fields.hd !== "true") {
          const compressedSize = compressVideo(uploadedFile.storedName);
          uploadedFile.size = compressedSize;
        }

        // Extract metadata
        let thumbnail: string | null = null;
        let duration: number | undefined;
        let width: number | undefined;
        let height: number | undefined;

        if (category === "video") {
          thumbnail = generateVideoThumbnail(uploadedFile.storedName);
          const meta = getVideoMetadata(uploadedFile.storedName);
          duration = meta.duration;
          width = meta.width;
          height = meta.height;
        } else if (category === "image") {
          thumbnail = generateImageThumbnail(uploadedFile.storedName);
          const dims = getImageDimensions(uploadedFile.storedName);
          width = dims.width;
          height = dims.height;
        } else if (uploadedFile.mimeType === "application/pdf") {
          thumbnail = generatePdfThumbnail(uploadedFile.storedName);
        }

        // Hand the finished file and thumbnail to the configured storage (disk or R2)
        await persistMediaFile(uploadedFile.storedName, uploadedFile.mimeType);
        if (thumbnail) await persistThumbnail(thumbnail);

        // Parse optional fields
        const title = fields.title || null;
        const description = fields.description || null;
        const tagsRaw = fields.tags;
        const tags = tagsRaw ? (JSON.parse(tagsRaw) as string[]) : [];
        const isPublic = fields.isPublic === "true";
        const passwordRaw = fields.password || null;

        const mediaFile = await prisma.mediaFile.create({
          data: {
            filename: uploadedFile.filename,
            storedName: uploadedFile.storedName,
            mimeType: uploadedFile.mimeType,
            size: uploadedFile.size,
            title,
            description,
            tags,
            isPublic,
            password: passwordRaw ? hashPassword(passwordRaw) : null,
            thumbnail,
            duration: duration ?? null,
            width: width ?? null,
            height: height ?? null,
            shareSlug,
          },
        });

        resolve(NextResponse.json({ data: mediaFile }, { status: 201 }));
      } catch (err) {
        console.error("Upload error:", err);
        if (uploadedFile) await deleteFile(uploadedFile.storedName);
        resolve(
          NextResponse.json(
            { error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 }
          )
        );
      }
    });

    busboy.on("error", (err) => {
      console.error("Busboy error:", err);
      resolve(NextResponse.json({ error: "Upload failed" }, { status: 500 }));
    });

    // Stream the request body through busboy
    const nodeStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);
    nodeStream.on("error", (err) => {
      console.error("Stream error:", err);
      resolve(NextResponse.json({ error: "Upload stream failed" }, { status: 500 }));
    });
    nodeStream.pipe(busboy);
  });
}
