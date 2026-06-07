import JSZip from "jszip";
import type { MemoryRow } from "./database.types";
import { memoryPublicUrl } from "./storage";

function safeName(s: string, max = 80): string {
  return s.replace(/[^\w\u00C0-\u024f\s.-]+/gi, "_").slice(0, max).trim() || "dosya";
}

/** Tüm onaylı / verilen anıların foto ve videolarını tek zip indirir. */
export async function zipMemoriesFromRows(
  memories: MemoryRow[],
  zipBaseName: string,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(safeName(zipBaseName, 60)) ?? zip;
  let i = 0;
  for (const m of memories) {
    const prefix = `${String(++i).padStart(3, "0")}_${safeName(m.full_name, 40)}`;
    if (m.photo_path) {
      const url = memoryPublicUrl(m.photo_path);
      const ext = m.photo_path.split(".").pop() ?? "jpg";
      const res = await fetch(url);
      if (res.ok) folder.file(`${prefix}_foto.${ext}`, await res.blob());
    }
    if (m.video_path) {
      const url = memoryPublicUrl(m.video_path);
      const ext = m.video_path.split(".").pop() ?? "mp4";
      const res = await fetch(url);
      if (res.ok) folder.file(`${prefix}_video.${ext}`, await res.blob());
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName(zipBaseName, 60)}-anilar.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
