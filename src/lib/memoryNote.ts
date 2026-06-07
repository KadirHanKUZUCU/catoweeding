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

/** Aynı misafirin saniyeler içindeki çift tıklama kayıtlarını birleştirir. */
export function collapseBurstDuplicates(memories: MemoryRow[]): MemoryRow[] {
  const sorted = [...memories].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const kept: MemoryRow[] = [];

  for (const m of sorted) {
    const prev = kept[kept.length - 1];
    if (!prev) {
      kept.push(m);
      continue;
    }

    const delta = +new Date(m.created_at) - +new Date(prev.created_at);
    const prevNote = normalizeNoteKey(prev.note);
    const nextNote = normalizeNoteKey(m.note);
    const rapid = delta >= 0 && delta <= BURST_WINDOW_MS;
    const sameNote = nextNote !== "" && nextNote === prevNote;
    const emptyAfterNote = nextNote === "" && prevNote !== "";

    if (rapid && (sameNote || emptyAfterNote)) continue;
    kept.push(m);
  }

  return kept.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

/** Listede gösterilecek satırlar. */
export function filterVisibleMemories(memories: MemoryRow[]): MemoryRow[] {
  const collapsed = collapseBurstDuplicates(memories.filter((m) => !isGhostMemory(m)));
  const noteKeys = new Set<string>();
  const kept: MemoryRow[] = [];

  const chronological = [...collapsed].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const m of chronological) {
    if (hasMemoryMedia(m)) {
      kept.push(m);
      continue;
    }
    const noteKey = normalizeNoteKey(m.note) || "\0";
    if (noteKeys.has(noteKey)) continue;
    noteKeys.add(noteKey);
    kept.push(m);
  }

  return kept.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export type NoteDisplayBlock = {
  note: string;
  memory: MemoryRow;
};

/** Gruptaki benzersiz notlar (medya olsa da not kaybolmaz). */
export function getNoteDisplayBlocks(memories: MemoryRow[]): NoteDisplayBlock[] {
  const noteKeys = new Set<string>();
  const blocks: NoteDisplayBlock[] = [];

  const chronological = [...collapseBurstDuplicates(memories)]
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

/** Alt bilgi: medya varsa dosya başına; yoksa tek zaman damgası. */
export function getFooterMetaRows(memories: MemoryRow[]): MemoryRow[] {
  const visible = filterVisibleMemories(memories);
  const grid = visible.filter(hasMemoryMedia);
  if (grid.length > 0) return grid;

  const noteBlocks = getNoteDisplayBlocks(memories);
  if (noteBlocks.length > 0) return noteBlocks.map((b) => b.memory);

  if (visible.length > 0) return [visible[visible.length - 1]!];
  return [];
}

/** @deprecated getNoteDisplayBlocks kullanın */
export function getGroupDisplayNote(memories: MemoryRow[]): string | null {
  return getNoteDisplayBlocks(memories)[0]?.note ?? null;
}
