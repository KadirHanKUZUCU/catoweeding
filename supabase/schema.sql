-- Dijital Anı — Supabase şeması
-- Dashboard: Authentication > Providers > Anonymous > Enable

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  admin_token uuid not null default gen_random_uuid(),
  couple_names text not null,
  welcome_message text not null default 'Bize bir anı bırakın.',
  qr_background_path text,
  creator_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  note text,
  photo_path text,
  video_path text,
  created_at timestamptz not null default now()
);

create index if not exists memories_event_id_idx on public.memories (event_id);
create index if not exists memories_created_idx on public.memories (created_at desc);
create index if not exists events_creator_id_idx on public.events (creator_id);

alter table public.events enable row level security;
alter table public.memories enable row level security;

create policy "events_select" on public.events for select using (true);
create policy "events_insert" on public.events for insert with check (true);
create policy "events_delete" on public.events for delete
  using (auth.uid() is not null and auth.uid() = creator_id);

create policy "memories_select" on public.memories for select using (true);
create policy "memories_insert" on public.memories for insert
  with check (auth.uid() is not null and auth.uid() = owner_id);
create policy "memories_update" on public.memories for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "memories_delete" on public.memories for delete using (auth.uid() = owner_id);

-- Storage: Dashboard'da 'event-assets' ve 'memories' bucket'larını oluştur (public okuma için public).

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

create policy "event_assets_read"
  on storage.objects for select using (bucket_id = 'event-assets');

create policy "event_assets_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-assets');

create policy "event_assets_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-assets')
  with check (bucket_id = 'event-assets');

create policy "event_assets_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-assets');

create policy "memories_read"
  on storage.objects for select using (bucket_id = 'memories');

create policy "memories_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'memories');

create policy "memories_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'memories');

create policy "memories_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'memories');

create or replace function public.finalize_event_background(
  p_event uuid,
  p_admin uuid,
  p_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set qr_background_path = p_path
  where id = p_event and admin_token = p_admin;
end;
$$;

grant execute on function public.finalize_event_background(uuid, uuid, text) to anon, authenticated;
