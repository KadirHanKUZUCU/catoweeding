import { normalizeGuestImageFile } from "./heicConvert";

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350_000;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel okunamadı."));
    };
    img.src = url;
  });
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Sıkıştırma başarısız."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  const base = name.replace(/\.[^.]+$/i, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Yüklemeden önce fotoğrafı küçültür (depolama tasarrufu). */
export async function compressGuestImageFile(file: File): Promise<File> {
  const normalized = await normalizeGuestImageFile(file);
  if (normalized.type === "image/gif") return normalized;
  if (normalized.size <= SKIP_BELOW_BYTES) return normalized;

  try {
    const img = await loadImageFromFile(normalized);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return normalized;
    ctx.drawImage(img, 0, 0, w, h);
    const out = await canvasToJpegFile(canvas, normalized.name);
    return out.size < normalized.size ? out : normalized;
  } catch {
    return normalized;
  }
}
