import { normalizeGuestImageFile } from "./heicConvert";

/** Supabase 1 GB için daha agresif sıkıştırma (VITE_FREE_STORAGE_MODE=true). */
function compressSettings() {
  const free = import.meta.env.VITE_FREE_STORAGE_MODE === "true";
  return free
    ? { maxEdge: 1280, quality: 0.72, skipBelow: 250_000 }
    : { maxEdge: 1920, quality: 0.82, skipBelow: 350_000 };
}

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

async function canvasToJpegFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Sıkıştırma başarısız."))),
      "image/jpeg",
      quality,
    );
  });
  const base = name.replace(/\.[^.]+$/i, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Yüklemeden önce fotoğrafı küçültür (depolama tasarrufu). */
export async function compressGuestImageFile(file: File): Promise<File> {
  const { maxEdge, quality, skipBelow } = compressSettings();
  const normalized = await normalizeGuestImageFile(file);
  if (normalized.type === "image/gif") return normalized;
  if (normalized.size <= skipBelow) return normalized;

  try {
    const img = await loadImageFromFile(normalized);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return normalized;
    ctx.drawImage(img, 0, 0, w, h);
    const out = await canvasToJpegFile(canvas, normalized.name, quality);
    return out.size < normalized.size ? out : normalized;
  } catch {
    return normalized;
  }
}
