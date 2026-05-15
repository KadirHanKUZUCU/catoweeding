-- Dijital Anı v2: moderasyon, davet kodu, topluluk kuralları, analitik, anı sayacı
-- Mevcut projede bir kez çalıştırın (schema.sql sonrası).

-- --- events genişletmesi ---
alter table public.events
  add column if not exists community_rules text;

update public.events
set community_rules = coalesce(
  community_rules,
  'Yüklediğiniz içerikler uygun ve saygılı olmalıdır. Uygunsuz, telif ihlali veya kişisel veri içeren gönderiler yönetici tarafından kaldırılabilir. Devam ederek bu kuralları kabul etmiş sayılırsınız.'
)
where community_rules is null;

alter table public.events
  alter column community_rules set default
    'Yüklediğiniz içerikler uygun ve saygılı olmalıdır. Uygunsuz, telif ihlali veya kişisel veri içeren gönderiler yönetici tarafından kaldırılabilir. Devam ederek bu kuralları kabul etmiş sayılırsınız.';

alter table public.events
  alter column community_rules set not null;

alter table public.events
  add column if not exists moderation_enabled boolean not null default false;

alter table public.events
  add column if not exists invite_code text null;

alter table public.events
  add column if not exists guest_page_views bigint not null default 0;

alter table public.events
  add column if not exists unique_visitor_count bigint not null default 0;

alter table public.events
  add column if not exists memory_submission_count bigint not null default 0;

create unique index if not exists events_invite_code_unique
  on public.events (invite_code)
  where invite_code is not null and length(trim(invite_code)) > 0;

-- --- memories moderasyon ---
alter table public.memories
  add column if not exists moderation_status text not null default 'approved';

alter table public.memories
  drop constraint if exists memories_moderation_status_chk;

alter table public.memories
  add constraint memories_moderation_status_chk
  check (moderation_status in ('pending', 'approved', 'hidden'));

-- --- ziyaretçi parmak izi (cihaz başına bir anahtar) ---
create table if not exists public.event_visitor_keys (
  event_id uuid not null references public.events (id) on delete cascade,
  visitor_key text not null,
  first_seen timestamptz not null default now(),
  primary key (event_id, visitor_key)
);

create index if not exists event_visitor_keys_event_idx on public.event_visitor_keys (event_id);

-- Yeni eklenen satırlarda etkinlik ayarına göre moderasyon
create or replace function public.memories_set_moderation_ins()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  en boolean;
begin
  select coalesce(moderation_enabled, false) into en from public.events where id = new.event_id;
  if en then
    new.moderation_status := 'pending';
  else
    new.moderation_status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists memories_moderation_ins on public.memories;
create trigger memories_moderation_ins
  before insert on public.memories
  for each row
  execute procedure public.memories_set_moderation_ins();

-- Anı sayısı (etkinlik bazında)
create or replace function public.sync_event_memory_submission_count()
returns trigger
language plpgsql
security invoker
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

drop trigger if exists memories_submission_ins on public.memories;
create trigger memories_submission_ins
  after insert on public.memories
  for each row
  execute procedure public.sync_event_memory_submission_count();

drop trigger if exists memories_submission_del on public.memories;
create trigger memories_submission_del
  after delete on public.memories
  for each row
  execute procedure public.sync_event_memory_submission_count();

update public.events e
set memory_submission_count = coalesce(
  (select count(*)::bigint from public.memories m where m.event_id = e.id),
  0
);

-- Misafir sayfası görüntüleme + benzersiz ziyaret
create or replace function public.track_guest_visit(p_event uuid, p_visitor_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := left(coalesce(nullif(trim(p_visitor_key), ''), 'anon'), 128);
begin
  with ins as (
    insert into public.event_visitor_keys as evk (event_id, visitor_key)
    values (p_event, k)
    on conflict (event_id, visitor_key) do nothing
    returning evk.event_id
  )
  update public.events ev
  set
    guest_page_views = guest_page_views + 1,
    unique_visitor_count = unique_visitor_count + (select count(*)::int from ins)
  where ev.id = p_event;
end;
$$;

grant execute on function public.track_guest_visit(uuid, text) to anon, authenticated;

-- Yönetim token ile ayarlar
create or replace function public.update_event_admin_settings(
  p_slug text,
  p_admin_token uuid,
  p_community_rules text,
  p_moderation_enabled boolean,
  p_invite_code text,
  p_clear_invite boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set
    community_rules = case
      when p_community_rules is null then community_rules
      when trim(p_community_rules) = '' then community_rules
      else trim(p_community_rules)
    end,
    moderation_enabled = p_moderation_enabled,
    invite_code = case
      when p_clear_invite then null
      when p_invite_code is null then invite_code
      when trim(p_invite_code) = '' then null
      else trim(p_invite_code)
    end
  where slug = p_slug and admin_token = p_admin_token;
end;
$$;

grant execute on function public.update_event_admin_settings(text, uuid, text, boolean, text, boolean)
  to anon, authenticated;

-- Moderasyon (gizle / onayla)
create or replace function public.moderate_memory(
  p_admin_token uuid,
  p_memory_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_status not in ('pending', 'approved', 'hidden') then
    raise exception 'Geçersiz moderasyon durumu';
  end if;

  update public.memories m
  set moderation_status = p_status
  from public.events e
  where m.id = p_memory_id
    and m.event_id = e.id
    and e.admin_token = p_admin_token;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Yetkisiz veya anı bulunamadı';
  end if;
end;
$$;

grant execute on function public.moderate_memory(uuid, uuid, text) to anon, authenticated;
