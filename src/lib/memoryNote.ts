import type { MemoryRow } from "./database.types";

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
