export function isHeicLikeFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".heic") || n.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif";
}

/** iPhone HEIC → JPEG (tarayıcıda); sunucuya her zaman JPEG gider. */
export async function convertHeicToJpegFile(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0]! : out;
  const base = file.name.replace(/\.[^.]+$/i, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export async function normalizeGuestImageFile(file: File): Promise<File> {
  if (!isHeicLikeFile(file)) return file;
  try {
    return await convertHeicToJpegFile(file);
  } catch {
    throw new Error("HEIC dönüştürülemedi. Dosyayı JPG olarak kaydedip tekrar deneyin.");
  }
}
