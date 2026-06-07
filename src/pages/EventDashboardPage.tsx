import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MediaLightbox, type MediaLightboxState } from "../components/MediaLightbox";
import { OrganizerPanel } from "../components/OrganizerPanel";
import { memoryApprovedForPublicFeed } from "../lib/feedModeration";
import { groupMemoriesByOwner } from "../lib/groupMemoriesByOwner";
import { copyTextRobust } from "../lib/clipboard";
import type { EventRow, MemoryRow } from "../lib/database.types";
import { buildEventPoster, buildEventPosterBlob } from "../lib/qrPoster";
import { buildGuestInviteMessage } from "../lib/shareMessage";
import { supabase } from "../lib/supabase";
import { memoryPublicUrl, publicUrl } from "../lib/storage";
import { storagePathIsHeic } from "../lib/storageDisplay";

type EventPublic = Pick<
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

export function EventDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posterBusy, setPosterBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const guestEventUrl = useMemo(
    () => (slug ? `${window.location.origin}/e/${slug}` : ""),
    [slug],
  );

  const shareText = useMemo(() => {
    if (!event || !guestEventUrl) return "";
    return buildGuestInviteMessage({
      coupleNames: event.couple_names,
      guestUrl: guestEventUrl,
      welcomeMessage: event.welcome_message,
      inviteCode: event.invite_code,
    });
  }, [event, guestEventUrl]);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const { data: ev, error: e1 } = await supabase
      .from("events")
      .select(
        "id, slug, couple_names, welcome_message, qr_background_path, community_rules, moderation_enabled, invite_code, guest_page_views, unique_visitor_count, memory_submission_count",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (e1 || !ev) {
      toast.error("Etkinlik bulunamadı.");
      setEvent(null);
      setLoading(false);
      return;
    }
    setEvent(ev);
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

  const bgUrl = useMemo(() => {
    if (!event?.qr_background_path) return null;
    return publicUrl("event-assets", event.qr_background_path);
  }, [event]);

  useEffect(() => {
    if (!event || !guestEventUrl) return;
    let alive = true;
    void buildEventPoster({
      eventUrl: guestEventUrl,
      coupleNames: event.couple_names,
      welcomeMessage: event.welcome_message,
      backgroundPublicUrl: bgUrl,
      maxCanvasWidth: 400,
    })
      .then((dataUrl) => {
        if (alive && dataUrl) setQrPreview(dataUrl);
      })
      .catch(() => {
        if (alive) setQrPreview(null);
      });
    return () => {
      alive = false;
    };
  }, [bgUrl, event, guestEventUrl]);

  const trySharePosterThen = useCallback(
    async (fallback: () => void, opts?: { fileOnly?: boolean }) => {
      if (!event || !slug) return;
      setShareBusy(true);
      try {
        const blob = await buildEventPosterBlob({
          eventUrl: guestEventUrl,
          coupleNames: event.couple_names,
          welcomeMessage: event.welcome_message,
          backgroundPublicUrl: bgUrl,
        });
        if (blob) {
          const file = new File([blob], `qr-${slug}.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: event.couple_names,
                text: shareText,
              });
              return;
            } catch (e) {
              if ((e as Error).name === "AbortError") return;
            }
            if (!opts?.fileOnly) {
              try {
                await navigator.share({
                  files: [file],
                  title: event.couple_names,
                  text: shareText,
                  url: guestEventUrl,
                });
                return;
              } catch (e) {
                if ((e as Error).name === "AbortError") return;
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      } finally {
        setShareBusy(false);
      }
      fallback();
    },
    [bgUrl, event, guestEventUrl, shareText, slug],
  );

  const shareWhatsapp = useCallback(() => {
    void trySharePosterThen(
      () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
        toast.message("WhatsApp Web görsel göndermez.", {
          description:
            "Mobilde paylaşım penceresinde PNG çıkmadıysa kartı indirip WhatsApp’tan galeriden gönderin; canlı link yerel ağdaysa misafirleriniz için internet adresi kullanın.",
        });
      },
      { fileOnly: true },
    );
  }, [shareText, trySharePosterThen]);

  const shareTwitter = useCallback(() => {
    void trySharePosterThen(() => {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer,width=560,height=420",
      );
    });
  }, [shareText, trySharePosterThen]);

  const shareFacebook = useCallback(() => {
    void trySharePosterThen(() => {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(guestEventUrl)}`,
        "_blank",
        "noopener,noreferrer,width=626,height=436",
      );
    });
  }, [guestEventUrl, trySharePosterThen]);

  const shareInstagram = useCallback(() => {
    void trySharePosterThen(async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: event?.couple_names ?? "Dijital Anı",
            text: shareText,
            url: guestEventUrl,
          });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      const ok = await copyTextRobust(shareText);
      if (ok) {
        toast.success("Metin panoya kopyalandı.", {
          description: "Instagram’da yapıştırın. PNG için önce «QR kartını indir» deyip galeriden ekleyin.",
        });
      } else {
        toast.error("Panoya kopyalanamadı.", {
          description: "HTTPS veya izin gerekir; metni elle seçip kopyalayın.",
        });
      }
    });
  }, [event?.couple_names, guestEventUrl, shareText, trySharePosterThen]);

  async function copyEventLink() {
    const ok = await copyTextRobust(guestEventUrl);
    if (ok) toast.success("Misafir bağlantısı kopyalandı.");
    else toast.error("Kopyalanamadı; bağlantıyı elle seçin.");
  }

  async function downloadPoster() {
    if (!event || !slug) return;
    setPosterBusy(true);
    try {
      const dataUrl = await buildEventPoster({
        eventUrl: guestEventUrl,
        coupleNames: event.couple_names,
        welcomeMessage: event.welcome_message,
        backgroundPublicUrl: bgUrl,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${slug}.png`;
      a.click();
      toast.success("QR kartı indirildi.");
    } catch {
      toast.error("Poster oluşturulamadı.");
    } finally {
      setPosterBusy(false);
    }
  }

  const adminToken = useMemo(() => (slug ? sessionStorage.getItem(`admin:${slug}`) : null), [slug]);

  const mediaForFeed = useMemo(
    () =>
      memories
        .filter((m) => (m.photo_path || m.video_path) && memoryApprovedForPublicFeed(m))
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [memories],
  );

  const feedGroups = useMemo(() => groupMemoriesByOwner(mediaForFeed), [mediaForFeed]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/60 p-10 text-center text-black/55">
        Yükleniyor…
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/60 p-10 text-center">
        <p className="font-display text-2xl">Bu etkinlik bulunamadı.</p>
        <Link className="mt-4 inline-block text-sm font-semibold text-[var(--color-gold)] underline" to="/">
          Yeni etkinlik oluştur
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-sage)]">
              Organizatör paneli
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold">{event.couple_names}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-black/60">{event.welcome_message}</p>
            <p className="mt-3 text-xs text-black/45">
              Misafirler yalnızca şu adresi görür:{" "}
              <Link className="font-medium text-[var(--color-gold)] underline" to={`/e/${slug}`}>
                {guestEventUrl}
              </Link>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-black/40">
              Yönetim (tüm içerikler, moderasyon) ayrı katmandır:{" "}
              <Link to="/hesabim" className="underline">
                Etkinliklerim
              </Link>{" "}
              üzerinden veya size özel verilen yönetim bağlantısından açılır — bu sayfada yönetim butonu yoktur.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPoster}
              disabled={posterBusy || shareBusy}
              className="rounded-2xl bg-[var(--color-ink)] px-4 py-2.5 text-xs font-semibold text-[var(--color-parchment)] disabled:opacity-50"
            >
              {posterBusy ? "Hazırlanıyor…" : "QR kartını indir"}
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-black/10 pt-8">
          <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="shrink-0 rounded-3xl border border-black/10 bg-white p-2 shadow-[0_12px_40px_rgba(26,20,18,0.08)]">
                {qrPreview ? (
                  <img
                    src={qrPreview}
                    alt="QR kart önizlemesi — indirilen PNG ile aynı tasarım"
                    className="h-auto w-[min(100%,280px)] max-w-[280px] rounded-2xl"
                  />
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-black/[0.04] text-xs text-black/45">
                    Önizleme hazırlanıyor…
                  </div>
                )}
              </div>
              <div className="max-w-md text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/45">QR kart önizleme</p>
                <p className="mt-2 text-sm leading-relaxed text-black/55">
                  Buradaki görsel, arka planlı <strong className="font-medium text-black/70">indirilecek PNG</strong>{" "}
                  ile aynıdır. QR verisi misafir sayfasına gider.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-md lg:items-end">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/45 lg:text-right">Paylaş</p>
              <p className="max-w-sm text-right text-[11px] leading-relaxed text-black/45">
                WhatsApp Web görsel ekleyemez; mobilde çoğunlukla sistem paylaşımı PNG’yi iletir. Aksi halde kartı
                indirip galeriden gönderin.
              </p>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <ShareChip
                  onClick={shareWhatsapp}
                  label="WhatsApp"
                  disabled={shareBusy || posterBusy}
                  className="bg-[#25D366] text-white"
                >
                  <IconWhatsApp />
                </ShareChip>
                <ShareChip
                  onClick={shareInstagram}
                  label="Instagram"
                  disabled={shareBusy || posterBusy}
                  className="bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"
                >
                  <IconInstagram />
                </ShareChip>
                <ShareChip
                  onClick={shareTwitter}
                  label="X (Twitter)"
                  disabled={shareBusy || posterBusy}
                  className="bg-black text-white"
                >
                  <IconX />
                </ShareChip>
                <ShareChip
                  onClick={shareFacebook}
                  label="Facebook"
                  disabled={shareBusy || posterBusy}
                  className="bg-[#1877F2] text-white"
                >
                  <IconFacebook />
                </ShareChip>
                <button
                  type="button"
                  onClick={() => void copyEventLink()}
                  disabled={shareBusy || posterBusy}
                  className="rounded-2xl border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Misafir linki
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <OrganizerPanel
        slug={slug!}
        event={event}
        memories={memories}
        guestEventUrl={guestEventUrl}
        adminToken={adminToken}
        onReload={load}
      />
      <FeedPanel feedGroups={feedGroups} slug={slug!} />
    </div>
  );
}

function FeedPanel(props: {
  feedGroups: ReturnType<typeof groupMemoriesByOwner>;
  slug: string;
}) {
  const { feedGroups, slug } = props;
  const [viewer, setViewer] = useState<MediaLightboxState>(null);

  const igReels = "https://www.instagram.com/reels/create/";
  const igApp = "instagram://camera";

  return (
    <section className="space-y-6 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur md:p-8">
      <MediaLightbox state={viewer} onClose={() => setViewer(null)} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold">Gelen fotoğraf ve videolar</h2>
          <p className="mt-1 text-sm text-black/55">
            Aynı misafirin gönderileri tek blokta gruplanır (Misafir 1, 2… sıra ilk paylaşım zamanına göre). Reels için
            alttaki kısayolları kullanın.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={igReels}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-4 py-2.5 text-xs font-semibold text-white shadow-sm"
          >
            Instagram’da Reels oluştur
          </a>
          <button
            type="button"
            onClick={() => {
              window.location.href = igApp;
              toast.message("Instagram uygulaması açılmazsa web sürümünü kullanın.");
            }}
            className="rounded-2xl border border-black/15 bg-white px-4 py-2.5 text-xs font-semibold text-black/70"
          >
            Uygulamayı aç
          </button>
        </div>
      </div>

      {feedGroups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] py-16 text-center text-sm text-black/45">
          Henüz onaylı fotoğraf veya video yok. Misafirler ekledikçe burada gruplanarak belirecek.
        </p>
      ) : (
        <div className="space-y-6">
          {feedGroups.map((g) => (
            <article
              key={g.ownerId}
              className="break-inside-avoid overflow-hidden rounded-2xl border border-black/10 bg-white/90 p-4 shadow-sm"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 pb-3">
                <p className="font-display text-lg font-semibold text-black/90">
                  Misafir {g.guestIndex}
                  <span className="ml-2 text-sm font-normal text-black/55">· {g.fullName}</span>
                </p>
                <span className="text-[11px] text-black/40">{g.memories.length} dosya</span>
              </header>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {g.memories.map((m) => {
                  const path = m.photo_path;
                  const src = path ? memoryPublicUrl(path) : "";
                  const vid = m.video_path ? memoryPublicUrl(m.video_path) : null;
                  if (path && storagePathIsHeic(path)) {
                    return (
                      <li
                        key={m.id}
                        className="flex aspect-square flex-col justify-center rounded-xl border border-amber-200/70 bg-amber-50/90 p-2 text-center text-[10px] leading-tight text-amber-950/90"
                      >
                        HEIC
                        <a href={src} download className="mt-1 font-semibold underline">
                          İndir
                        </a>
                      </li>
                    );
                  }
                  if (path && src) {
                    return (
                      <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.04]">
                        <button
                          type="button"
                          className="h-full w-full outline-none ring-[var(--color-gold)]/25 focus-visible:ring-2"
                          onClick={() => setViewer({ kind: "image", url: src, title: `${g.fullName} — foto` })}
                        >
                          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      </li>
                    );
                  }
                  if (vid) {
                    return (
                      <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/90">
                        <button
                          type="button"
                          className="relative h-full w-full outline-none ring-[var(--color-gold)]/25 focus-visible:ring-2"
                          onClick={() => setViewer({ kind: "video", url: vid, title: `${g.fullName} — video` })}
                        >
                          <video src={vid} className="h-full w-full object-cover opacity-80" muted playsInline />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl text-white/90">
                            ▶
                          </span>
                        </button>
                      </li>
                    );
                  }
                  return null;
                })}
              </ul>
            </article>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-black/40">
        İpucu: QR kartını indirip hikâyede paylaşmak için{" "}
        <span className="font-medium text-black/55">{slug}</span> bağlantısını da kullanabilirsiniz.
      </p>
    </section>
  );
}

function ShareChip(props: {
  label: string;
  className: string;
  onClick: () => void | Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}) {
  const { label, className, onClick, children, disabled } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick()}
      className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${className}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {children}
      </span>
      {label}
    </button>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}
