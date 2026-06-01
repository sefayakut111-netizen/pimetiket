# P1 Fix — Tema 3: Güvenlik & RLS & Şema (10 görev)

Denetim (1 Haz) doğrulanmış P1'leri. `guvenlik-uyum` + `backend` domaini.
Migration'lar: dosya yaz + push, **apply Sefa manuel**. Bazı maddeler **SADECE MANUEL** (kod yok) — aşağıda işaretli.

---

## GÖREV 1/10 — Partner impersonation: yetki eşiği + audit [security, conf 0.97]

#### Dosya: `src/app/api/admin/impersonate/partner/route.ts`

`assertPermission("fason","view")` — sadece görüntüleme yetkili staff impersonate edebiliyor. Audit yok
(sadece console.log, satır 171-174). KVKK m.12 + sözleşme uyumu için kalıcı iz yok.

**Fix:**
1. `assertPermission("fason","view")` → `assertPermission("fason","create")` (veya özel "impersonate" action).
2. `audit_log` INSERT (`action:'admin.impersonate_partner'`, actor_id, target=partner_id, detail) — try-catch DIŞINDA; başarısızsa 500, **impersonation log alınmadan gerçekleşmesin**.

**Doğrulama:** view-only staff 403 alır; başarılı impersonation audit_log'da görünür.

---

## GÖREV 2/10 — Staff başka admin/staff'ı suspend/delete edebilir [security, conf 0.95]

#### Dosyalar: `src/app/api/admin/customers/[id]/suspend/route.ts` + `.../[id]/route.ts` (DELETE)

Sadece `id === auth.user.id` self-kontrol var. Hedefin `profiles.role` kontrolü YOK → customers.update
yetkili staff, başka admin/staff'ı ban/delete edebilir.

**Fix:** Ban/delete öncesi `admin.from('profiles').select('role').eq('id', id)`; role 'admin'|'staff' ise 403 (yalnız 'customer' işlenebilir).

**Doğrulama:** Staff, admin/staff hedefi suspend/delete edemez (403); customer normal işlenir.

---

## GÖREV 3/10 — X-Forwarded-For spoofable rate-limit key [security, conf 0.91]

#### Dosya: `src/lib/rate-limit.ts` → `getClientIp()` (~satır 169-174)

`x-forwarded-for`'un İLK elemanı (`split(',')[0]`) alınıyor — istemci spoof edebilir → her istekte farklı
IP → tüm rate-limit'ler (lead/subscribe, pim/chat, auto-confirm) bypass.

**Fix:** Vercel'de güvenilir IP SON segmentte: `xff.split(',').at(-1)?.trim()` veya `x-real-ip`'e öncelik ver.

**Doğrulama:** Sahte `X-Forwarded-For` header rate-limit'i atlatmaz.

---

## GÖREV 4/10 — fason_access_tokens kullanım limiti yok [security, conf 0.90]

#### Yeni migration + 2 endpoint

Mig 089 `use_count` artırıyor ama limit uygulamıyor → token ele geçirilirse süresiz kullanılır.

**Fix:**
1. Migration: `fason_access_tokens`'a `max_use_count int default 200` (`add column if not exists`); `fn_validate_fason_token`'a `use_count >= max_use_count → reason:'token_limit_exceeded'` (artırmadan ÖNCE check).
2. `src/app/api/fason/info/[token]/route.ts` + `fason/update/route.ts`: bu reason'ı 403 handle et.

**Doğrulama:** 200 kullanım sonrası token 403 döner.

---

## GÖREV 5/10 — fn_auto_advance_to_proof_pending: search_path eksik [security, conf 0.93]

#### Yeni migration (CREATE OR REPLACE)

