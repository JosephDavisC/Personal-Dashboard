import { randomBytes, createHash } from "crypto";
import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  unlinkSync,
  statSync,
  renameSync,
} from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { join, extname } from "path";
import { MEDIA_UPLOAD_DIR, MEDIA_THUMBS_DIR } from "./constants";
import { deleteMediaFile, deleteStoredThumbnail } from "./media-storage";

/** Ensure media directories exist */
export function ensureMediaDirs() {
  if (!existsSync(MEDIA_UPLOAD_DIR))
    mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
  if (!existsSync(MEDIA_THUMBS_DIR))
    mkdirSync(MEDIA_THUMBS_DIR, { recursive: true });
}

/** Generate 8-char URL-safe share slug */
export function generateShareSlug(): string {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

/** Generate unique stored filename */
export function generateStoredName(originalFilename: string): string {
  const ext = extname(originalFilename).toLowerCase();
  const id = randomBytes(16).toString("hex");
  return `${id}${ext}`;
}

/** Store password as plaintext (single-user dashboard, no need to hash) */
export function hashPassword(password: string): string {
  return password;
}

/** Verify password — supports both plaintext and legacy SHA-256 hashes */
export function verifyPassword(password: string, stored: string): boolean {
  // Direct plaintext comparison (new passwords)
  if (password === stored) return true;
  // Legacy: SHA-256 hash comparison (old passwords)
  return createHash("sha256").update(password).digest("hex") === stored;
}

/** Save uploaded file to disk by streaming */
export async function saveFile(
  file: File,
  storedName: string
): Promise<string> {
  ensureMediaDirs();
  const filePath = join(MEDIA_UPLOAD_DIR, storedName);
  const nodeStream = Readable.fromWeb(
    file.stream() as import("stream/web").ReadableStream
  );
  const writable = createWriteStream(filePath);
  await pipeline(nodeStream, writable);
  return filePath;
}

/** Delete a media file from the configured storage (disk or R2) */
export function deleteFile(storedName: string): Promise<void> {
  return deleteMediaFile(storedName);
}

/** Delete a thumbnail from the configured storage (disk or R2) */
export function deleteThumbnail(thumbName: string): Promise<void> {
  return deleteStoredThumbnail(thumbName);
}

/** Determine media category from MIME type */
export function getMediaCategory(
  mimeType: string
): "video" | "image" | "document" {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "document";
}

/** Generate video thumbnail at 2s mark */
export function generateVideoThumbnail(storedName: string): string | null {
  const inputPath = join(MEDIA_UPLOAD_DIR, storedName);
  const thumbName = storedName.replace(/\.[^.]+$/, ".jpg");
  const thumbPath = join(MEDIA_THUMBS_DIR, thumbName);
  try {
    execSync(
      `ffmpeg -i "${inputPath}" -ss 2 -vframes 1 -vf scale=640:-1 -y "${thumbPath}"`,
      { timeout: 30_000, stdio: "ignore" }
    );
    return existsSync(thumbPath) ? thumbName : null;
  } catch {
    return null;
  }
}

/** Generate PDF thumbnail (first page, 640px wide) using pdftoppm */
export function generatePdfThumbnail(storedName: string): string | null {
  const inputPath = join(MEDIA_UPLOAD_DIR, storedName);
  const baseName = storedName.replace(/\.[^.]+$/, "_thumb");
  const thumbPath = join(MEDIA_THUMBS_DIR, baseName);
  try {
    // pdftoppm outputs {baseName}-{pageNum}.jpg — we want first page only
    execSync(
      `pdftoppm -jpeg -f 1 -l 1 -scale-to-x 640 -scale-to-y -1 "${inputPath}" "${thumbPath}"`,
      { timeout: 15_000, stdio: "ignore" }
    );
    // pdftoppm appends "-1" for the first page
    const outputName = `${baseName}-1.jpg`;
    const outputPath = join(MEDIA_THUMBS_DIR, outputName);
    return existsSync(outputPath) ? outputName : null;
  } catch {
    return null;
  }
}

/** Generate image thumbnail (640px wide) */
export function generateImageThumbnail(storedName: string): string | null {
  const inputPath = join(MEDIA_UPLOAD_DIR, storedName);
  const thumbName = storedName.replace(/\.[^.]+$/, "_thumb.jpg");
  const thumbPath = join(MEDIA_THUMBS_DIR, thumbName);
  try {
    execSync(
      `ffmpeg -i "${inputPath}" -vf scale=640:-1 -y "${thumbPath}"`,
      { timeout: 15_000, stdio: "ignore" }
    );
    return existsSync(thumbPath) ? thumbName : null;
  } catch {
    return null;
  }
}

/** Extract video metadata via ffprobe */
export function getVideoMetadata(storedName: string): {
  duration?: number;
  width?: number;
  height?: number;
} {
  const inputPath = join(MEDIA_UPLOAD_DIR, storedName);
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`,
      { timeout: 15_000 }
    ).toString();
    const data = JSON.parse(output) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type: string;
        width?: number;
        height?: number;
      }>;
    };
    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    return {
      duration: data.format?.duration
        ? parseFloat(data.format.duration)
        : undefined,
      width: videoStream?.width ?? undefined,
      height: videoStream?.height ?? undefined,
    };
  } catch {
    return {};
  }
}

/** Get image dimensions via ffprobe */
export function getImageDimensions(storedName: string): {
  width?: number;
  height?: number;
} {
  const inputPath = join(MEDIA_UPLOAD_DIR, storedName);
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`,
      { timeout: 10_000 }
    ).toString();
    const data = JSON.parse(output) as {
      streams?: Array<{ width?: number; height?: number }>;
    };
    const stream = data.streams?.[0];
    return {
      width: stream?.width ?? undefined,
      height: stream?.height ?? undefined,
    };
  } catch {
    return {};
  }
}

