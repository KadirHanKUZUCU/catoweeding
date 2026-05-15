export function publicUrl(bucket: string, path: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return "";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
