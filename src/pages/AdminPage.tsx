import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MediaLightbox, type MediaLightboxState } from "../components/MediaLightbox";
import { OrganizerPanel } from "../components/OrganizerPanel";
import type { EventRow, MemoryRow } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { publicUrl } from "../lib/storage";
import { storagePathIsHeic } from "../lib/storageDisplay";
import { groupMemoriesByOwner } from "../lib/groupMemoriesByOwner";
import {
  filterVisibleMemories,
  getGroupDisplayNote,
  getMetaDisplayMemories,
} from "../lib/memoryNote";

type EventAdmin = Pick<
  EventRow,
  | "id"
  | "slug"
  | "couple_names"
  | "welcome_message"
  | "qr_background_path"
  | "community_rules"
  | "moderation_enabled"
  | "invite_code"
  | "guest_page_views"
  | "unique_visitor_count"
  | "memory_submission_count"
>;

export function AdminPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const [event, setEvent] = useState<EventAdmin | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<MediaLightboxState>(null);

  const valid = useMemo(() => Boolean(slug && token), [slug, token]);

  const load = useCallback(async () => {
    if (!valid || !slug || !token) return;
    setLoading(true);
    const { data: ev, error: e1 } = await supabase
      .from("events")
      .select(
        "id, slug, couple_names, welcome_message, qr_background_path, community_rules, moderation_enabled, invite_code, guest_page_views, unique_visitor_count, memory_submission_count",
      )
      .eq("slug", slug)
      .eq("admin_token", token)
      .maybeSingle();
    if (e1 || !ev) {
      toast.error("Yönetim bağlantısı geçersiz.");
      setEvent(null);
      setLoading(false);
      return;
    }
    setEvent(ev as EventAdmin);
    const { data: mem, error: e2 } = await supabase
      .from("memories")
      .select("*")
      .eq("event_id", ev.id)
      .order("created_at", { ascending: false });
    if (e2) toast.error(e2.message);
    setMemories(mem ?? []);
    setLoading(false);
  }, [slug, token, valid]);

  useEffect(() => {
    void load();
  }, [load]);

  const guestEventUrl = useMemo(
    () => (slug ? `${window.location.origin}/e/${slug}` : ""),
    [slug],
  );

  const adminGroups = useMemo(() => groupMemoriesByOwner(memories), [memories]);

  async function modStatus(memoryId: string, status: "approved" | "hidden" | "pending") {
    if (!token) return;
    const { error } = await supabase.rpc("moderate_memory", {
      p_admin_token: token,
      p_memory_id: memoryId,
      p_status: status,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Güncellendi.");
      await load();
    }
  }

  const adminUrl = useMemo(() => {
    if (!slug || !token) return "";
    return `${window.location.origin}/e/${slug}/yonetim/${token}`;
  }, [slug, token]);

  async function copyAdmin() {
    try {
      await navigator.clipboard.writeText(adminUrl);
      toast.success("Yönetim bağlantısı kopyalandı.");
    } catch {
      toast.error("Kopyalanamadı; bağlantıyı elle seçin.");
    }
  }

  if (!valid) {
    return <p className="text-sm text-black/55">Eksik bağlantı.</p>;
  }

  if (loading) {
    return <div className="rounded-3xl border border-black/10 bg-white/60 p-10 text-center">Yükleniyor…</div>;
  }

  if (!event) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/60 p-10 text-center">
        <p className="font-display text-2xl">Erişim reddedildi.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold underline">
          Ana sayfa
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MediaLightbox state={viewer} onClose={() => setViewer(null)} />
      <section className="rounded-3xl border border-black/10 bg-white/75 p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-sage)]">Yönetim</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{event.couple_names}</h1>
        <p className="mt-2 text-sm text-black/55">Tüm misafir içerikleri aşağıda listelenir.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyAdmin()}
            className="rounded-2xl bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-[var(--color-parchment)]"
          >
            Yönetim linkini kopyala
          </button>
          <Link
            to={`/e/${slug}`}
            className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-black/70"
          >
            Misafir sayfası
          </Link>
          <Link
            to={`/e/${slug}/panel`}
            className="rounded-2xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-black/70"
          >
            Organizatör paneli
          </Link>
        </div>
      </section>

      <OrganizerPanel
        slug={slug!}
        event={event}
        memories={memories}
        guestEventUrl={guestEventUrl}
        adminToken={token ?? null}
        onReload={load}
      />

      <section className="rounded-3xl border border-black/10 bg-white/70 p-6 backdrop-blur md:p-8">
        <h2 className="font-display text-2xl font-semibold">Tüm anılar</h2>
        <p className="mt-1 text-sm text-black/50">
          Aynı misafir (aynı oturum) gönderileri tek blokta; «Misafir 1» sırası ilk paylaşıma göredir.
        </p>
        <ul className="mt-6 space-y-6">
          {adminGroups.length === 0 ? (
            <li className="text-sm text-black/45">Henüz içerik yok.</li>
          ) : (
            adminGroups.map((g) => {
              const visibleMemories = filterVisibleMemories(g.memories);
              const metaRows = getMetaDisplayMemories(g.memories);
              const groupNote = getGroupDisplayNote(g.memories);
              return (
              <li
                key={g.ownerId}
                className="rounded-2xl border border-black/10 bg-white/85 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-xl font-semibold">
                    Misafir {g.guestIndex}
                    <span className="ml-2 text-base font-normal text-black/60">· {g.fullName}</span>
                  </p>
                  <span className="text-[11px] text-black/45">{visibleMemories.length} kayıt</span>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {visibleMemories.map((m) => {
                    const ph = m.photo_path ? publicUrl("memories", m.photo_path) : null;
                    const vid = m.video_path ? publicUrl("memories", m.video_path) : null;
                    const heic = m.photo_path ? storagePathIsHeic(m.photo_path) : false;
                    if (!ph && !vid) {
                      return (
                        <li
                          key={m.id}
                          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.03] text-[10px] text-black/45"
                        >
                          Not
                        </li>
                      );
                    }
                    if (ph && heic) {
                      return (
                        <li
                          key={m.id}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl border border-amber-200/70 bg-amber-50/90 p-2 text-center text-[10px] text-amber-950/90"
                        >
                          HEIC
                          <a href={ph} download className="mt-1 font-semibold underline">
                            İndir
                          </a>
                        </li>
                      );
                    }
                    if (ph) {
                      return (
                        <li key={m.id} className="aspect-square overflow-hidden rounded-xl border border-black/10">
                          <button
                            type="button"
                            className="h-full w-full outline-none ring-[var(--color-gold)]/25 focus-visible:ring-2"
                            onClick={() => setViewer({ kind: "image", url: ph, title: g.fullName })}
                          >
                            <img src={ph} alt="" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={m.id} className="aspect-square overflow-hidden rounded-xl border border-black/10 bg-black">
                        <button
                          type="button"
                          className="relative h-full w-full outline-none ring-[var(--color-gold)]/25 focus-visible:ring-2"
                          onClick={() => setViewer({ kind: "video", url: vid!, title: "Video" })}
                        >
                          <video src={vid!} className="h-full w-full object-cover opacity-85" muted playsInline />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl text-white/90">
                            ▶
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 space-y-3 border-t border-black/10 pt-3">
                  {groupNote ? (
                    <div className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Not</p>
                      <p className="mt-1 text-sm text-black/75">{groupNote}</p>
                    </div>
                  ) : null}
                  {metaRows.map((m) => (
                    <div key={m.id} className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-black/45">
                        <time dateTime={m.created_at}>
                          {new Date(m.created_at).toLocaleString("tr-TR")}
                        </time>
                        <span className="rounded-full bg-black/10 px-2 py-0.5 font-medium text-black/70">
                          {(m.moderation_status ?? "approved") === "pending"
                            ? "Onay bekliyor"
                            : (m.moderation_status ?? "approved") === "hidden"
                              ? "Gizli"
                              : "Yayında"}
                        </span>
                      </div>
                      {(m.moderation_status ?? "approved") === "pending" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-800 px-2 py-1 text-[11px] font-semibold text-white"
                            onClick={() => void modStatus(m.id, "approved")}
                          >
                            Onayla
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[11px] font-semibold text-red-700"
                            onClick={() => void modStatus(m.id, "hidden")}
                          >
                            Gizle
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
