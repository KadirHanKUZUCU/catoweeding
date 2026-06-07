import type { MemoryRow } from "../lib/database.types";

export function AdminMemoryRow(props: {
  memory: MemoryRow;
  note?: string | null;
  onModerate: (id: string, status: "approved" | "hidden" | "pending") => void;
}) {
  const { memory, note, onModerate } = props;
  const status = memory.moderation_status ?? "approved";
  const statusLabel =
    status === "pending" ? "Onay bekliyor" : status === "hidden" ? "Gizli" : "Yayında";

  return (
    <div className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {note ? (
          <>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-black/45">Not</span>
            <p className="min-w-0 flex-1 truncate text-sm text-black/75" title={note}>
              {note}
            </p>
          </>
        ) : null}
        <time dateTime={memory.created_at} className="shrink-0 text-[11px] text-black/45">
          {new Date(memory.created_at).toLocaleString("tr-TR")}
        </time>
        <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-medium text-black/70">
          {statusLabel}
        </span>
      </div>
      {status === "pending" ? (
        <div className="mt-2 flex flex-wrap gap-2">
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
