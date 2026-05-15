import { nanoid } from "nanoid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEnsureAnonymousSession } from "../hooks/useEnsureAnonymousSession";
import { rememberEvent } from "../lib/myEvents";
import { supabase } from "../lib/supabase";

export function CreateEventPage() {
  const navigate = useNavigate();
  const { ready, userId } = useEnsureAnonymousSession();
  const [coupleNames, setCoupleNames] = useState("");
  const [welcome, setWelcome] = useState(
    "Düğünümüze hoş geldiniz. Siz de bir anı bırakın — bir fotoğraf, kısa bir not ya da küçük bir video.",
  );
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !userId) {
      toast.error("Oturum hazırlanıyor, bir saniye sonra tekrar deneyin.");
      return;
    }
    if (!coupleNames.trim()) {
      toast.error("Çift isimlerini yazın.");
      return;
    }
    setBusy(true);
    const slug = nanoid(10);
    const { data: ev, error } = await supabase
      .from("events")
      .insert({
        slug,
        couple_names: coupleNames.trim(),
        welcome_message: welcome.trim() || "Bize bir anı bırakın.",
        creator_id: userId,
      })
      .select("id, slug, admin_token")
      .single();

    if (error || !ev) {
      toast.error(error?.message ?? "Etkinlik oluşturulamadı.");
      setBusy(false);
      return;
    }

    if (bgFile) {
      const maxBytes = 8 * 1024 * 1024;
      if (bgFile.size > maxBytes) {
        toast.error("Arka plan görseli en fazla 8 MB olabilir.");
        setBusy(false);
        return;
      }

      const { data: sessWrap } = await supabase.auth.getSession();
      if (!sessWrap.session) {
        const { error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) {
          toast.error("Yükleme için oturum açılamadı: " + authErr.message);
          setBusy(false);
          return;
        }
      }

      const extRaw = bgFile.name.includes(".") ? (bgFile.name.split(".").pop()?.toLowerCase() ?? "jpg") : "jpg";
      const ext = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(extRaw) ? extRaw : "jpg";
      const path = `${ev.id}/qr-bg.${ext}`;

      const mimeFromExt =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : ext === "heic" || ext === "heif"
                ? "image/heic"
                : "image/jpeg";
      const contentType = bgFile.type && bgFile.type.startsWith("image/") ? bgFile.type : mimeFromExt;

      const { error: upErr } = await supabase.storage.from("event-assets").upload(path, bgFile, {
        upsert: true,
        contentType,
      });
      if (upErr) {
        toast.error("Arka plan yüklenemedi: " + upErr.message, {
          description:
            "Supabase’de «event-assets» bucket’ı var mı? SQL’de event_assets UPDATE/DELETE politikaları uygulandı mı? (supabase/patch_event_assets_storage.sql)",
        });
        setBusy(false);
        return;
      }
      const { error: rpcErr } = await supabase.rpc("finalize_event_background", {
        p_event: ev.id,
        p_admin: ev.admin_token,
        p_path: path,
      });
      if (rpcErr) {
        toast.error("Arka plan kaydı tamamlanamadı: " + rpcErr.message);
        setBusy(false);
        return;
      }
    }

    rememberEvent({
      slug: ev.slug,
      admin_token: ev.admin_token,
      couple_names: coupleNames.trim(),
      created_at: new Date().toISOString(),
    });
    toast.success("Etkinlik hazır.", {
      description: "Organizatör paneli açıldı. Tam yönetim için «Etkinliklerim» veya kayıtlı yönetim bağlantınızı kullanın.",
    });
    sessionStorage.setItem(`admin:${ev.slug}`, ev.admin_token);
    setBusy(false);
    navigate(`/e/${ev.slug}/panel`);
  }

  return (
    <div className="space-y-10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-[var(--color-sage)]">
            Başlangıç
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">
            Etkinliğinizi açın,
            <span className="text-[var(--color-gold)]"> misafirleriniz anı bıraksın.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-black/60">
            Her oluşturma <strong className="font-medium text-black/70">yeni bir etkinlik</strong> kaydıdır (benzersiz
            bağlantı). Oluşturduklarınızı{" "}
            <strong className="font-medium text-black/70">Etkinliklerim</strong> sayfasından yönetebilirsiniz.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_20px_60px_rgba(26,20,18,0.08)] backdrop-blur"
        >
          <label className="block text-sm font-medium text-black/70">Çift / etkinlik başlığı</label>
          <input
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-display text-xl outline-none ring-[var(--color-gold)]/40 focus:ring-2"
            value={coupleNames}
            onChange={(e) => setCoupleNames(e.target.value)}
            placeholder="tombik döner &amp; cesur"
          />

          <label className="mt-6 block text-sm font-medium text-black/70">QR kartında görünecek mesaj</label>
          <textarea
            className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed outline-none ring-[var(--color-gold)]/40 focus:ring-2"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
          />

          <label className="mt-6 block text-sm font-medium text-black/70">
            QR arka plan görseli (isteğe bağlı)
          </label>
          <p className="mt-1 text-xs text-black/45">
            Görseliniz kartın tamamına yayılır; üzerine zarif tipografi ve şeffaf QR yerleştirilir. JPG, PNG, WebP veya
            GIF önerilir.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/12 bg-black/[0.04] px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/[0.07]">
              <span className="rounded-xl bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-[var(--color-parchment)]">
                Görsel seç
              </span>
              <span className="max-w-[200px] truncate text-xs text-black/50" title={bgFile?.name}>
                {bgFile ? bgFile.name : "Henüz dosya seçilmedi"}
              </span>
              <input
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                onChange={(e) => setBgFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={busy || !ready}
            className="mt-8 w-full rounded-2xl bg-[var(--color-ink)] py-3.5 text-sm font-semibold text-[var(--color-parchment)] transition hover:bg-black disabled:opacity-50"
          >
            {busy ? "Kaydediliyor…" : "Etkinliği oluştur"}
          </button>

          <p className="mt-4 text-center text-xs text-black/45">
            Zaten bir etkinlik mi var?{" "}
            <span className="text-black/55">Bağlantıyı veya QR’ı kaydetmeniz yeterli.</span>
          </p>
        </form>
      </div>
    </div>
  );
}
