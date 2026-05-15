import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { GuestPanel } from "../components/GuestPanel";
import { useEnsureAnonymousSession } from "../hooks/useEnsureAnonymousSession";
import type { EventRow, MemoryRow } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { publicUrl } from "../lib/storage";
import { getOrCreateVisitorFingerprint } from "../lib/visitorKey";

type EventGuest = Pick<
  EventRow,
  | "id"
  | "slug"
  | "couple_names"
  | "welcome_message"
  | "qr_background_path"
  | "community_rules"
  | "moderation_enabled"
  | "invite_code"
>;

const DEFAULT_RULES =
  "Yüklediğiniz içerikler uygun ve saygılı olmalıdır. Uygunsuz veya telif ihlali içeren gönderiler kaldırılabilir.";

export function EventGuestPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { ready, userId } = useEnsureAnonymousSession();
  const [event, setEvent] = useState<EventGuest | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteEpoch, setInviteEpoch] = useState(0);

  const inviteStorageKey = useMemo(() => (slug ? `guest_invite_ok:${slug}` : ""), [slug]);
  const visitTrackedKey = useMemo(() => (event ? `guest_visit_tracked:${event.id}` : ""), [event]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const { data: ev, error: e1 } = await supabase
      .from("events")
      .select(
        "id, slug, couple_names, welcome_message, qr_background_path, community_rules, moderation_enabled, invite_code",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (e1 || !ev) {
      toast.error("Etkinlik bulunamadı.");
      setEvent(null);
      setLoading(false);
      return;
    }
    setEvent(ev as EventGuest);
    const { data: mem, error: e2 } = await supabase
      .from("memories")
      .select("*")
      .eq("event_id", ev.id)
      .order("created_at", { ascending: false });
    if (e2) toast.error(e2.message);
    setMemories(mem ?? []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const code = searchParams.get("davet") ?? searchParams.get("code");
    if (code && inviteStorageKey) {
      sessionStorage.setItem(inviteStorageKey, code.trim());
      setInviteEpoch((e) => e + 1);
    }
  }, [searchParams, inviteStorageKey]);

  useEffect(() => {
    if (!event || !visitTrackedKey) return;
    if (sessionStorage.getItem(visitTrackedKey)) return;
    sessionStorage.setItem(visitTrackedKey, "1");
    void (async () => {
      const { error } = await supabase.rpc("track_guest_visit", {
        p_event: event.id,
        p_visitor_key: getOrCreateVisitorFingerprint(),
      });
      if (error && import.meta.env.DEV) console.warn(error.message);
    })();
  }, [event, visitTrackedKey]);

  const inviteRequired = Boolean(event?.invite_code && event.invite_code.trim().length > 0);
  const inviteOk = useMemo(() => {
    if (!inviteRequired || !inviteStorageKey) return true;
    const saved = sessionStorage.getItem(inviteStorageKey);
    return saved === (event?.invite_code ?? "").trim();
  }, [inviteRequired, inviteStorageKey, event?.invite_code, inviteEpoch]);

  const gateClosed = inviteRequired && !inviteOk;

  const bgUrl =
    event?.qr_background_path != null ? publicUrl("event-assets", event.qr_background_path) : null;

  if (loading || !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-parchment)] text-black/55">
        Yükleniyor…
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-parchment)] p-6 text-center">
        <p className="font-display text-2xl">Bu etkinlik bulunamadı.</p>
        <Link className="mt-4 text-sm font-semibold text-[var(--color-gold)] underline" to="/">
          Ana sayfa
        </Link>
      </div>
    );
  }

  if (gateClosed) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--color-parchment)] p-6">
        <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-white/95 p-6 shadow-xl">
          <p className="font-display text-xl font-semibold">Davet kodu</p>
          <p className="mt-2 text-sm text-black/55">
            Bu etkinlik davet kodu ile korunuyor. Kodu düğün davetiyenizde veya paylaşılan mesajda bulabilirsiniz.
          </p>
          <input
            className="mt-4 w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none ring-[var(--color-gold)]/30 focus:ring-2"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="Davet kodunu yazın"
            autoComplete="off"
          />
          <button
            type="button"
            className="mt-4 w-full rounded-2xl bg-[var(--color-ink)] py-3 text-sm font-semibold text-[var(--color-parchment)]"
            onClick={() => {
              const trimmed = inviteInput.trim();
              if (!trimmed) {
                toast.error("Kodu yazın.");
                return;
              }
              if (!inviteStorageKey) return;
              if (trimmed !== (event.invite_code ?? "").trim()) {
                toast.error("Kod eşleşmedi.");
                return;
              }
              sessionStorage.setItem(inviteStorageKey, trimmed);
              setInviteEpoch((e) => e + 1);
              toast.success("Hoş geldiniz.");
            }}
          >
            Devam et
          </button>
          <Link to="/" className="mt-4 block text-center text-xs text-black/45 underline">
            Ana sayfa
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[var(--color-parchment)]" />
      {bgUrl ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      ) : null}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/35 via-black/45 to-black/60" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10 pb-16">
        <Link
          to="/"
          className="mb-6 self-center font-display text-lg font-semibold tracking-tight text-white drop-shadow-md"
        >
          Dijital Anı
        </Link>
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold text-white drop-shadow-lg md:text-4xl">
            {event.couple_names}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/90 drop-shadow-md">
            {event.welcome_message}
          </p>
        </div>

        <div className="mt-8 flex-1">
          <GuestPanel
            eventId={event.id}
            userId={userId}
            memories={memories}
            onChanged={load}
            communityRules={event.community_rules?.trim() || DEFAULT_RULES}
            moderationEnabled={Boolean(event.moderation_enabled)}
          />
        </div>
      </div>
    </div>
  );
}