/** Max dimension for compressed images */
const COMPRESS_MAX_DIMENSION = 2048;
const COMPRESS_QUALITY = 80;

/**
 * Compress a video file in-place using ffmpeg.
 * H.264 + AAC, CRF 28, capped at 1080p, fast preset.
 * Keeps original if compressed version is larger.
 * Returns the new file size in bytes.
 */
export function compressVideo(storedName: string): number {
  const filePath = join(MEDIA_UPLOAD_DIR, storedName);
  const tmpPath = `${filePath}.compressed.mp4`;
  const originalSize = statSync(filePath).size;

  try {
    execSync(
      `ffmpeg -i "${filePath}" -c:v libx264 -preset fast -crf 28 -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease" -c:a aac -b:a 128k -movflags +faststart -y "${tmpPath}"`,
      { timeout: 300_000, stdio: "ignore" }
    );

    if (!existsSync(tmpPath)) return originalSize;

    const compressedSize = statSync(tmpPath).size;

    if (compressedSize < originalSize) {
      renameSync(tmpPath, filePath);
      return compressedSize;
    } else {
      unlinkSync(tmpPath);
      return originalSize;
    }
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    console.error("Video compression failed, keeping original:", err);
    return originalSize;
  }
}

/**
 * Compress an image file in-place using sharp.
 * Returns the new file size in bytes.
 * Skips GIFs (animated). Falls back to original on error.
 */
export async function compressImage(
  storedName: string,
  mimeType: string
): Promise<number> {
  if (mimeType === "image/gif") {
    return statSync(join(MEDIA_UPLOAD_DIR, storedName)).size;
  }

  const filePath = join(MEDIA_UPLOAD_DIR, storedName);
  const tmpPath = `${filePath}.tmp`;

  try {
    const sharp = (await import("sharp")).default;

    let pipeline = sharp(filePath)
      .rotate() // auto-rotate based on EXIF
      .resize(COMPRESS_MAX_DIMENSION, COMPRESS_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });

    if (mimeType === "image/png") {
      pipeline = pipeline.png({ compressionLevel: 9, effort: 6 });
    } else if (mimeType === "image/webp") {
      pipeline = pipeline.webp({ quality: COMPRESS_QUALITY });
    } else {
      // JPEG and anything else
      pipeline = pipeline.jpeg({ quality: COMPRESS_QUALITY, mozjpeg: true });
    }

    await pipeline.toFile(tmpPath);

    // Only keep compressed version if it's actually smaller
    const originalSize = statSync(filePath).size;
    const compressedSize = statSync(tmpPath).size;

    if (compressedSize < originalSize) {
      renameSync(tmpPath, filePath);
      return compressedSize;
    } else {
      unlinkSync(tmpPath);
      return originalSize;
    }
  } catch (err) {
    // Clean up tmp file on error
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    console.error("Image compression failed, keeping original:", err);
    return statSync(filePath).size;
  }
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format duration for display */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
