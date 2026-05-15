import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useEnsureAnonymousSession } from "../hooks/useEnsureAnonymousSession";
import type { EventRow } from "../lib/database.types";
import { forgetEvent, readMyEvents } from "../lib/myEvents";
import { supabase } from "../lib/supabase";

type Row = Pick<EventRow, "id" | "slug" | "couple_names" | "created_at">;

export function OrganizerEventsPage() {
  const { ready, userId } = useEnsureAnonymousSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, slug, couple_names, created_at")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const firstYonetim = useMemo(() => {
    for (const r of rows) {
      const local = readMyEvents().find((e) => e.slug === r.slug);
      if (local) return { slug: r.slug, admin_token: local.admin_token };
    }
    return null;
  }, [rows]);

  function askDelete(row: Row) {
    toast("Bu etkinliği kalıcı olarak silmek istiyor musunuz?", {
      description: "Tüm misafir anıları ve yüklenen dosyalar da silinir. Geri alınamaz.",
      duration: 20000,
      action: {
        label: "Evet, sil",
        onClick: () => void performDelete(row),
      },
      cancel: {
        label: "Vazgeç",
        onClick: () => {},
      },
    });
  }

  async function performDelete(row: Row) {
    if (!userId) return;
    const { error } = await supabase.from("events").delete().eq("id", row.id).eq("creator_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    forgetEvent(row.slug);
    sessionStorage.removeItem(`admin:${row.slug}`);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Etkinlik silindi.");
  }

  if (!ready || loading) {
    return <p className="text-center text-black/55">Yükleniyor…</p>;
  }

  if (!userId) {
    return <p className="text-center text-sm text-black/55">Oturum hazır değil; sayfayı yenileyin.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Etkinliklerim</h1>
        <p className="mt-2 text-sm text-black/55">
          Bu oturumda oluşturduğunuz etkinlikler. Toplam:{" "}
          <strong className="text-[var(--color-ink)]">{rows.length}</strong>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-8 text-center text-sm text-black/50">
          Henüz etkinlik yok. Ana sayfadan yeni bir etkinlik oluşturabilirsiniz.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const showYonetim = firstYonetim !== null && r.slug === firstYonetim.slug;
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm"
              >
                <p className="font-display text-lg font-semibold">{r.couple_names}</p>
                <p className="mt-1 text-xs text-black/45">
                  {new Date(r.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/e/${r.slug}/panel`}
                    className="rounded-xl bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-[var(--color-parchment)]"
                  >
                    Panel
                  </Link>
                  <Link
                    to={`/e/${r.slug}`}
                    className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/70"
                  >
                    Misafir
                  </Link>
                  {showYonetim ? (
                    <Link
                      to={`/e/${r.slug}/yonetim/${firstYonetim.admin_token}`}
                      className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/70"
                    >
                      Yönetim
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => askDelete(r)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    Sil
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
