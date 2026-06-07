-- Tekrarlayan notları tek satırda bırakır (kayıt silinmez, yalnızca fazla note alanları NULL olur).
-- Supabase SQL Editor'da çalıştırın.

-- Tüm etkinlikler için:
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY event_id, owner_id, trim(coalesce(note, ''))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.memories
  WHERE trim(coalesce(note, '')) <> ''
)
UPDATE public.memories AS m
SET note = NULL
FROM ranked AS r
WHERE m.id = r.id
  AND r.rn > 1;

-- Yalnızca berltB1nGh etkinliği için:
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
--   WHERE trim(coalesce(m.note, '')) <> ''
-- )
-- UPDATE public.memories AS m
-- SET note = NULL
-- FROM ranked AS r
-- WHERE m.id = r.id
--   AND r.rn > 1;
