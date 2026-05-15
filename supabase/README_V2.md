# v2 özellikleri (SQL)

Supabase SQL Editor’da **`migration_v2_features.sql`** dosyasını çalıştırın.

Eklenenler:

- `events`: `community_rules`, `moderation_enabled`, `invite_code`, `guest_page_views`, `unique_visitor_count`, `memory_submission_count`
- `memories`: `moderation_status` (`pending` | `approved` | `hidden`), insert öncesi tetikleyici ile moderasyon
- `event_visitor_keys` + `track_guest_visit` RPC (sayfa görüntüleme + benzersiz ziyaretçi)
- `update_event_admin_settings` + `moderate_memory` RPC (yönetim `admin_token` ile)

**Tetikleyici sözdizimi:** PostgreSQL sürümünüz `EXECUTE PROCEDURE` kabul etmiyorsa, aynı dosyada bu satırları `EXECUTE FUNCTION` ile değiştirmeyi deneyin.

## HEIC / Edge + sharp

Supabase Edge (Deno) üzerinde **sharp** yerel modülü pratik değildir. Bu projede HEIC, tarayıcıda **`heic2any`** ile JPEG’e çevrilip öyle yüklenir (iPhone uyumu). İleride ayrı bir Node worker + sharp da eklenebilir.

## PWA

Üretim build’inde `manifest.webmanifest` üretilir; cihazda «Ana ekrana ekle» ile kullanılabilir.
