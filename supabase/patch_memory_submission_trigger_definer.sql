-- Misafir anı eklerken "new row violates row-level security policy" hatası:
-- AFTER INSERT tetikleyicisi events.memory_submission_count alanını güncelliyordu;
-- security invoker ile misafirin events üzerinde UPDATE yetkisi yoktu, INSERT geri alınıyordu.
-- Bir kez Supabase SQL Editor'da çalıştırın.

create or replace function public.sync_event_memory_submission_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.events
    set memory_submission_count = memory_submission_count + 1
    where id = new.event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.events
    set memory_submission_count = greatest(0, memory_submission_count - 1)
    where id = old.event_id;
    return old;
  end if;
  return null;
end;
$$;
