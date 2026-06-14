# Cursor Notları — M9: Kimlik, Oturum & RBAC

> Hata-tespit (P2). Boyut: D3 hata/fail-open, D4 yarış, D6 yetki. Partner OTP önceki turda (M6) incelendi — kapsam dışı.
> **Genel:** Route guard'ları iyi — örneklenen tüm yüksek-yetki uçları (bypass-checkout, manual, refund, kvkk, reset-password, admin-bypass-promote) doğru `assertPermission` modül/eylem guard'ı taşıyor, "-" açık admin ucu bulunmadı. **Asıl sorun guard'ların ARKASINDAKİ RBAC seed mantığı** (operations'ın fason:create'i, legacy NULL fallback).

## 🟠 YÜKSEK (privilege escalation / kimlik)

### B1. Partner impersonation `operations` rolüne açık · D6
- **Konum:** `api/admin/impersonate/partner/route.ts:47` (guard `assertPermission("fason","create")`) + seed `054_rbac_admin_roles.sql:59` (`operations` → `fason:create=true`)
- **Sorun:** super_admin olmayan `operations` çalışanı herhangi bir partner adına geçerli magic-link üretebilir → partner panel/üretim/dosya transferlerine erişir. Üstelik route hedef yoksa `auth.admin.createUser` (`:144`) + `profiles.role='partner'` upsert (`:196`) ile **yeni kimlik üretiyor**.
- **Düzeltme:** Impersonation'ı `assertPermission("staff","update")` veya özel `super_admin` kontrolüne bağla; `createUser` ile kimlik üretimini impersonation akışından çıkar (yalnız mevcut partner contact için magic-link).

### B2. Impersonation magic-link aynı tarayıcıda admin oturumunu ele geçiriyor (kapsamsız token) · D6
- **Konum:** `api/admin/impersonate/partner/route.ts:200-251` (uyarı 9-13, 248)
- **Sorun:** Üretilen `magiclink` kapsam sınırı olmayan tam login session açıyor; aynı tarayıcıda açılırsa admin cookie'leri partner session'a override oluyor. Tek koruma metinsel "incognito'da aç" uyarısı — teknik engel yok. Link 1 saat geçerli + response gövdesinde düz metin (log/proxy sızıntısı).
- **Düzeltme:** Scoped impersonation (kısa ömürlü, ayrı cookie namespace) yoksa: TTL düşür, tek kullanımlık işaretle + audit "tüketildi" durumu, response `no-store`.

### B3. Legacy admin fallback ile staff rol atama eskalasyonu · D6
- **Konum:** `api/admin/staff/[userId]/route.ts:37` + `assert-permission.ts:72` + `054:117-119`
- **Sorun:** PATCH guard doğru (`staff:update` yalnız super_admin). AMA `assertPermission`/`fn_has_permission`, `admin_role` NULL olan eski `role='admin'/'staff'` kullanıcıyı **super_admin gibi tam yetkili** sayıyor. Migration 054 öncesinden kalan/`admin_role` set edilmemiş herhangi bir staff hesabı bu uçtan **kendisi dahil herkese `super_admin` atayabilir**. "Kendi rolünü düşüremezsin" (56) yükseltmeyi engellemiyor.
- **Düzeltme:** Legacy fallback'i `staff`/`admin` modülleri için açıkça reddet; tüm canlı admin/staff hesaplarına `admin_role` NOT NULL backfill.

### B4. `auto-confirm` ile e-posta doğrulama bypass (üretimde açılabilir) · D6
- **Konum:** `api/auth/auto-confirm/route.ts:52-57` + `auth/page.tsx:311`
- **Sorun:** `ALLOW_AUTO_CONFIRM==="true"` ise, mail erişimi olmadan "son 60 sn'de oluşturulmuş + henüz confirmed değil" kriteriyle hesap onaylanıyor — sahiplik ispatı yok; aynı pencerede kayıt olan başka kullanıcı da onaylanabilir. IP rate-limit (5/60sn) zayıf engel.
- **Düzeltme:** Üretimde kalıcı kapat; zorunluysa onayı yalnız az önce signUp yapan oturumun kendi user_id'sine bağla (session-bound), e-posta tabanlı çağrıyı kaldır.

## 🟡 ORTA

### B5. MFA unenroll AAL2 / re-auth gerektirmiyor (MFA bypass) · D6
- **Konum:** `app/ayarlar/2fa/page.tsx:140-144` (yalnız `confirm()` + `unenroll`)
- **Sorun:** 2FA kaldırma yalnız tarayıcı `confirm()`'i ile; AAL2/parola/TOTP re-auth yok. Çalınmış AAL1 session 2FA'yı söküp koruma olmadan gezebilir.
- **Düzeltme:** `unenroll` öncesi taze TOTP challenge/verify veya parola reauth; admin için faktör kaldırmayı AAL2 şartına bağla.

