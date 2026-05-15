const IMG_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);
const VID_EXT = new Set(["mp4", "webm", "mov", "m4v", "mpeg", "mpg"]);

export const MAX_PHOTOS_PER_GUEST = 12;
export const MAX_VIDEOS_PER_GUEST = 3;

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function validateImageFile(file: File): string | null {
  const ext = extOf(file.name);
  if (!IMG_EXT.has(ext)) {
    return "Yalnızca JPG, PNG, GIF, WebP veya iPhone (HEIC/HEIF) yükleyebilirsiniz. HEIC otomatik JPEG’e dönüştürülür.";
  }
  if (file.type && !file.type.startsWith("image/")) {
    return "Bu dosya görsel olarak algılanmadı.";
  }
  return null;
}

export function validateVideoFile(file: File): string | null {
  const ext = extOf(file.name);
  if (!VID_EXT.has(ext)) {
    return "Yalnızca MP4, WebM veya MOV yükleyebilirsiniz.";
  }
  if (file.type && !file.type.startsWith("video/")) {
    return "Bu dosya video olarak algılanmadı.";
  }
  return null;
}
