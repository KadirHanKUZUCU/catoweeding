-- Çift gönderim temizliği — Supabase SQL Editor'da 1. adımı çalıştırın.
-- Not karşılaştırması: küçük harf + fazla boşluk temizlenir.

-- 1) Tekrarlayan not-only kayıtlarını sil (en eskisini bırak)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        event_id,
        owner_id,
        lower(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.memories
  WHERE photo_path IS NULL
    AND video_path IS NULL
    AND trim(coalesce(note, '')) <> ''
)
DELETE FROM public.memories AS m
USING ranked AS r
WHERE m.id = r.id
  AND r.rn > 1;

-- 2) Medyalı satırlarda tekrarlayan not metnini temizle (ilk satırda kalır)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        event_id,
        owner_id,
        lower(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.memories
  WHERE trim(coalesce(note, '')) <> ''
    AND (photo_path IS NOT NULL OR video_path IS NOT NULL)
)
UPDATE public.memories AS m
SET note = NULL
FROM ranked AS r
WHERE m.id = r.id
  AND r.rn > 1;

-- 3) Boş hayalet satırları sil (medya yok, not yok)
DELETE FROM public.memories
WHERE photo_path IS NULL
  AND video_path IS NULL
  AND trim(coalesce(note, '')) = '';

-- Kontrol: aynı misafir + aynı not kaç satır kaldı?
-- SELECT owner_id, note, count(*) FROM public.memories
-- WHERE photo_path IS NULL AND video_path IS NULL AND trim(coalesce(note,'')) <> ''
-- GROUP BY owner_id, lower(trim(note)) HAVING count(*) > 1;
