# Cursor Notları — M10: Veritabanı Katmanı (RLS + RPC + Migration)

> Hata-tespit analizi (P1). SADECE tespit; çözüm Cursor'da. Boyut kodları: D4 yarış, D5 veri bütünlüğü, D6 güvenlik, D7 para.
> **Kapsam:** `supabase/migrations/*.sql` (gerçekte **176** migration — docs "89" diyor, bayat), `src/lib/supabase/types.ts`.
> **Genel:** RLS hijyeni iyi — hassas tablolar (orders, payments, design_files, returns, kvkk) `auth.uid()` bazlı izole, cross-tenant doğrudan okuma açığı YOK. Asıl risk: yetki grant'lerinin sessizce geri açılması + referral RPC caller guard + idempotency boşlukları.

## 🔴 KRİTİK

### K1. `fn_validate_fason_token` `authenticated`'a geri açılmış (revoke sessizce iptal) · D6/D4
- **Konum:** `089_fason_token_hash.sql:138`, `132_fason_token_max_use.sql:78` (kaynak revoke: Mig 023:1-12)
- **Sorun:** Mig 023 bu RPC'yi bilinçle `authenticated`'tan revoke etmiş (P0 notu). Mig 089 + 132 `grant execute ... to authenticated` ile geri açmış. Artık giriş yapmış herhangi bir müşteri partner token doğrulama RPC'sini çağırıp geçerli token'da `assignment_id/fason_partner_id/order_id` alabilir. `max_use_count` varsayılanı **200** (single-use değil) → sızan link 200 kez kullanılır.
- **Düzeltme:** `revoke execute on function public.fn_validate_fason_token(text) from authenticated;` (yalnız `service_role`). `max_use_count` varsayılanını 20-50'ye düşür.
- ⚠️ Bu, fason analizindeki "Doğrulanacaklar" şüphesinin DOĞRULANMIŞ halidir.

### K2. `fn_complete_referral` / `fn_apply_referral_code` caller kimlik doğrulaması yok · D6/D7
- **Konum:** `016_loyalty_systems.sql:194` (complete), `:137` (apply); ikisi de `grant ... to authenticated`
- **Sorun:** `fn_complete_referral(p_referred_user_id uuid)` parametreyi `auth.uid()` ile karşılaştırmıyor. Herhangi bir authenticated kullanıcı başka user_id ile çağırıp referrer'a %10 kupon (`REF-VIP-*`, 180 gün) ürettirebilir → kupon enflasyonu/para kaybı. `fn_create_order`/`fn_apply_coupon` `if auth.uid() <> p_user_id then raise 'unauthorized'` guard'ı koyarken bu ikisi koymamış.
- **Düzeltme:** İkisine `if auth.uid() <> p_*_user_id then raise exception 'unauthorized'` ekle; veya `authenticated` grant'ini kaldırıp trigger/`service_role`'a bırak.

## 🟠 YÜKSEK

### Y1. `v_customer_payments` view `security_invoker` set edilmemiş · D6
- **Konum:** `174_customer_payments_mask.sql:6-31`
- **Sorun:** Mig 174 `payments`'ı revoke edip maskeli view koymuş (doğru) ama `security_invoker=true` yok (Mig 157 yalnız fason/auditor view'larını dönüştürmüş). İçteki `where o.user_id = auth.uid()` izolasyonu sağladığı için **şu an sızıntı yok**, ama Security Advisor uyarısı + ileride filtresiz kolon eklenirse RLS bypass riski.
- **Düzeltme:** `alter view public.v_customer_payments set (security_invoker = true);`

### Y2. `design_files` INSERT'te kullanıcı `status='approved'` + keyfi `version` enjekte edebilir · D5/D6
- **Konum:** `003_returns_design_files.sql:142-151`
- **Sorun:** INSERT policy yalnız `user_id=auth.uid()` + order sahipliği doğruluyor; `status`/`version` kolonlarını kısıtlamıyor. Müşteri kendi siparişine `status='approved', approved_at=now()` ile dosya ekleyip QC/operatör onayını atlayabilir; `version` şişirip `fn_supersede_old_versions`'ı manipüle edebilir. WITH CHECK kolon değerini denetlemez.
- **Düzeltme:** INSERT policy'ye `and status = 'uploaded' and version = 1`; durum geçişlerini yalnız service_role/RPC üzerinden.

### Y3. `fn_refresh_fason_scores` / `fn_suggest_fason_partner` `authenticated`'a açık · D6
- **Konum:** `021_fason_performance_view.sql:140, 186-187`
- **Sorun:** Müşteri `fn_suggest_fason_partner(null)` ile fason partner adları/skorları/yük durumunu (tedarikçi istihbaratı) listeler; `fn_refresh_fason_scores()` ile gereksiz tüm-tablo yazımı (DoS/skor bozma) tetikler. Mig 085 benzer cron RPC'lerini revoke ederken bu ikisi atlanmış.
- **Düzeltme:** İkisinden `authenticated` grant'ini revoke et, yalnız `service_role`.

## 🟡 ORTA

