-- Çift gönderim temizliği — Supabase SQL Editor'da sırayla çalıştırın.

-- 1) Aynı misafirin tekrarlayan not-only kayıtlarını sil (en eskisini bırak)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY event_id, owner_id, trim(coalesce(note, ''))
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
      PARTITION BY event_id, owner_id, trim(coalesce(note, ''))
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

-- Yalnızca berltB1nGh etkinliği için (1. adım):
-- WITH event_target AS (
--   SELECT id FROM public.events WHERE slug = 'berltB1nGh'
-- ),
-- ranked AS (
--   SELECT
--     m.id,
--     ROW_NUMBER() OVER (
--       PARTITION BY m.event_id, m.owner_id, trim(coalesce(m.note, ''))
--       ORDER BY m.created_at ASC
--     ) AS rn
--   FROM public.memories AS m
--   INNER JOIN event_target AS e ON m.event_id = e.id
--   WHERE m.photo_path IS NULL
--     AND m.video_path IS NULL
--     AND trim(coalesce(m.note, '')) <> ''
-- )
-- DELETE FROM public.memories AS m
-- USING ranked AS r
-- WHERE m.id = r.id
--   AND r.rn > 1;
