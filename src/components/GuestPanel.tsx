import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { MemoryRow } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { publicUrl } from "../lib/storage";
import { storagePathIsHeic } from "../lib/storageDisplay";
import { submitGuestMemories } from "../lib/guestMemorySubmit";
import { normalizeGuestImageFile } from "../lib/heicConvert";
import {
  enqueueOfflineGuestSubmit,
  filesFromOffline,
  listOfflineGuestSubmits,
  removeOfflineGuestSubmit,
} from "../lib/offlineDrafts";
import { MediaLightbox, type MediaLightboxState } from "./MediaLightbox";
import {
  MAX_PHOTOS_PER_GUEST,
  MAX_VIDEOS_PER_GUEST,
  validateImageFile,
  validateVideoFile,
} from "../lib/uploads";

type DraftPhoto = { key: string; file: File; url: string; badPreview?: boolean };
type DraftVideo = { key: string; file: File; url: string };

function formatSupabaseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const o = err as { message: string; details?: string; hint?: string };
    const parts = [o.message, o.details, o.hint].filter(Boolean);
    return parts.join(" — ");
  }
  return "Kayıt başarısız.";
}

export function GuestPanel(props: {
  eventId: string;
  userId: string | null;
  memories: MemoryRow[];
  onChanged: () => Promise<void>;
  communityRules: string;
  moderationEnabled: boolean;
}) {
  const { eventId, userId, memories, onChanged, communityRules, moderationEnabled } = props;
  const [fullName, setFullName] = useState("");
  const [note, setNote] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [draftVideos, setDraftVideos] = useState<DraftVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<MediaLightboxState>(null);
  const [offlineQueued, setOfflineQueued] = useState(0);

  const assetsRef = useRef<{ photos: DraftPhoto[]; videos: DraftVideo[] }>({ photos: [], videos: [] });
  const submitLockRef = useRef(false);
  useEffect(() => {
    assetsRef.current = { photos: draftPhotos, videos: draftVideos };
  }, [draftPhotos, draftVideos]);

  useEffect(() => {
    return () => {
      for (const d of assetsRef.current.photos) URL.revokeObjectURL(d.url);
      for (const v of assetsRef.current.videos) URL.revokeObjectURL(v.url);
    };
  }, []);

  const refreshOfflineCount = useCallback(async () => {
    if (!userId) {
      setOfflineQueued(0);
      return;
    }
    const rows = await listOfflineGuestSubmits();
    setOfflineQueued(rows.filter((r) => r.eventId === eventId && r.userId === userId).length);
  }, [eventId, userId]);

  const flushOfflineQueue = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    const rows = (await listOfflineGuestSubmits()).filter((r) => r.eventId === eventId && r.userId === userId);
    for (const row of rows) {
      try {
        const { photoFiles, videoFiles } = filesFromOffline(row);
        await submitGuestMemories({
          supabase,
          eventId: row.eventId,
          userId: row.userId,
          fullName: row.fullName,
          noteTrimmed: row.note,
          photoFiles,
          videoFiles,
        });
        await removeOfflineGuestSubmit(row.id);
        toast.success("Kuyruktaki gönderi yüklendi.", { description: "Diğerleri de sırayla denenecek." });
        await onChanged();
      } catch {
        break;
      }
    }
    await refreshOfflineCount();
  }, [eventId, userId, onChanged, refreshOfflineCount]);

  useEffect(() => {
    void refreshOfflineCount();
  }, [eventId, userId]);

  useEffect(() => {
    if (!userId) return;
    window.addEventListener("online", flushOfflineQueue);
    void flushOfflineQueue();
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, [userId, flushOfflineQueue]);

  const mine = useMemo(
    () => memories.filter((m) => userId && m.owner_id === userId),
    [memories, userId],
  );

  const photoCount = useMemo(() => mine.filter((m) => m.photo_path).length, [mine]);
  const videoCount = useMemo(() => mine.filter((m) => m.video_path).length, [mine]);

  function addDraftPhotosFromList(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = [...fileList];
    setDraftPhotos((prev) => {
      const next = [...prev];
      for (const file of files) {
        const err = validateImageFile(file);
        if (err) {
          toast.error(err);
          continue;
        }
        if (photoCount + next.length >= MAX_PHOTOS_PER_GUEST) {
          toast.error(`Bu etkinlikte en fazla ${MAX_PHOTOS_PER_GUEST} fotoğraf ekleyebilirsiniz.`);
          break;
        }
        next.push({
          key: nanoid(),
          file,
          url: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }

  function addDraftVideosFromList(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = [...fileList];
    setDraftVideos((prev) => {
      const next = [...prev];
      for (const file of files) {
        const err = validateVideoFile(file);
        if (err) {
          toast.error(err);
          continue;
        }
        if (videoCount + next.length >= MAX_VIDEOS_PER_GUEST) {
          toast.error(`Bu etkinlikte en fazla ${MAX_VIDEOS_PER_GUEST} video ekleyebilirsiniz.`);
          break;
        }
        next.push({ key: nanoid(), file, url: URL.createObjectURL(file) });
      }
      return next;
    });
  }

  function removeDraftPhoto(key: string) {
    setDraftPhotos((prev) => {
      const d = prev.find((x) => x.key === key);
      if (d) URL.revokeObjectURL(d.url);
      return prev.filter((x) => x.key !== key);
    });
  }

  function removeDraftVideo(key: string) {
    setDraftVideos((prev) => {
      const d = prev.find((x) => x.key === key);
      if (d) URL.revokeObjectURL(d.url);
      return prev.filter((x) => x.key !== key);
    });
  }

  function clearDraftPhotos() {
    setDraftPhotos((prev) => {
      for (const d of prev) URL.revokeObjectURL(d.url);
      return [];
    });
  }

  function clearDraftVideos() {
    setDraftVideos((prev) => {
      for (const d of prev) URL.revokeObjectURL(d.url);
      return [];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current || busy) return;
    if (!userId) {
      toast.error("Oturum hazır değil. Sayfayı yenileyin.", {
        description: "Misafir oturumu (anonim) oluşmadıysa Supabase Anonymous açık olmalı.",
      });
      return;
    }
    if (!fullName.trim()) {
      toast.error("Ad soyad gerekli.");
      return;
    }
    const nPhotos = draftPhotos.length;
    const nVideos = draftVideos.length;
    if (nPhotos === 0 && nVideos === 0 && !note.trim()) {
      toast.error("En az bir fotoğraf, video veya not ekleyin.");
      return;
    }

    if (photoCount + nPhotos > MAX_PHOTOS_PER_GUEST) {
      toast.error(`Bu etkinlikte en fazla ${MAX_PHOTOS_PER_GUEST} fotoğraf yükleyebilirsiniz.`);
      return;
    }
    if (videoCount + nVideos > MAX_VIDEOS_PER_GUEST) {
      toast.error(`Bu etkinlikte en fazla ${MAX_VIDEOS_PER_GUEST} video yükleyebilirsiniz.`);
      return;
    }

    setBusy(true);
    submitLockRef.current = true;
    const noteVal = note.trim() || null;
    const nameVal = fullName.trim();

    let photoFiles: File[] = [];
    try {
      photoFiles = await Promise.all(draftPhotos.map((d) => normalizeGuestImageFile(d.file)));
    } catch (convErr: unknown) {
      const m = convErr instanceof Error ? convErr.message : "Görsel dönüştürülemedi.";
      toast.error(m);
      submitLockRef.current = false;
      setBusy(false);
      return;
    }
    const videoFiles = draftVideos.map((v) => v.file);

    try {
      await submitGuestMemories({
        supabase,
        eventId,
        userId,
        fullName: nameVal,
        noteTrimmed: noteVal,
        photoFiles,
        videoFiles,
      });

      const sent = nPhotos + nVideos;
      if (sent > 1) {
        toast.success(`${sent} dosya kaydedildi.`, { description: "Gönderileriniz aşağıdaki listede görünür." });
      } else if (nPhotos + nVideos === 1) {
        toast.success("Anınız kaydedildi.", {
          description: moderationEnabled
            ? "Yönetici onayından sonra herkese açık akışta görünebilir."
            : "Aşağıdaki listeden önizleyebilir veya notu düzenleyebilirsiniz.",
        });
      } else {
        toast.success("Notunuz kaydedildi.", { description: "Listede görünüyor." });
      }
      clearDraftPhotos();
      clearDraftVideos();
      setNote("");
      await onChanged();
      await refreshOfflineCount();
    } catch (err: unknown) {
      const fetchFailed =
        !navigator.onLine ||
        (err instanceof TypeError && String(err.message).toLowerCase().includes("fetch")) ||
        (err instanceof Error && err.message.toLowerCase().includes("network"));
      if (fetchFailed && (photoFiles.length > 0 || videoFiles.length > 0 || noteVal)) {
        try {
          await enqueueOfflineGuestSubmit({
            eventId,
            userId,
            fullName: nameVal,
            note: noteVal,
            photoFiles,
            videoFiles,
          });
          toast.message("Çevrimdışı kuyruk", {
            description: "İnternet gelince otomatik gönderilecek; «Şimdi dene» ile de zorlayabilirsiniz.",
          });
          clearDraftPhotos();
          clearDraftVideos();
          setNote("");
          await refreshOfflineCount();
        } catch {
          toast.error(formatSupabaseError(err));
        }
      } else {
        toast.error(formatSupabaseError(err));
      }
    } finally {
      submitLockRef.current = false;
      setBusy(false);
    }
  }

  const remainingPhotoSlots = MAX_PHOTOS_PER_GUEST - photoCount - draftPhotos.length;
  const remainingVideoSlots = MAX_VIDEOS_PER_GUEST - videoCount - draftVideos.length;

  return (
    <div className="flex flex-col gap-8">
      <MediaLightbox state={preview} onClose={() => setPreview(null)} />
      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border border-white/25 bg-white/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-8"
      >
        <h2 className="font-display text-2xl font-semibold">Bırakacağınız anı</h2>
        {offlineQueued > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/95 px-3 py-2 text-xs text-sky-950/90">
            <span>
              Çevrimdışı kuyrukta <strong>{offlineQueued}</strong> gönderi var.
            </span>
            <button
              type="button"
              className="rounded-xl bg-sky-900 px-3 py-1.5 text-[11px] font-semibold text-white"
              onClick={() => void flushOfflineQueue()}
            >
              Şimdi dene
            </button>
          </div>
        ) : null}
        {moderationEnabled ? (
          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-xs leading-relaxed text-amber-950/90">
            Bu etkinlikte fotoğraf ve videolar önce yönetici onayına düşer; onaylananlar paylaşılan akışta görünür.
            Kendi gönderilerinizi aşağıda her zaman görebilirsiniz.
          </p>
        ) : null}
        <details className="rounded-2xl border border-black/10 bg-white/60 px-3 py-2 text-xs text-black/55">
          <summary className="cursor-pointer font-medium text-black/65">Topluluk kuralları</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed">{communityRules}</p>
        </details>
        <p className="text-xs text-black/50">
          Birden fazla fotoğraf veya video seçebilir, küçük kareye tıklayıp büyük önizleme açabilir, yanlış olanı
          kaldırabilirsiniz. Kayıtlı: foto {photoCount}/{MAX_PHOTOS_PER_GUEST}, video {videoCount}/
          {MAX_VIDEOS_PER_GUEST}. Bu gönderi: foto {draftPhotos.length}, video {draftVideos.length}.
        </p>
        <div>
          <label className="text-sm font-medium text-black/65">Ad soyad</label>
          <input
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 font-display text-lg outline-none ring-[var(--color-gold)]/35 focus:ring-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="İsminiz soyisminiz"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-black/65">Fotoğraflar (galeri, çoklu)</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/12 bg-black/5 px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/10 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40">
                <span className="rounded-xl bg-black/85 px-3 py-1.5 text-xs font-semibold text-white">Dosya seç</span>
                <span className="text-xs text-black/50">
                  {draftPhotos.length > 0 ? `${draftPhotos.length} taslak` : "Henüz seçim yok"}
                </span>
                <input
                  type="file"
                  multiple
                  disabled={remainingPhotoSlots <= 0}
                  className="sr-only"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                  onChange={(e) => {
                    addDraftPhotosFromList(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {remainingPhotoSlots <= 0 ? (
              <p className="mt-1 text-xs text-amber-800/90">Fotoğraf kotası doldu.</p>
            ) : (
              <p className="mt-1 text-xs text-black/45">En fazla {remainingPhotoSlots} fotoğraf daha ekleyebilirsiniz.</p>
            )}
            {draftPhotos.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {draftPhotos.map((d) => (
                  <li key={d.key} className="relative overflow-hidden rounded-xl border border-black/10">
                    <button
                      type="button"
                      className="relative block aspect-square w-full bg-black/5 text-left"
                      onClick={() =>
                        d.badPreview
                          ? setPreview({
                              kind: "info",
                              title: d.file.name,
                              body: "Bu görsel bu tarayıcıda önizlenemiyor. JPG veya PNG olarak kaydedip tekrar seçebilirsiniz; gönderim yine de yapılmış olabilir.",
                            })
                          : setPreview({
                              kind: "image",
                              url: d.url,
                              title: d.file.name,
                            })
                      }
                    >
                      {d.badPreview ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-black/55">
                          <span className="font-semibold">Önizleme yok</span>
                          <span className="leading-tight">Tıklayıp bilgi alın veya kaldırın.</span>
                        </div>
                      ) : (
                        <img
                          src={d.url}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() =>
                            setDraftPhotos((prev) =>
                              prev.map((p) => (p.key === d.key ? { ...p, badPreview: true } : p)),
                            )
                          }
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDraftPhoto(d.key);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <label className="text-sm font-medium text-black/65">Videolar (galeri, çoklu)</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/12 bg-black/5 px-3 py-2 text-sm font-semibold text-black/80 hover:bg-black/10 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40">
                <span className="rounded-xl bg-black/85 px-3 py-1.5 text-xs font-semibold text-white">Dosya seç</span>
                <span className="text-xs text-black/50">
                  {draftVideos.length > 0 ? `${draftVideos.length} taslak` : "Henüz seçim yok"}
                </span>
                <input
                  type="file"
                  multiple
                  disabled={remainingVideoSlots <= 0}
                  className="sr-only"
                  accept=".mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => {
                    addDraftVideosFromList(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {remainingVideoSlots <= 0 ? (
              <p className="mt-1 text-xs text-amber-800/90">Video kotası doldu.</p>
            ) : (
              <p className="mt-1 text-xs text-black/45">En fazla {remainingVideoSlots} video daha ekleyebilirsiniz.</p>
            )}
            {draftVideos.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {draftVideos.map((v) => (
                  <li key={v.key} className="relative overflow-hidden rounded-xl border border-black/10">
                    <button
                      type="button"
                      className="relative block aspect-square w-full bg-black/80"
                      onClick={() => setPreview({ kind: "video", url: v.url, title: v.file.name })}
                    >
                      <video src={v.url} className="h-full w-full object-cover" muted playsInline />
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-white/90">
                        ▶
                      </span>
                    </button>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDraftVideo(v.key);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-black/65">Not (isteğe bağlı)</label>
          <textarea
            className="mt-2 min-h-[100px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-[var(--color-gold)]/35 focus:ring-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Kısa bir mesajınız…"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !userId}
          className="w-full rounded-2xl bg-[var(--color-ink)] py-3 text-sm font-semibold text-[var(--color-parchment)] disabled:opacity-50"
        >
          {busy ? "Gönderiliyor…" : !userId ? "Oturum bekleniyor…" : "Anıyı gönder"}
        </button>
      </form>

      <aside className="rounded-3xl border border-white/20 bg-white/75 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.2)] backdrop-blur-md">
        <h3 className="font-display text-xl font-semibold">Sizin gönderileriniz</h3>
        <p className="mt-2 text-xs leading-relaxed text-black/50">
          Fotoğraf ve videolarınız tek blokta toplanır; her kareye tıklayıp büyütebilir, tek tek silebilir veya tümünü
          kaldırabilirsiniz. Not, bu etkinlikteki tüm satırlarınıza birden uygulanır.
        </p>
        <ul className="mt-5 space-y-4">
          {mine.length === 0 ? (
            <li className="text-sm text-black/45">Henüz kayıtlı anınız yok.</li>
          ) : userId ? (
            <GuestMineGroup eventId={eventId} userId={userId} memories={mine} onChanged={onChanged} />
          ) : null}
        </ul>
      </aside>
    </div>
  );
}

function GuestMineGroup(props: {
  eventId: string;
  userId: string;
  memories: MemoryRow[];
  onChanged: () => Promise<void>;
}) {
  const { eventId, userId, memories, onChanged } = props;
  const sorted = useMemo(
    () => [...memories].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [memories],
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState<MediaLightboxState>(null);

  useEffect(() => {
    const uniq = new Set(sorted.map((m) => (m.note ?? "").trim()));
    const first = sorted[0];
    setNote(uniq.size <= 1 ? (first?.note ?? "") : (first?.note ?? ""));
  }, [sorted]);

  const fullName = sorted[0]?.full_name ?? "";
  const anyPending = sorted.some((m) => (m.moderation_status ?? "approved") === "pending");
  const anyHidden = sorted.some((m) => (m.moderation_status ?? "approved") === "hidden");
  const noteMismatch = useMemo(() => {
    const uniq = new Set(sorted.map((m) => (m.note ?? "").trim()));
    return uniq.size > 1;
  }, [sorted]);

  async function saveAllNotes() {
    setSaving(true);
    const { error } = await supabase
      .from("memories")
      .update({ note: note.trim() || null })
      .eq("event_id", eventId)
      .eq("owner_id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Not güncellendi.", { description: "Tüm gönderilerinize uygulandı." });
      await onChanged();
    }
  }

  function askDeleteAll() {
    toast("Tüm gönderilerinizi silmek istiyor musunuz?", {
      description: `${sorted.length} kayıt ve dosyalar kaldırılır.`,
      duration: 20000,
      action: {
        label: "Evet, tümünü sil",
        onClick: () => void performDeleteAll(),
      },
      cancel: { label: "Vazgeç", onClick: () => {} },
    });
  }

  async function performDeleteAll() {
    for (const m of sorted) {
      const paths = [m.photo_path, m.video_path].filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from("memories").remove(paths);
      const { error } = await supabase.from("memories").delete().eq("id", m.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Tümünü sildiniz.");
    await onChanged();
  }

  async function removeMemoryRow(m: MemoryRow) {
    const paths = [m.photo_path, m.video_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("memories").remove(paths);
    const { error } = await supabase.from("memories").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Silindi.");
      await onChanged();
    }
  }

  const withMedia = useMemo(() => sorted.filter((m) => m.photo_path || m.video_path), [sorted]);
  const noteOnlyRows = useMemo(() => sorted.filter((m) => !m.photo_path && !m.video_path), [sorted]);

  const noteDirty = useMemo(() => {
    const t = note.trim();
    return sorted.some((m) => (m.note ?? "").trim() !== t);
  }, [sorted, note]);

  return (
    <li className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <MediaLightbox state={viewer} onClose={() => setViewer(null)} />
      <p className="font-display text-lg font-semibold">{fullName}</p>
      {anyPending ? (
        <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
          Bazı içerikler onay bekliyor
        </p>
      ) : null}
      {anyHidden ? (
        <p className="mt-1 text-[11px] text-red-700/90">Bazı içerikler yönetici tarafından gizlendi.</p>
      ) : null}

      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {withMedia.map((m) => (
          <MineThumb key={m.id} memory={m} onChanged={onChanged} onPreview={setViewer} />
        ))}
      </ul>
      {noteOnlyRows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-black/60">
          {noteOnlyRows.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.04] px-2 py-1.5">
              <span>Sadece not satırı</span>
              <button
                type="button"
                className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                onClick={() =>
                  toast("Bu not kaydını silmek istiyor musunuz?", {
                    duration: 14000,
                    action: { label: "Sil", onClick: () => void removeMemoryRow(m) },
                    cancel: { label: "Vazgeç", onClick: () => {} },
                  })
                }
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="mt-4 block text-xs font-medium text-black/55">Not (tüm gönderilerinize)</label>
      {noteMismatch ? (
        <p className="mt-1 text-[10px] text-amber-900/90">
          Farklı notlar vardı; kaydedince hepsi aynı metne çekilir.
        </p>
      ) : null}
      <textarea
        className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notunuz…"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || !noteDirty}
          onClick={() => void saveAllNotes()}
          className="rounded-xl bg-black/85 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Notu kaydet
        </button>
        <button
          type="button"
          onClick={askDeleteAll}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
        >
          Tümünü sil
        </button>
      </div>
    </li>
  );
}

function MineThumb(props: {
  memory: MemoryRow;
  onChanged: () => Promise<void>;
  onPreview: (s: MediaLightboxState) => void;
}) {
  const { memory, onChanged, onPreview } = props;
  const ph = memory.photo_path ? publicUrl("memories", memory.photo_path) : null;
  const vid = memory.video_path ? publicUrl("memories", memory.video_path) : null;
  const heicPhoto = memory.photo_path ? storagePathIsHeic(memory.photo_path) : false;
  const [photoBroken, setPhotoBroken] = useState(false);

  async function performRemove() {
    const paths = [memory.photo_path, memory.video_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("memories").remove(paths);
    const { error } = await supabase.from("memories").delete().eq("id", memory.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Silindi.");
    await onChanged();
  }

  function askRemove() {
    toast("Bu dosyayı silmek istiyor musunuz?", {
      duration: 16000,
      action: { label: "Evet, sil", onClick: () => void performRemove() },
      cancel: { label: "Vazgeç", onClick: () => {} },
    });
  }

  const showImg = Boolean(ph) && !photoBroken && !heicPhoto;

  let inner: ReactNode = null;
  if (heicPhoto && ph) {
    inner = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 p-1 text-center text-[9px] text-amber-950/90">
        HEIC
        <a href={ph} download className="font-semibold underline">
          İndir
        </a>
      </div>
    );
  } else if (ph && photoBroken) {
    inner = (
      <div className="flex h-full items-center justify-center p-1 text-center text-[9px] text-black/50">?</div>
    );
  } else if (showImg && ph) {
    inner = (
      <button
        type="button"
        className="h-full w-full"
        onClick={() => onPreview({ kind: "image", url: ph, title: "Fotoğraf" })}
      >
        <img
          src={ph}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setPhotoBroken(true)}
        />
      </button>
    );
  } else if (vid) {
    inner = (
      <button
        type="button"
        className="relative h-full w-full bg-black/90"
        onClick={() => onPreview({ kind: "video", url: vid, title: "Video" })}
      >
        <video src={vid} className="h-full w-full object-cover opacity-85" muted playsInline />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl text-white/90">
          ▶
        </span>
      </button>
    );
  }

  return (
    <li className="relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.06]">
      {inner}
      <button
        type="button"
        className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white"
        onClick={(e) => {
          e.stopPropagation();
          askRemove();
        }}
      >
        ×
      </button>
    </li>
  );
}
