-- Mevcut projede bir kez çalıştırın (SQL Editor).
-- event-assets bucket'ında upsert (üzerine yazma) için UPDATE/DELETE gerekir; yoksa HTTP 400 görebilirsiniz.

drop policy if exists "event_assets_update" on storage.objects;
drop policy if exists "event_assets_delete" on storage.objects;

create policy "event_assets_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-assets')
  with check (bucket_id = 'event-assets');

create policy "event_assets_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-assets');