Mig 064:20-24 `security definer` ama `set search_path = public` YOK → search_path injection (sahte şema
`order_items`/`design_files`'ı değiştirebilir).

**Fix:** Fonksiyonu Mig 064'ten al, `CREATE OR REPLACE ... security definer set search_path = public as $$...` ile yeniden tanımla (gövde aynı).

**Doğrulama:** Fonksiyon `\df+` ile `search_path=public` gösterir; trigger normal çalışır.

---

## GÖREV 6/10 — pricing_config draft_config anon'a açık [security, conf 0.92]

#### Yeni migration

Mig 047:59-64 `using(true)` tüm sütunları açar — `draft_config` dahil. Anon `select draft_config` ile
planlanmamış fiyat/kampanyaları görebilir.

**Fix:** `v_pricing_live` view oluştur (`select scope, live_config from pricing_config`), RLS'yi view
mantığıyla kur; müşteri kodu (`pricing-config-client.ts` / fetch) bu view'i okusun. `pricing_config`
tablosuna anon direkt SELECT'i daralt (admin/service_role kalsın).

> ÖNCE doğrula: müşteri tarafı şu an `pricing_config`'i nasıl okuyor (`pricing-live-snapshot.ts`)? View'e geçiş o okuma yolunu kırmasın — kod tarafını da güncelle.

**Doğrulama:** Anon `select draft_config from pricing_config` → 0 satır/yetki yok; canlı fiyat okuma çalışır.

---

## GÖREV 7/10 — admin_role_permissions RLS [security] — ⚠️ ZATEN YAPILDI (Mig 128)

Bu bulgu P0 turunda Mig 128 ile kapatıldı (commit cf985a9). **Tekrar yapma** — sadece Mig 128'in Supabase'de apply edildiğini Sefa'dan teyit et.

---

## GÖREV 8/10 — types.ts ↔ DB drift [data, conf 0.95]

#### Dosya: `src/lib/supabase/types.ts`

types.ts "migrations 001-089" diyor (24 May). Eksik: `editor_cutline_drafts` (Mig 124),
`partner_capabilities.is_verified/verified_by` (Mig 096), yeni `order_status` enum değerleri.

**Fix:** TÜM migration'lar (128,129 + bu turun migration'ları) Supabase'de apply EDİLDİKTEN SONRA
`npm run supabase:types` çalıştır → types.ts yenilensin. Commit et.

> ⚠️ Bu görev EN SON yapılır (tüm migration apply sonrası). Sefa apply'ı tamamlayınca tetiklenir.

**Doğrulama:** `editor_cutline_drafts` types.ts'te görünür; `npx tsc` temiz.

---

## GÖREV 9/10 — design-previews DELETE path guard [security, conf 0.82] — 🔧 SADECE MANUEL (Sefa)

**KOD YOK.** Mig 085'teki `set role supabase_storage_admin` Dashboard'da 42501 ile sessizce başarısız
olmuş OLABİLİR → path guard'sız DELETE policy prod'da kalmış olabilir (kullanıcı X başkasının preview'unu siler).

**Sefa manuel:** Supabase Dashboard → Storage → Policies → `design-previews`:
- `design_previews_auth_delete` (bucket-only) HÂLÂ VAR MI? → varsa SİL.
- `design_previews_owner_delete_v2` `(storage.foldername(name))[1] = auth.uid()::text` koşuluyla VAR MI? → yoksa Storage UI'dan ekle (Mig 085 yorumundaki adımlar).

> Cursor: bu görevi koda dökme, sadece prompt sonundaki rapora "Sefa Storage UI'da kontrol etmeli" diye taşı.

---

## GÖREV 10/10 — .env.agent .gitignore'a açık ad + secret rotate [security, conf 0.99] — KISMEN MANUEL

#### Kod kısmı (Cursor):
`.gitignore`'da `.env*` glob zaten var (git'e sızmamış, doğrulandı). Ek güvenlik: `.gitignore`'a
açık satır ekle: `.env.agent` ve `.env.local` (glob'a güvenme, explicit ekle). `scripts/` altındaki
araçlar `.env.agent` okuyorsa yolu koru.

#### Manuel kısım (Sefa) — bu turda ŞART DEĞİL ama önerilir:
Secret'lar Vercel'de zaten var. Disk güvenliği için: bilgisayar paylaşımı/ekran kaydı riskine karşı
aktif key'leri (SERVICE_ROLE, OpenAI, Resend, R2, VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN) periyodik rotate.
**Acil değil** — git'e sızmadı, sadece lokal disk hijyeni.

**Doğrulama:** `git status` `.env*` göstermiyor; `.gitignore`'da explicit satırlar var.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `npx tsc --noEmit` TEMİZ (kırıksa push etme).
2. `git add -A`
3. `git commit -m "fix(guvenlik-p1): impersonate yetki+audit + staff guard + XFF rate-limit + fason token limit + search_path + pricing draft koruma + gitignore"`
4. `git push origin main` → Vercel deploy.
5. **Migration'lar (Görev 4,5,6):** push edildi, **apply Sefa manuel**. Görev 8 (types) tüm apply sonrası.
6. Deploy READY → commit hash + canlı URL + apply bekleyen migration + **Görev 9 (Storage UI manuel) + Görev 7 (Mig 128 teyit)** hatırlatması bildir.

> Git kökü `pim-etiket/core/`. Görev 9 tamamen Sefa'da (kod yok). Görev 8 en son (apply sonrası types regen).
