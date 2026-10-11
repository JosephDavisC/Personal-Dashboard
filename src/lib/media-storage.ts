// Where uploaded media and thumbnails live once processing is done.
//
//   MEDIA_STORAGE=local (default)  files stay on disk under MEDIA_UPLOAD_DIR
//   MEDIA_STORAGE=r2               files move to a Cloudflare R2 bucket
//
// Uploads are always written and processed on local disk first (sharp, ffmpeg
// and pdftoppm need a real file). persist*() then hands the finished file to
// the configured backend; with R2 the local copy is removed afterwards.
// Every read, stream and delete goes through this module, so callers never
// touch the filesystem or the bucket directly.

import { createReadStream, existsSync, statSync, unlinkSync } from "fs";
import { readFile, stat } from "fs/promises";
import { Readable } from "stream";
import { join } from "path";
import { AwsClient } from "aws4fetch";
import { MEDIA_UPLOAD_DIR, MEDIA_THUMBS_DIR } from "./constants";

type Kind = "file" | "thumb";

export const MEDIA_STORAGE: "local" | "r2" = process.env.MEDIA_STORAGE === "r2" ? "r2" : "local";

export interface StoredObject {
  body: ReadableStream;
  /** Total size of the stored object in bytes */
  size: number;
  /** Byte range actually returned (inclusive) */
  start: number;
  end: number;
}

function localPath(kind: Kind, name: string): string {
  return join(kind === "file" ? MEDIA_UPLOAD_DIR : MEDIA_THUMBS_DIR, name);
}

// ---------------------------------------------------------------- R2 ----

let r2Client: AwsClient | null = null;

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  // R2_ENDPOINT overrides the default, e.g. a jurisdiction endpoint
  // (https://<id>.eu.r2.cloudflarestorage.com) or a local S3-compatible server.
  const endpoint = (process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).replace(/\/$/, "");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "MEDIA_STORAGE=r2 needs R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET"
    );
  }
  r2Client ??= new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  return { client: r2Client, endpoint, bucket };
}

function r2Url(kind: Kind, name: string): string {
  const { endpoint, bucket } = r2Config();
  const key = `${kind === "file" ? "media" : "thumbs"}/${encodeURIComponent(name)}`;
  return `${endpoint}/${bucket}/${key}`;
}

async function r2Fetch(kind: Kind, name: string, init: RequestInit & { duplex?: "half" } = {}) {
  const { client } = r2Config();
  return client.fetch(r2Url(kind, name), init);
}

async function r2Put(kind: Kind, name: string, path: string, contentType: string) {
  const { size } = await stat(path);
  const res = await r2Fetch(kind, name, {
    method: "PUT",
    // Stream from disk instead of buffering: videos can be hundreds of MB
    body: Readable.toWeb(createReadStream(path)) as ReadableStream,
    duplex: "half",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed for ${name}: ${res.status} ${await res.text()}`);
  }
}

// ------------------------------------------------------------ helpers ----

async function persist(kind: Kind, name: string, contentType: string): Promise<void> {
  if (MEDIA_STORAGE === "local") return;
  const path = localPath(kind, name);
  await r2Put(kind, name, path, contentType);
  try { unlinkSync(path); } catch { /* already gone */ }
}

async function read(kind: Kind, name: string): Promise<Buffer | null> {
  if (MEDIA_STORAGE === "local") {
    const path = localPath(kind, name);
    return existsSync(path) ? readFile(path) : null;
  }
  const res = await r2Fetch(kind, name);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 read failed for ${name}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function open(kind: Kind, name: string, range?: { start: number; end?: number }): Promise<StoredObject | null> {
  if (MEDIA_STORAGE === "local") {
    const path = localPath(kind, name);
    if (!existsSync(path)) return null;
    const size = statSync(path).size;
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? size - 1, size - 1);
    const stream = createReadStream(path, { start, end });
    return { body: Readable.toWeb(stream) as ReadableStream, size, start, end };
  }

  const headers: Record<string, string> = {};
  if (range) headers.Range = `bytes=${range.start}-${range.end ?? ""}`;
  const res = await r2Fetch(kind, name, { headers });
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new Error(`R2 read failed for ${name}: ${res.status}`);

  const length = Number(res.headers.get("Content-Length") ?? 0);
  const contentRange = res.headers.get("Content-Range"); // "bytes 0-99/1234"
  if (res.status === 206 && contentRange) {
    const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(contentRange);
    if (m) return { body: res.body, start: Number(m[1]), end: Number(m[2]), size: Number(m[3]) };
  }
  return { body: res.body, size: length, start: 0, end: Math.max(length - 1, 0) };
}

async function remove(kind: Kind, name: string): Promise<void> {
  // Always clear any local copy (covers files uploaded before switching to R2)
  const path = localPath(kind, name);
  if (existsSync(path)) {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
  if (MEDIA_STORAGE === "r2") {
    const res = await r2Fetch(kind, name, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      console.error(`R2 delete failed for ${name}: ${res.status}`);
    }
  }
}

// ---------------------------------------------------------------- API ----

/** Move a fully processed upload to its final home (no-op for local storage). */
export const persistMediaFile = (name: string, contentType: string) => persist("file", name, contentType);
/** Move a generated thumbnail to its final home (no-op for local storage). */
export const persistThumbnail = (name: string) =>
  persist("thumb", name, name.endsWith(".png") ? "image/png" : "image/jpeg");

export const readMediaFile = (name: string) => read("file", name);
export const readThumbnail = (name: string) => read("thumb", name);

/** Open a media file, optionally a byte range of it, for streaming to the client. */
export const openMediaFile = (name: string, range?: { start: number; end?: number }) => open("file", name, range);
export const openThumbnail = (name: string) => open("thumb", name);

export const deleteMediaFile = (name: string) => remove("file", name);
export const deleteStoredThumbnail = (name: string) => remove("thumb", name);

/** Delete a media file and its thumbnail, whatever the backend. */
export async function deleteMediaWithThumbnail(media: { storedName: string; thumbnail: string | null }) {
  await deleteMediaFile(media.storedName);
  if (media.thumbnail) await deleteStoredThumbnail(media.thumbnail);
}
