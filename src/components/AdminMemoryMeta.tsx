import type { MemoryRow } from "../lib/database.types";

export function AdminMemoryMeta(props: {
  memory: MemoryRow;
  onModerate: (id: string, status: "approved" | "hidden" | "pending") => void;
}) {
  const { memory, onModerate } = props;
  const status = memory.moderation_status ?? "approved";

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-black/45">
      <time dateTime={memory.created_at}>{new Date(memory.created_at).toLocaleString("tr-TR")}</time>
      <span className="rounded-full bg-black/10 px-2 py-0.5 font-medium text-black/70">
        {status === "pending" ? "Onay bekliyor" : status === "hidden" ? "Gizli" : "Yayında"}
      </span>
      {status === "pending" ? (
        <div className="flex w-full flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg bg-emerald-800 px-2 py-1 text-[11px] font-semibold text-white"
            onClick={() => onModerate(memory.id, "approved")}
          >
            Onayla
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[11px] font-semibold text-red-700"
            onClick={() => onModerate(memory.id, "hidden")}
          >
            Gizle
          </button>
        </div>
      ) : null}
    </div>
  );
}
