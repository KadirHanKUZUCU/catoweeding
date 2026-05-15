import type { MemoryRow } from "./database.types";

export function memoryApprovedForPublicFeed(m: MemoryRow): boolean {
  return (m.moderation_status ?? "approved") === "approved";
}
