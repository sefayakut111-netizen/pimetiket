# 📋 Pim Etiket — Production'a Uygulanan Migration'lar

> Bu liste, `supabase/migrations/` klasöründeki SQL dosyalarının
> production DB'sine **gerçekten uygulanıp uygulanmadığını** takip eder.
>
> Supabase Management API + Dashboard SQL Editor + Storage UI manuel
> apply'ları burada belgelenir. CLI tracking (`supabase_migrations.schema_migrations`)
> kullanılmıyor (her migration manuel apply edildi).

**Son güncelleme:** 21 Mayıs 2026

---

## ✅ Apply edilenler (kronolojik)

| # | Migration | Apply tarihi | Yöntem | Notlar |
|---|---|---|---|---|
| 075 | `075_product_cards_encoding_fix.sql` | 21 May 2026 | Management API | 22 UPDATE, replacement char temizliği |
| 076 | `076_mail_suppressions_and_observability.sql` | 21 May 2026 | Management API | Mail observability + suppressions + idempotency |
| 072 | `072_cart_design_preview.sql` | 21 May 2026 | Management API (geriden) | Bucket + path-strict RLS policies |
| 077 | `077_design_previews_rls_relax.sql` | ❌ **UYGULANMADI** | — | Server proxy ile gereksiz oldu |

---

## 📊 Migration 075 — product_cards encoding fix

**Apply yöntemi:** PowerShell + curl + Supabase Management API
**Verify:**
```sql
SELECT key, title_tr FROM product_cards
WHERE title_tr LIKE '%' || chr(65533) || '%';
-- Beklenen: 0 satır (replacement char temizlendi)
```

**Etki:**
- 22 UPDATE statement, idempotent
- `Özel`, `Şeffaf`, `Yuvarlak`, `Dikdörtgen`, `Yumuşatılmış` düzgün UTF-8 byte sequence
- `/sticker` + `/etiket` + `/admin/urunler` sayfalarında bozuk karakter kalmadı
- Byte-level kanıt: rulo-clear `bytes=19, chars=18` (Ş 2-byte)

---

## 📊 Migration 076 — Resend mail observability

**Apply yöntemi:** PowerShell + curl + Supabase Management API

**Yeni objeler:**
- `public.mail_suppressions` tablosu (RLS aktif)
- 4 yeni index
- `fason_mail_outbox` → 8 yeni kolon (`idempotency_key`, `delivered_at`,
  `bounced_at`, `complaint_at`, `opened_at`, `clicked_at`, `last_event`,
  `last_event_at`)
- 3 yeni/güncellenmiş RPC: `fn_is_suppressed`, `fn_record_suppression`,
  `fn_enqueue_mail` (**8-param** signature)

**Verify:**
```sql
SELECT proname, pronargs FROM pg_proc
WHERE proname = 'fn_enqueue_mail';
-- pronargs = 8 ✅
```

**Etki:**
- `/admin/mail-health` dashboard çalışır
- Hard bounce + complaint → otomatik suppression
- Idempotency: aynı tetik 2× → 1 mail

---

## 📊 Migration 072 — cart design preview

**Apply yöntemi:** Management API (geriden apply — daha önce kısmen uygulanmış)

**Yeni objeler:**
- `cart_items` → 3 yeni kolon (`design_preview_url`, `design_file_name`,
  `design_mime_type`)
- `design-previews` storage bucket (public, 5MB, image/png)
- 3 RLS policy: `design_previews_owner_insert/update/delete`
  (path-strict: `(storage.foldername(name))[1] = auth.uid()::text`)

**Bug bulundu:** Path-strict RLS, browser supabase client'ın
Authorization header'ı geçirmemesi nedeniyle `auth.uid() NULL`
durumunda fail oluyordu. Çözüm Migration 077 değil, **server proxy**
(commit `5c9f05c`).

---

## ❌ Migration 077 — UYGULANMADI (server proxy ile gereksiz)

**Hedef:** `design-previews` RLS policy'sini path-strict'ten
auth-only'ye gevşetmek.

**Apply denemeleri:**
1. **Management API** — `42501: must be owner of relation objects`
2. **Dashboard SQL (`set role`)** — `42501: permission denied to set
   role "supabase_storage_admin"`
3. **Dashboard Storage > Policies UI** — Sefa elle yapacaktı, asistan
   sandbox güvenlik kuralı gereği tıklama yapmadı

**Alternative çözüm — Server-side proxy endpoint** (uygulandı):
- `POST /api/cart/upload-preview` — service_role storage upload
- Client `lib/design-preview/index.ts` artık bu endpoint'e POST eder
- RLS bypass edilir, eski path-strict policy bile arkada koruyucu kalır
- Migration 077 SQL'i repo'da **tarihsel kayıt** olarak duruyor —
  ileride farklı bir Supabase'e migrate edilirse (CLI ile, postgres
  superuser) çalışacak

---

## 🔧 Apply yöntemleri açıklaması

### Yöntem 1: Supabase Management API (otomatik, en hızlı)

```powershell
$headers = @{ "Authorization" = "Bearer $env:SUPABASE_PAT"; "Content-Type" = "application/json" }
python -c "import json; print(json.dumps({'query': open('migration.sql', encoding='utf-8').read()}))" `
  | Out-File "$env:TEMP\mig.json" -Encoding utf8 -NoNewline
curl.exe -X POST "https://api.supabase.com/v1/projects/$env:PROJECT_REF/database/query" `
  -H "Authorization: Bearer $env:SUPABASE_PAT" `
  -H "Content-Type: application/json" `
  --data "@$env:TEMP\mig.json"
```

**Avantaj:** Sıfır manuel adım, idempotent, log alınabilir.
**Kısıt:** `storage.objects` tablosu için yetersiz role (owner check).

### Yöntem 2: Dashboard SQL Editor (postgres role)

1. Supabase Dashboard → SQL Editor → + New query
2. Migration dosyasını yapıştır
3. Run

**Avantaj:** Postgres role ile DDL yetkisi.
**Kısıt:** Storage tabloları için yetersiz (managed env).

### Yöntem 3: Storage > Policies UI

Storage RLS policy'leri için tek çalışan yöntem.
Sefa kendisi tıklayarak yapacak (asistan güvenlik kısıtı).

### Yöntem 4: Supabase CLI (`supabase db push`)

CLI service_role kullanır. **Database password gerekli.**
İleride kullanılacak (şu an Sefa'nın CLI'sı + db password setup yok).

---

## 📌 Bekleyen migration'lar

(Yok — tüm pending migrations apply edildi veya alternative çözüm ile değiştirildi.)

---

## 🔐 Güvenlik notu

`SUPABASE_PAT` ve `SUPABASE_SERVICE_ROLE_KEY` **hiçbir zaman** repo'ya
yazılmaz. Apply komutları çalıştırılırken environment variable veya
explicit one-time injection ile geçirilir.

`docs/HESAP-KAYITLARI.md` sadece email/login URL içerir — secret yok.
