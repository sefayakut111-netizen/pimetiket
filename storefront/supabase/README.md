# Pim Etiket — Supabase Setup

Faz 1 backend altyapısı: **Auth + DB + Storage**.

Bu klasör 6 migration içerir; toplam **15 tablo + 2 view + 4 stored function**.

---

## 🚀 Hızlı kurulum

### 1. Supabase projesi aç

1. https://supabase.com/dashboard → **New Project**
2. **Region**: Frankfurt (eu-central-1) — TR'ye en yakın, KVKK uyumlu
3. **Project Name**: `pimetiket-prod` (veya istediğin)
4. **Database Password** — güçlü bir şifre seç, password manager'a kaydet
5. Proje oluştuktan sonra Project Settings → API:
   - **URL** → kopyala
   - **anon / public** key → kopyala
   - **service_role** key → kopyala (BU SERVER-SIDE, asla client'a koyma)

### 2. Migration'ları sırayla çalıştır

**Yöntem A: Supabase Dashboard SQL Editor (en hızlı)**

Dashboard → SQL Editor → New query. Sırayla yapıştır + Run (Ctrl+Enter):

| Sıra | Dosya | Ne yapar |
|------|-------|----------|
| 1 | `001_initial_schema.sql` | profiles + addresses + cart_items + orders + order_items + wallet + RLS |
| 2 | `002_invoice_events_payments.sql` | profiles fatura alanları + order_events + payments + `fn_create_order` |
| 3 | `003_returns_design_files.sql` | returns + design_files (versioning'li) |
| 4 | `004_notifications_audit.sql` | notification_prefs + audit_log (immutable) + `fn_log_audit` |
| 5 | `005_coupons_reviews.sql` | coupons + coupon_uses + reviews + `fn_apply_coupon` + `fn_validate_coupon` |
| 6 | `006_storage_buckets.sql` | Storage RLS policy'leri (bucket'lar manuel açılmalı, bkz §3) |

**Yöntem B: Supabase CLI** (otomatik diff push)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Storage bucket'larını oluştur

Migration 006 sadece RLS policy'leri yazar. Bucket'ları **manuel** aç:

Dashboard → Storage → **New bucket**:

| Bucket | Public | File size limit | Allowed MIME |
|--------|--------|----------------|--------------|
| `designs` | OFF | 30 MB | `application/pdf, image/png, image/jpeg, image/svg+xml, application/postscript, application/illustrator, image/vnd.adobe.photoshop` |
| `return-photos` | OFF | 10 MB | `image/png, image/jpeg, image/webp` |
| `public-assets` | ON | 5 MB | `image/png, image/jpeg, image/webp, image/svg+xml` |

### 4. Auth ayarları

Dashboard → **Authentication** → **URL Configuration**:

| Alan | Değer |
|------|-------|
| Site URL | `http://localhost:3000` (dev) veya `https://pimetiket.com` (prod) |
| Redirect URLs | `http://localhost:3000/auth/callback`, `https://pimetiket.com/auth/callback` |

**Email Templates** (Auth → Email Templates):

- **Magic Link** → Subject: `Pim Etiket'e giriş bağlantın`
- **Confirm signup** → Subject: `E-posta adresini doğrula`
- **Reset Password** → Subject: `Şifre sıfırlama`

(Mailler Türkçeleştirilebilir, body'de `{{ .ConfirmationURL }}` placeholder kullan.)

### 5. (Opsiyonel) Google OAuth

1. https://console.cloud.google.com → APIs & Services → Credentials → **Create OAuth client (Web)**
2. **Authorized JavaScript origins**: `https://<your-project-ref>.supabase.co`
3. **Authorized redirect URIs**:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Client ID + Secret kopyala
5. Supabase Dashboard → Authentication → Providers → **Google** → Enable + paste

### 6. .env.local güncelle

```bash
cp .env.example .env.local
```

Sonra `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Sadece server-side (route handler / Server Action / Edge function)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

⚠️ `SUPABASE_SERVICE_ROLE_KEY` ASLA `NEXT_PUBLIC_*` prefix'i ile başlamasın
(client'a sızar). Server-only kullan.

### 7. Doğrula

```bash
npm run dev
```

Test akışı:
- http://localhost:3000/auth → "E-posta yolla"
- E-posta gelir → link tıkla → `/panelim`'e döner
- TopBar'da kullanıcı menüsü görünür
- `/sepet`'e bir ürün ekle → DB'de `cart_items` satırı oluşur
- Çıkış yap → `/`'a redirect, cart_items satırı kalır (yeniden giriş yapınca tekrar görünür)

---

## 📊 Schema özeti

```
auth.users                    (Supabase managed)
  │
  ├── public.profiles           (1:1, fatura alanları + locale)
  ├── public.addresses          (1:N adres defteri)
  ├── public.cart_items         (1:N aktif sepet)
  ├── public.orders             (1:N sipariş)
  │     ├── order_items         (sipariş satırları)
  │     ├── order_events        (timeline, append-only)
  │     ├── payments            (PSP transaction)
  │     ├── design_files        (yüklenen tasarımlar, versioning)
  │     └── returns             (iade talepleri)
  ├── public.notification_prefs (1:1 email/SMS opt-in)
  ├── public.wallet_transactions (cüzdan)
  ├── public.coupon_uses        (kupon kullanımı)
  └── public.reviews            (yorumlar)

public.coupons                  (admin yönetir)
public.audit_log                (append-only, immutable)
```

**RLS aktif tüm tablolarda.** Kullanıcı sadece `auth.uid() = user_id` koşulunu
sağlayan satırlara erişebilir. Status değişimi / refund / moderation gibi
admin işlemleri sadece `service_role` key ile yapılır.

**Append-only tablolar** (UPDATE/DELETE = exception):
- `order_events` (event-sourced timeline)
- `audit_log` (KVKK + VUK gereği immutable)

---

## 🔧 Stored functions

| Fonksiyon | Kim çağırır | Görev |
|-----------|-------------|-------|
| `fn_create_order(...)` | authenticated | Atomik sipariş oluşturma (orders + order_items + ilk event tek tx) |
| `fn_apply_coupon(code, subtotal, user_id, order_id)` | authenticated | Kuponu validate et + insert (atomik race condition-safe) |
| `fn_validate_coupon(code, subtotal)` | anon + authenticated | Kontrol et (UI preview için, insert yapmaz) |
| `fn_log_audit(action, target, summary, detail)` | authenticated | Müşteri kendi auth.* eylemlerini logla |
| `fn_supersede_old_versions()` | trigger | Yeni design_file yüklendiğinde eskileri 'superseded' yap |
| `handle_new_user()` | trigger (auth.users INSERT) | Yeni user → profiles satırı |
| `handle_new_user_prefs()` | trigger (auth.users INSERT) | Yeni user → notification_prefs satırı |

---

## 🔐 Backup + restore

**Supabase Pro plan ($25/ay)** → Günlük otomatik backup, 7 gün retention.

**Manuel backup:**
```bash
supabase db dump > backup-$(date +%Y%m%d).sql
```

**Restore:**
```bash
psql "<connection-string>" < backup-20260509.sql
```

Connection string için: Dashboard → Project Settings → Database → Connection string → URI.

---

## 📦 Type generation

Migration'ları push ettikten sonra TypeScript tiplerini regenerate edebilirsin:

```bash
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Şu an `types.ts` el yazımı (migration SQL ile uyumlu); CLI ile regenerate etmek
optional ama auto-update sağlar.

---

## 🐛 Sık karşılaşılan hatalar

**"permission denied for relation cart_items"**
→ RLS policy yok ya da auth.uid() null. Kullanıcı login mi?

**"violates foreign key constraint orders_user_id_fkey"**
→ profiles satırı yok (handle_new_user trigger'ı çalışmadı). Auth → User'ları kontrol et.

**"duplicate key value violates unique constraint payments_psp_txn_unique"**
→ Webhook duplicate. Idempotency key doğru ayarlanmamış. PSP webhook handler'ı kontrol et.

**"audit_log is append-only"**
→ Birinin audit_log'a UPDATE/DELETE atması engellendi (intended). Kod hatası, düzelt.

---

## 📈 Sıradaki adımlar (P0)

- [x] **1.1** Schema design (DDL) — bu klasör
- [ ] **1.9** `customer-cart.ts` → Supabase wire (hibrit fallback)
- [ ] **1.10** `customer-order.ts` → Supabase wire (`fn_create_order` RPC)
- [ ] **1.11** `customer-return.ts` → Supabase wire
- [ ] **1.12** Profil + adres + fatura → Supabase wire
- [ ] **1.13** Cüzdan → Supabase wire
- [ ] **1.14** `audit-log.ts` → Supabase wire (`fn_log_audit` RPC)
- [ ] **2.1-2.5** Auth tam akış (signup + login + callback + logout + middleware)
- [ ] **3.1-3.7** PSP entegrasyonu (iyzico veya Stripe)
- [ ] **4.1-4.6** Resend mail template altyapısı
- [ ] **5.1-5.5** Storage upload akışı + AI ön-kontrol