### O1. Ölü `fn_apply_coupon` (eski) hâlâ DB'de — kilitsiz read-then-write · D6/D4
- **Konum:** `005_coupons_reviews.sql:108-195`; revoke `159_revoke_dead_apply_coupon.sql` (drop YOK). Yeni doğru sürüm: Mig 175 (`coupon_reservations` + `for update`).
- **Düzeltme:** Eski fonksiyonu `drop function` ile tamamen kaldır (saldırı yüzeyi sıfırla).

### O2. `coupon_uses` per-user limit hâlâ TOCTOU'ya açık · D4/D7
- **Konum:** `175_para_fix_coupons_payment.sql:99-106, 294-301`
- **Sorun:** `coupon_reservations` yalnız global `total_uses_limit` yarışını çözüyor (`unique(payment_intent_id)`). `per_user_limit` hâlâ `select count(*) from coupon_uses` read-then-write; aynı kullanıcı eşzamanlı iki intent açarsa ikisi de limitin altında görüp kupon uygular. `coupon_uses`'ta `(coupon_id,user_id)` partial unique yok (yalnız `unique(order_id)`).
- **Düzeltme:** per_user_limit=1 kuponlar için `coupon_uses(coupon_id,user_id)` partial unique index; veya rezervasyonu user bazında say.

### O3. `pricing_config` draft fiyatlar anon/authenticated'a açık · D6
- **Konum:** `047_pricing_config.sql:59-66` (`for select using(true) to anon,authenticated`)
- **Sorun:** RLS satır bazlı → hem `draft_config` hem `live_config` okunabilir. PostgREST'e `select=draft_config` atan biri yayınlanmamış marj stratejisini (fasonRate, marginPct) görür.
- **Düzeltme:** `v_pricing_live` view (yalnız live_config) üzerinden okut; tabloya doğrudan anon SELECT'i kapat.

### O4. `email_subscribers` INSERT `with check(true)` — spam/dedup yok · D6/D5
- **Konum:** `034_email_subscribers.sql:88-92`
- **Düzeltme:** `email` unique + `on conflict do nothing`; endpoint'te rate-limit.

### O5. `site_settings` SELECT `using(true)` — iş parametreleri açık · D6
- **Konum:** `029_site_settings.sql:36-38` (`welcome_credit_try`, `referral_credit_try` de okunuyor)
- **Düzeltme:** Gerekirse view ile yalnız kamuya açık alanları expose et.

### O6. `fn_log_audit` `actor_role`'ü sabit `'customer'` yazıyor — audit doğruluğu · D5
- **Konum:** `004_notifications_audit.sql:165-205`
- **Düzeltme:** `actor_role`'ü `profiles.role`'den türet.

## 🟢 DÜŞÜK / OLUMLU
- **Olumlu:** `payments_one_active_refund_per_order` partial unique (`069:40-43`) çift refund'u kapatıyor; `fn_finalize_paid_order` (Mig 033) `for update` + `status='consumed'` idempotency'si sağlam. **Para finalize akışı sağlam.**
- **D1:** Mig 156 `search_path=public` zorluyor; `digest()` çağrıları her yerde `extensions.digest(...)` tam nitelikli olduğu için kırılmıyor ama örtük bağımlılık kırılgan (niteliksiz `digest()` yazılırsa patlar). SECURITY DEFINER + sabit search_path → injection riski yok.
- **D2:** `order_assignments`/`fason_partners` yazma yalnız service_role (doğru); ama Mig 083'teki "Faz 2 partner-self RLS" hâlâ gelmemiş — partner doğrudan PostgREST'e bağlanırsa kendi atamalarını göremez (fonksiyonel eksik, açık değil).

## [KOZMETİK]
- `001_initial_schema.sql:11-12` "Tüm tablolar RLS aktif" yorumu bayat (wallet Mig 015'te drop).
- CLAUDE.md/AGENTS.md "89 migration" → gerçek 176; `schemaMigrations` güncellenmeli.
- `046_customer_admin_crm.sql:280` `v_customer_activity` view literal'inde emoji (`🛒🔐📧📝🎁`) — AGENTS.md emoji yasağıyla çelişir.
- Mig 174 yorumu "payments müşteriye kapalı" — view definer olduğu için ifade yanıltıcı.

## ❓ Doğrulanacaklar (canlı DB gerektirir)
1. **K1/Y3 fiili ACL:** Canlıda `\df+ fn_validate_fason_token` / `fn_suggest_fason_partner` — grant migration'da var ama sonradan manuel revoke edilmiş olabilir.
2. **Y1:** `select relname, reloptions from pg_class where relname='v_customer_payments'` → security_invoker durumu.
3. **`v_admin_customers`** (Mig 046, invoker) `auth.users`/`auth.mfa_factors` okuyor — invoker authenticated'ın `auth` şemasına SELECT'i var mı?
4. **O2:** `coupon_uses(coupon_id,user_id)` partial unique sonraki migration'larda eklenmiş mi (Mig 125+ taranmalı).
5. **O1:** Eski `fn_apply_coupon` canlıda drop edilmiş mi (Mig 159 sadece revoke etti).

**En kritik 3 aksiyon:** K1 (fason token revoke) → K2 (referral RPC caller guard) → Y2 (design_files status/version INSERT guard).
