import type { MemoryRow } from "./database.types";

const BURST_WINDOW_MS = 30_000;

export function hasMemoryMedia(m: MemoryRow): boolean {
  return Boolean(m.photo_path?.trim() || m.video_path?.trim());
}

/** Medya ve notu olmayan çift gönderim artığı. */
export function isGhostMemory(m: MemoryRow): boolean {
  return !hasMemoryMedia(m) && !m.note?.trim();
}

function normalizeNoteKey(note: string | null | undefined): string {
  return (note ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Yalnızca not-only satırlarda çift tıklamayı birleştirir; medya asla elenmez. */
function collapseNoteOnlyBurst(noteOnlyRows: MemoryRow[]): MemoryRow[] {
  const sorted = [...noteOnlyRows].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const kept: MemoryRow[] = [];

  for (const m of sorted) {
    const prev = kept[kept.length - 1];
    if (!prev) {
      kept.push(m);
      continue;
    }

    const delta = +new Date(m.created_at) - +new Date(prev.created_at);
    const sameNote = normalizeNoteKey(m.note) === normalizeNoteKey(prev.note);
    if (delta >= 0 && delta <= BURST_WINDOW_MS && sameNote) continue;
    kept.push(m);
  }

  return kept;
}

/** Görüntüleme listesi: tüm medya kalır, yalnızca not-only tekrarlar elenir. */
export function filterVisibleMemories(memories: MemoryRow[]): MemoryRow[] {
  const media = memories.filter((m) => hasMemoryMedia(m));
  const noteOnly = memories.filter((m) => !hasMemoryMedia(m) && !isGhostMemory(m));
  const collapsedNotes = collapseNoteOnlyBurst(noteOnly);

  const noteKeys = new Set<string>();
  const uniqueNotes: MemoryRow[] = [];
  for (const m of collapsedNotes.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))) {
    const noteKey = normalizeNoteKey(m.note) || "\0";
    if (noteKeys.has(noteKey)) continue;
    noteKeys.add(noteKey);
    uniqueNotes.push(m);
  }

  return [...media, ...uniqueNotes].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export type NoteDisplayBlock = {
  note: string;
  memory: MemoryRow;
};

/** Gruptaki benzersiz notlar (medya satırlarındaki notlar dahil). */
export function getNoteDisplayBlocks(memories: MemoryRow[]): NoteDisplayBlock[] {
  const noteKeys = new Set<string>();
  const blocks: NoteDisplayBlock[] = [];

  const chronological = [...memories]
    .filter((m) => m.note?.trim())
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const m of chronological) {
    const note = m.note!.trim();
    const noteKey = normalizeNoteKey(note);
    if (noteKeys.has(noteKey)) continue;
    noteKeys.add(noteKey);
    blocks.push({ note, memory: m });
  }

  return blocks;
}

/** Alt bilgi satırı: aynı batch medyada tek zaman damgası. */
export function getFooterMetaRows(memories: MemoryRow[]): MemoryRow[] {
  const visible = filterVisibleMemories(memories);
  const grid = visible.filter(hasMemoryMedia);

  if (grid.length > 0) {
    const oldest = grid.reduce((a, b) => (+new Date(a.created_at) <= +new Date(b.created_at) ? a : b));
    const sameBatch = grid.every(
      (m) => +new Date(m.created_at) - +new Date(oldest.created_at) <= BURST_WINDOW_MS,
    );
    return sameBatch ? [oldest] : grid;
  }

  const noteBlocks = getNoteDisplayBlocks(memories);
  if (noteBlocks.length > 0) return noteBlocks.map((b) => b.memory);

  if (visible.length > 0) return [visible[visible.length - 1]!];
  return [];
}

/** @deprecated getNoteDisplayBlocks kullanın */
export function getGroupDisplayNote(memories: MemoryRow[]): string | null {
  return getNoteDisplayBlocks(memories)[0]?.note ?? null;
}
