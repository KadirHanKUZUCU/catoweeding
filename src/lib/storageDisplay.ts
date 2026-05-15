/** Storage object path (e.g. `…/photo.heic`) — most browsers cannot decode HEIC in <img>. */
export function storagePathIsHeic(path: string | null | undefined): boolean {
  if (!path) return false;
  const p = path.toLowerCase();
  return p.endsWith(".heic") || p.endsWith(".heif");
}
