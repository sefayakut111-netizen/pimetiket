# Mig 136 Apply — Supabase'e uygula (fason güvenlik + arşiv retention)

## DURUM
`supabase/migrations/136_akis_p1_fason_archive.sql` GIT'te + kod canlıda (commit 574b57e) AMA
**Supabase'e apply EDİLMEDİ.** Apply edilmeden fason download akışı YARIM:
- `fn_increment_fason_token_use` — kod çağırıyor (`api/fason/download/[token]/route.ts:126`) ama DB'de YOK → fason indirme HATA verebilir.
- `fn_validate_fason_token` hâlâ `authenticated`'a açık (güvenlik açığı canlıda).
- Auto-assign hataları sessiz (log eklenmedi).

> Bu migration **idempotent** — hepsi `create or replace function`. Tekrar çalışsa bile güvenli.
> Önceki turda Mig 135 Cursor MCP `apply_migration` ile uygulanmıştı — aynı yöntem.

## APPLY YÖNTEMİ

Supabase'e bağlı MCP `apply_migration` (veya SQL Editor) ile şu dosyanın TAM içeriğini uygula:
```
pim-etiket/core/storefront/supabase/migrations/136_akis_p1_fason_archive.sql
```
- Proje: **pimetiket-prod** (ref: `ucmpwxnoaqjpzhijnxtp`)
- Migration adı: `136_akis_p1_fason_archive`
- Dosyayı OLDUĞU GİBİ çalıştır — değiştirme, parçalama.

## İçindeki 6 obje (apply doğrulaması için)
1. `fn_auto_assign_partner_on_ready` (A1 — auto-assign hata logu)
2. `fn_validate_fason_token` + revoke authenticated / grant service_role (A6)
3. `fn_increment_fason_token_use` (A9 — yeni RPC, download endpoint çağırıyor)
4. `fn_assign_order_to_fason` (A7 — outbox'ta ham token yok)
5. `fn_mark_expired_designs_for_deletion` (C3 — cold dosya da işaretlenir)
6. `fn_renew_design_retention` (C4 — cold dosya retention uzar)

## SMOKE TEST (apply sonrası, SQL Editor'de doğrula)

```sql
-- 1. Yeni fonksiyon mevcut mu (A9 — en kritik, download bunu çağırıyor)
select proname from pg_proc where proname = 'fn_increment_fason_token_use';
-- → 1 satır dönmeli

-- 2. fn_validate_fason_token artık authenticated'a KAPALI mı (A6 güvenlik)
select grantee, privilege_type from information_schema.routine_privileges
where routine_name = 'fn_validate_fason_token';
-- → 'authenticated' GÖRÜNMEMELI, 'service_role' görünmeli

-- 3. Diğer 4 fonksiyon güncellendi mi (search_path + tanım)
select proname, prosecdef from pg_proc
where proname in ('fn_auto_assign_partner_on_ready','fn_assign_order_to_fason',
                  'fn_mark_expired_designs_for_deletion','fn_renew_design_retention');
-- → 4 satır, prosecdef=true (security definer)
```

## APPLY SONRASI — Sefa'ya bildir
1. 6 obje apply edildi mi (smoke 1-3 sonuçları)
2. Fason download endpoint artık çalışıyor mu (canlı: bir fason token ile `/api/fason/download/[token]` → 200 + use_count artar)
3. **Migration-history notu:** Mig 130-134 geçen turda script ile gitmiş, history tablosunda kayıtsızdı. 136'yı `apply_migration` ile uygularsan history'ye DÜŞER (135 gibi). Bu iyi — kayıt tutarlılığı.

> NOT: Bu bir APPLY işi, KOD DEĞİŞİKLİĞİ YOK. commit/push gerekmez (migration dosyası zaten commit'li).
> Sadece Supabase'e uygula + smoke test + sonuç bildir.