### B6. Admin RBAC modül guard'ı non-prod'da fail-open · D3
- **Konum:** `lib/supabase/middleware.ts:404-419`
- **Sorun:** `fn_has_permission` RPC hatasında üretimde 503 (iyi), ama **production dışında yalnız `console.error` + devam** (`:418`, redirect yok) → erişime izin. Staging/preview gerçek veriyle çalıştığından modül guard'ı tamamen atlanabilir. (Route düzeyi `assertPermission` doğru fail-closed.)
- **Düzeltme:** `permErr`'de non-prod'da da `/admin` denied redirect; sessiz devam etme.

### B7. `log-failed-login` RPC fail-open → brute-force görünürlüğü düşüyor · D3
- **Konum:** `api/auth/log-failed-login/route.ts:81-86` (RPC hata → sessiz ok:false)
- **Sorun:** Tasarımla fail-open; RPC sürekli hata verirse SecurityAuditor brute-force eşiği (10+/15dk) hiç tetiklenmez → saldırgan kaydettirmeden parola dener.
- **Düzeltme:** RPC kalıcı hatasında alarm/metrik; login'i bozmadan dahili sayaç.

### B8. Audit `actor_role` hardcode (view-mode/impersonate "admin") · D6
- **Konum:** `api/view-mode/route.ts:85`, `impersonate/route.ts:223` (`actor_role:"admin"` sabit)
- **Sorun:** `staff` kullanıcı partner preview/impersonate yapınca audit "admin" yazıyor — gerçek staff eylemleri admin olarak loglanıyor (adli iz yanlış).
- **Düzeltme:** Gerçek `auth.role`/`admin_role` kullan; hardcode kaldır.

### B9. `auth-bridge` istemci rol/oturum cache yarışı · D4
- **Konum:** `lib/supabase/auth-bridge.ts:22-49` (`cachedUser`) — admin→view-mode geçişinde dispatch event kaçarsa client UI eski kimlikle gösterim. Güvenlik kararı sunucuda olduğu için düşük etki.
- **Düzeltme:** view-mode toggle + impersonation sonrası `clearUserCache` garanti et.

## 🟢 DÜŞÜK

### B10. Recovery flow: login'li kullanıcı `?code` ile oturum çakışması · D4
- **Konum:** `middleware.ts:458-467` + `sifre-sifirla/page.tsx:62` — login'liyken `/sifre-sifirla?code=` `exchangeCodeForSession` mevcut oturumun üstüne recovery hedefini bindirir → session başka hesaba kayabilir.
- **Düzeltme:** Exchange öncesi farklı oturumu signOut veya e-posta eşleşmesi doğrula.

### B11. `auto-confirm` yaş kontrolü TOCTOU · D4 — `findAuthUserByEmail`/`getUserById`/`updateUserById` arası pencere; B4 kapatılırsa düşer.

### B12. Refund route iç HTTP'de cookie forward — SSRF/çift-yetki · D6
- **Konum:** `api/admin/payments/refund/route.ts:67-84` — admin guard sonrası `origin`(env)+cookie ile `/api/payment/refund`'a iç istek; `origin` yanlışsa dış hedef.
- **Düzeltme:** İç HTTP yerine paylaşılan lib fonksiyonu; cookie forward'ı kaldır.

### B14. `assertAdminCompat("*","view")` granular rolleri yanlış reddediyor · D6
- **Konum:** `assert-permission.ts:96-98` + `054:55` — `*` modülü yalnız super_admin'de; compat wrapper kullanan eski uçlar `operations` vb. rolleri beklenmedik 403'ler. Açık değil, tutarsızlık.
- **Düzeltme:** Compat wrapper'ı modül-spesifik guard'lara migrate et.

## [KOZMETİK]
- `auth/page.tsx:130` URL error temizleme regex'i kırılgan (fonksiyonel risk yok).
- `admin-rbac.ts:135` `canAccessModule` perms null'da `true` — yalnız client nav görünürlüğü (sunucu guard ayrı).
- `staff/route.ts:79-111` her staff için sıralı `getUserById`+`listFactors` (N+1) — büyük ekipte yavaş.
- Harita §2'de `grant-credit` guard'ı "admin" yazıyor ama gerçekte **410 Gone** (`grant-credit/route.ts:24-61`, CLAUDE.md uyumlu) — harita yanıltıcı.

## ❓ Doğrulanacaklar (canlı/runtime)
1. **B3 etkisi:** `role IN ('admin','staff') AND admin_role IS NULL` kaç satır? Sıfırsa teorik, >0 ise aktif eskalasyon.
2. **B1:** Üretimde `operations` rolü atanmış kullanıcı var mı?
3. **B4:** Üretimde `ALLOW_AUTO_CONFIRM` değeri `"true"` mü?
4. **B6:** Staging/preview `NODE_ENV` "production" mı?
5. **B12:** Ana `/api/payment/refund` kendi `finans` guard'ına sahip mi (savunma derinliği).

**En ağır:** B1 (operations→partner impersonation) + B3 (legacy-admin self-grant super_admin) — privilege escalation; B4 (auto-confirm bypass) + B5 (MFA unenroll reauth yok) kimlik bütünlüğü; B6 non-prod fail-open.
