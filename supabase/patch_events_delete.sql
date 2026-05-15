-- Etkinlik sahibi (creator_id) kendi etkinliğini silebilsin.
-- Supabase SQL Editor'da bir kez çalıştırın.

drop policy if exists "events_delete" on public.events;

create policy "events_delete" on public.events
  for delete
  using (auth.uid() is not null and auth.uid() = creator_id);
