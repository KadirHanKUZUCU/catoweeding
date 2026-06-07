-- Çift gönderim temizliği — Supabase SQL Editor'da sırayla çalıştırın.
-- ÖNEMLİ: Önce 1. adım (notları silmeden çift kayıtları temizler).

-- 1) Aynı misafirin 30 sn içindeki çift gönderimlerini sil (en eskisini bırak)
--    Not boş olsa bile (daha önce NULL yapılmış tekrarlar dahil)
WITH ordered AS (
  SELECT
    id,
    created_at,
    LAG(created_at) OVER (
      PARTITION BY event_id, owner_id
      ORDER BY created_at ASC
    ) AS prev_at,
    LAG(lower(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g')))) OVER (
      PARTITION BY event_id, owner_id
      ORDER BY created_at ASC
    ) AS prev_note,
    lower(trim(regexp_replace(coalesce(note, ''), '\s+', ' ', 'g'))) AS note_key
  FROM public.memories
)
DELETE FROM public.memories AS m
USING ordered AS o
WHERE m.id = o.id
  AND o.prev_at IS NOT NULL
  AND o.created_at - o.prev_at <= interval '30 seconds'
  AND (
    o.note_key = ''
    OR o.note_key = coalesce(o.prev_note, '')
  );

-- 2) Aynı not metnine sahip tekrarlayan kayıtları sil (en eskisini bırak)
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
)
DELETE FROM public.memories AS m
USING ranked AS r
WHERE m.id = r.id
  AND r.rn > 1;

-- 3) Boş hayalet satırları sil (medya yok, not yok)
DELETE FROM public.memories
WHERE photo_path IS NULL
  AND video_path IS NULL
  AND trim(coalesce(note, '')) = '';

-- Kontrol:
-- SELECT owner_id, note, photo_path, video_path, created_at
-- FROM public.memories
-- ORDER BY owner_id, created_at;
