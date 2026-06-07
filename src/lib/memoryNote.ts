import type { MemoryRow } from "./database.types";

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

/** Listede gösterilecek satırlar: hayaletler ve tekrarlayan not-only kayıtlar elenir. */
export function filterVisibleMemories(memories: MemoryRow[]): MemoryRow[] {
  const noteKeys = new Set<string>();
  const kept: MemoryRow[] = [];

  const chronological = [...memories]
    .filter((m) => !isGhostMemory(m))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

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

export type NoteOnlySection = {
  note: string;
  memory: MemoryRow;
};

/** Her benzersiz not için tek kart (çift gönderimde tek zaman damgası). */
export function getNoteOnlySections(memories: MemoryRow[]): NoteOnlySection[] {
  const noteKeys = new Set<string>();
  const sections: NoteOnlySection[] = [];

  const chronological = [...memories]
    .filter((m) => !isGhostMemory(m) && !hasMemoryMedia(m))
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const m of chronological) {
    const note = m.note?.trim();
    if (!note) continue;
    const noteKey = normalizeNoteKey(note);
    if (noteKeys.has(noteKey)) continue;
    noteKeys.add(noteKey);
    sections.push({ note, memory: m });
  }

  return sections;
}

/** Medyalı satırların moderasyon / zaman damgası listesi. */
export function getMediaMetaRows(memories: MemoryRow[]): MemoryRow[] {
  return filterVisibleMemories(memories).filter(hasMemoryMedia);
}

/** @deprecated getNoteOnlySections + getMediaMetaRows kullanın */
export function getMetaDisplayMemories(memories: MemoryRow[]): MemoryRow[] {
  const media = getMediaMetaRows(memories);
  if (media.length > 0) return media;
  const section = getNoteOnlySections(memories)[0];
  return section ? [section.memory] : [];
}

/** Misafir grubunda gösterilecek tek not (aynı metin tekrarlanmaz). */
export function getGroupDisplayNote(memories: MemoryRow[]): string | null {
  return getNoteOnlySections(memories)[0]?.note ?? null;
}
