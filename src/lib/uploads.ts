const IMG_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);
const VID_EXT = new Set(["mp4", "webm", "mov", "m4v", "mpeg", "mpg"]);

/** Dosya başına üst sınır (adet sınırı yok). */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function validateFileSize(file: File, kind: "photo" | "video"): string | null {
  const max = kind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    return `${kind === "photo" ? "Fotoğraf" : "Video"} en fazla ${formatMegabytes(max)} olabilir.`;
  }
  return null;
}

export function validateImageFile(file: File): string | null {
  const sizeErr = validateFileSize(file, "photo");
  if (sizeErr) return sizeErr;
  const ext = extOf(file.name);
  if (!IMG_EXT.has(ext)) {
    return "Yalnızca JPG, PNG, GIF, WebP veya iPhone (HEIC/HEIF) yükleyebilirsiniz. HEIC otomatik JPEG'e dönüştürülür.";
  }
  if (file.type && !file.type.startsWith("image/")) {
    return "Bu dosya görsel olarak algılanmadı.";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  const sizeErr = validateFileSize(file, "video");
  if (sizeErr) return sizeErr;
  const ext = extOf(file.name);
  if (!VID_EXT.has(ext)) {
    return "Yalnızca MP4, WebM veya MOV yükleyebilirsiniz.";
  }
  if (file.type && !file.type.startsWith("video/")) {
    return "Bu dosya video olarak algılanmadı.";
  }
  return null;
}
