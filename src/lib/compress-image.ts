const MAX_DIMENSION = 2048;
const QUALITY = 0.8;

/**
 * Client-side image compression using Canvas API.
 * Resizes to max 2048px and re-encodes as JPEG at 80% quality.
 * Returns the original file unchanged if it's not an image or if compression fails.
 */
export async function compressImageClient(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Skip if already small enough
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 500_000) {
      bitmap.close();
      return file;
    }

    // Calculate new dimensions
    let newWidth = width;
    let newHeight = height;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: QUALITY,
    });

    // Only use compressed version if it's smaller
    if (blob.size >= file.size) {
      return file;
    }

    // Preserve original filename but change extension to .jpg
    const name = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
