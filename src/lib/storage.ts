export function publicUrl(bucket: string, path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

/** memories bucket veya R2 yolu → herkese açık URL. */
export function memoryPublicUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("r2/")) {
    const r2Base = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, "");
    return r2Base ? `${r2Base}/${path.slice(3)}` : "";
  }
  return publicUrl("memories", path);
}
