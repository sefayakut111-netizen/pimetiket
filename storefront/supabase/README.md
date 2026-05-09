# Pim Etiket — Supabase setup

Faz 1 backend altyapısı: auth + DB + storage.

## Hızlı kurulum

### 1. Supabase projesi aç

1. https://supabase.com/dashboard → **New Project**
2. **Region**: Frankfurt (eu-central-1) — TR'ye en yakın
3. **Project Name**: `pimetiket-prod` (veya tercih ettiğin isim)
4. Proje oluşturulduktan sonra Project Settings → API:
   - **URL** → kopyala
   - **anon / public** key → kopyala

### 2. Migration'ı çalıştır

**Yöntem A: Supabase Dashboard SQL Editor**

1. Dashboard → SQL Editor → New query
2. `supabase/migrations/001_initial_schema.sql` içeriğini yapıştır
3. Run (Ctrl+Enter)
4. "Success. No rows returned" görünmeli

**Yöntem B: Supabase CLI**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Auth ayarları

Supabase Dashboard → **Authentication** → **URL Configuration**:

| Alan | Değer |
|---|---|
| Site URL | `http://localhost:3001` (dev) veya `https://pimetiket.com` (prod) |
| Redirect URLs | `http://localhost:3001/auth/callback` + `https://pimetiket.com/auth/callback` |

**Email Templates** (Auth → Email Templates → Magic Link):
- Subject: `Pim Etiket'e giriş bağlantın`
- Body: hazır şablon Türkçeleştirilebilir

### 4. (Opsiyonel) Google OAuth

1. https://console.cloud.google.com → Create OAuth Client (Web)
2. Authorized redirect URIs:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Client ID + Secret'ı al
4. Supabase Dashboard → Authentication → Providers → Google → Enable
5. Client ID/Secret yapıştır

### 5. .env.local güncelle

```bash
cp .env.example .env.local
```

Sonra `.env.local` aç ve doldur:
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### 6. Doğrula

```bash
npm run dev
```

- http://localhost:3001/auth → "E-posta yolla"
- E-posta gelir, link tıkla → /panelim'e döner
- Sağ üstte avatar + ad + dropdown menü görünür
- Çıkış yap → /'a redirect

## Schema

```
profiles          (auth.users 1:1, display_name, phone)
addresses         (kullanıcı adres defteri)
cart_items        (aktif sepet — auth varsa)
orders            (sipariş header, JSON snapshot)
order_items       (sipariş satırları)
wallet_transactions (cüzdan — Faz 2)
```

Tüm tablolar **RLS aktif** — kullanıcı sadece kendi satırlarına erişebilir
(`auth.uid() = user_id`). Order status update sadece service_role ile
yapılır (admin tarafı).

## Backup + restore

Supabase Pro plan → Daily backups otomatik. Manuel backup:
```bash
supabase db dump > backup.sql
```

## Sıradaki

Faz 1.2: customer-cart + customer-order Supabase swap (auth varsa
DB, yoksa localStorage hibrit).
