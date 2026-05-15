-- Bir kerelik: mevcut projede çalıştırın (SQL Editor)
-- Oluşturan kullanıcıyı events tablosuna bağlar; "Etkinliklerim" listesi için gerekli.

alter table public.events
  add column if not exists creator_id uuid references auth.users (id) on delete set null;

create index if not exists events_creator_id_idx on public.events (creator_id);

-- İsteğe bağlı: yalnızca kendi satırını creator_id ile güncellemek ileride için
-- şimdilik insert uygulamadan creator_id ile geliyor.

comment on column public.events.creator_id is 'Anonim auth.uid(); Etkinliklerim sayfası filtresi';
