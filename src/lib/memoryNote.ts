import type { MemoryRow } from "./database.types";

/** Medya ve notu olmayan çift gönderim artığı. */
export function isGhostMemory(m: MemoryRow): boolean {
  return !m.photo_path && !m.video_path && !m.note?.trim();
}

/** Listede gösterilecek satırlar: hayaletler ve tekrarlayan not-only kayıtlar elenir. */
export function filterVisibleMemories(memories: MemoryRow[]): MemoryRow[] {
  const noteKeys = new Set<string>();
  const kept: MemoryRow[] = [];

  const chronological = [...memories]
    .filter((m) => !isGhostMemory(m))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const m of chronological) {
    if (m.photo_path || m.video_path) {
      kept.push(m);
      continue;
    }
    const noteKey = m.note?.trim() || "\0";
    if (noteKeys.has(noteKey)) continue;
    noteKeys.add(noteKey);
    kept.push(m);
  }

  return kept.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

/** Zaman damgası / moderasyon satırı: not-only grupta tek, medyada dosya başına. */
export function getMetaDisplayMemories(memories: MemoryRow[]): MemoryRow[] {
  const visible = filterVisibleMemories(memories);
  const mediaRows = visible.filter((m) => m.photo_path || m.video_path);
  if (mediaRows.length > 0) return mediaRows;
  if (visible.length === 0) return [];
  const oldest = visible.reduce((a, b) =>
    +new Date(a.created_at) <= +new Date(b.created_at) ? a : b,
  );
  return [oldest];
}

/** Misafir grubunda gösterilecek tek not (aynı metin tekrarlanmaz). */
export function getGroupDisplayNote(memories: MemoryRow[]): string | null {
  const seen = new Set<string>();
  for (const memory of memories) {
    const trimmed = memory.note?.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      return trimmed;
    }
  }
  return null;
}
