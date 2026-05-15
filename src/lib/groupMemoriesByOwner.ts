import type { MemoryRow } from "./database.types";

export type OwnerMemoryGroup = {
  ownerId: string;
  guestIndex: number;
  fullName: string;
  memories: MemoryRow[];
};

/** Aynı misafir (owner_id) satırlarını birleştirir; Misafir 1, 2 sırası ilk gönderim zamanına göredir. */
export function groupMemoriesByOwner(rows: MemoryRow[]): OwnerMemoryGroup[] {
  if (rows.length === 0) return [];
  const byOwner = new Map<string, MemoryRow[]>();
  for (const m of rows) {
    const list = byOwner.get(m.owner_id) ?? [];
    list.push(m);
    byOwner.set(m.owner_id, list);
  }
  const ownerIds = [...byOwner.keys()];
  ownerIds.sort((a, b) => {
    const ta = Math.min(...(byOwner.get(a) ?? []).map((m) => +new Date(m.created_at)));
    const tb = Math.min(...(byOwner.get(b) ?? []).map((m) => +new Date(m.created_at)));
    return ta - tb;
  });
  return ownerIds.map((ownerId, i) => {
    const memories = (byOwner.get(ownerId) ?? []).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const fullName = memories[0]?.full_name?.trim() || "Misafir";
    return { ownerId, guestIndex: i + 1, fullName, memories };
  });
}
