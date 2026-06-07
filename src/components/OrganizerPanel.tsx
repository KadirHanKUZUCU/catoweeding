import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { EventRow, MemoryRow } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { buildGuestInviteMessage } from "../lib/shareMessage";
import { zipMemoriesFromRows } from "../lib/zipEventMemories";

type Ev = Pick<
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

export function OrganizerPanel(props: {
  slug: string;
  event: Ev;
  memories: MemoryRow[];
  guestEventUrl: string;
  adminToken: string | null;
  onReload: () => Promise<void>;
}) {
  const { slug, event, memories, guestEventUrl, adminToken, onReload } = props;
  const [rulesDraft, setRulesDraft] = useState(event.community_rules ?? "");
  const [inviteDraft, setInviteDraft] = useState(event.invite_code ?? "");
  const [saving, setSaving] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  useEffect(() => {
    setRulesDraft(event.community_rules ?? "");
    setInviteDraft(event.invite_code ?? "");
  }, [event]);

  const pending = useMemo(
    () => memories.filter((m) => (m.moderation_status ?? "approved") === "pending"),
    [memories],
  );

  const withMedia = useMemo(
    () => memories.filter((m) => m.photo_path || m.video_path),
    [memories],
  );

  async function saveSettings(clearInvite: boolean) {
    if (!adminToken) {
      toast.error("Bu tarayıcıda yönetim anahtarı yok.", {
        description: "Yönetim bağlantısını veya etkinlik oluşturduktan sonra açılan paneli bu cihazda bir kez açın.",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("update_event_admin_settings", {
      p_slug: slug,
      p_admin_token: adminToken,
      p_community_rules: rulesDraft,
      p_moderation_enabled: false,
      p_invite_code: inviteDraft.trim() || null,
      p_clear_invite: clearInvite,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Ayarlar kaydedildi.");
      await onReload();
    }
  }

  async function setModeration(id: string, status: "approved" | "hidden" | "pending") {
    if (!adminToken) {
      toast.error("Yönetim anahtarı yok.");
      return;
    }
    const { error } = await supabase.rpc("moderate_memory", {
      p_admin_token: adminToken,
      p_memory_id: id,
      p_status: status,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Güncellendi.");
      await onReload();
    }
  }

  async function downloadZip() {
    if (withMedia.length === 0) {
      toast.message("İndirilecek fotoğraf veya video yok.");
      return;
    }
    setZipBusy(true);
    try {
      await zipMemoriesFromRows(withMedia, event.couple_names);
      toast.success("ZIP indirildi.");
    } catch {
      toast.error("ZIP oluşturulamadı.");
    } finally {
      setZipBusy(false);
    }
  }

  function mailInvite() {
    const body = buildGuestInviteMessage({
      coupleNames: event.couple_names,
      guestUrl: guestEventUrl,
      welcomeMessage: event.welcome_message,
      inviteCode: event.invite_code,
    });
    const subject = encodeURIComponent(`${event.couple_names} — davet`);
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  return (
    <section className="space-y-8 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur md:p-8">
      <div>
        <h2 className="font-display text-2xl font-semibold">İstatistik ve yönetim</h2>
        <p className="mt-1 text-sm text-black/55">
          Misafir sayfası görüntülenmesi ve benzersiz ziyaretçi (bu tarayıcı parmak izi) sayıları yaklaşıktır.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Sayfa görüntüleme</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">{event.guest_page_views ?? 0}</dd>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Benzersiz ziyaretçi</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">{event.unique_visitor_count ?? 0}</dd>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-black/45">Gönderi (anı satırı)</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">{event.memory_submission_count ?? memories.length}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-black/10 pt-6">
        <button
          type="button"
          disabled={zipBusy}
          onClick={() => void downloadZip()}
          className="rounded-2xl bg-[var(--color-ink)] px-4 py-2.5 text-xs font-semibold text-[var(--color-parchment)] disabled:opacity-50"
        >
          {zipBusy ? "ZIP hazırlanıyor…" : "Tüm medyayı ZIP indir"}
        </button>
        <button
          type="button"
          onClick={mailInvite}
          className="rounded-2xl border border-black/15 bg-white px-4 py-2.5 text-xs font-semibold text-black/70"
        >
          E-posta daveti (şablon)
        </button>
      </div>

      {pending.length > 0 ? (
        <div className="border-t border-black/10 pt-6">
          <h3 className="font-display text-lg font-semibold">Onay bekleyenler ({pending.length})</h3>
          <ul className="mt-3 space-y-3">
            {pending.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{m.full_name}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-800 px-2 py-1 text-[11px] font-semibold text-white"
                    onClick={() => void setModeration(m.id, "approved")}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[11px] font-semibold text-red-700"
                    onClick={() => void setModeration(m.id, "hidden")}
                  >
                    Gizle
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-black/10 pt-6">
        <h3 className="font-display text-lg font-semibold">Topluluk ve davet</h3>
        <label className="mt-3 block text-xs font-medium text-black/55">Topluluk kuralları (misafirlerde gösterilir)</label>
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          value={rulesDraft}
          onChange={(e) => setRulesDraft(e.target.value)}
        />
        <label className="mt-3 block text-xs font-medium text-black/55">Davet kodu (boş bırakırsanız herkes girebilir)</label>
        <input
          className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          value={inviteDraft}
          onChange={(e) => setInviteDraft(e.target.value)}
          placeholder="Örn. AYSE2026"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings(false)}
            className="rounded-xl bg-black/85 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings(true)}
            className="rounded-xl border border-black/15 bg-white px-4 py-2 text-xs font-semibold text-black/70 disabled:opacity-50"
          >
            Davet kodunu kaldır
          </button>
        </div>
      </div>
    </section>
  );
}
