# Instagram Graph API — Kurulum

Anasayfa Instagram grid (`HomeInstagram`) ve günlük slot sync için Meta long-lived token gerekir.

## Ön koşullar

- Instagram **Business** veya **Creator** hesabı: `@pimetiket`
- Hesap bir **Facebook Sayfasına** bağlı
- Meta Developer uygulaması **Live** modda
- Storefront migration **179** (`integration_secrets` tablosu)

## 1. Meta Developer

1. [developers.facebook.com](https://developers.facebook.com) → **Create App** → **Business**
2. Ürün: **Instagram** (Graph API)
3. İzinler: `instagram_basic` / `instagram_business_basic` (medya okuma)
4. Uygulamayı **Live** yapın

## 2. Token üret

**Graph API Explorer** veya OAuth ile kısa ömürlü token alın.

Test:

```http
GET https://graph.instagram.com/v21.0/me/media?fields=id,permalink&access_token=TOKEN
```

Long-lived çevrim (≈60 gün):

```http
GET https://graph.instagram.com/access_token
  ?grant_type=ig_exchange_token
  &client_secret=APP_SECRET
  &access_token=SHORT_LIVED_TOKEN
```

## 3. Production’a kaydet

### Admin panel (önerilen)

1. `/admin/ayarlar` → **Instagram API**
2. Token yapıştır → **Long-lived’a çevir** işaretli
3. Vercel’de `INSTAGRAM_APP_SECRET` tanımlı olmalı
4. **Token kaydet** → **API test** → **Feed sync**

### Vercel env (alternatif)

```
INSTAGRAM_ACCESS_TOKEN=long_lived_token
INSTAGRAM_APP_SECRET=app_secret   # exchange için
```

DB token env’den önceliklidir; cron refresh DB’ye yazar.

### Supabase SQL (manuel)

```sql
insert into integration_secrets (key, value, expires_at, updated_at)
values (
  'instagram_access_token',
  'LONG_LIVED_TOKEN',
  now() + interval '60 days',
  now()
)
on conflict (key) do update
set value = excluded.value,
    expires_at = excluded.expires_at,
    updated_at = now();
```

## 4. Migration 179

Yerel / canlı:

```bash
cd pim-etiket/core/storefront
node scripts/apply-migrations-179.mjs
```

`.env.agent` içinde `SUPABASE_ACCESS_TOKEN` gerekir.

## 5. Cron

| Job | Schedule | Path |
|-----|----------|------|
| Feed sync | Günlük 07:00 UTC | `/api/cron/instagram-sync` |
| Token refresh | Pazar 08:30 UTC | `/api/cron/instagram-token-refresh` |

Manuel sync: Admin → Ayarlar → **Feed sync** veya:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://pimetiket.com/api/cron/instagram-sync
```

## 6. Doğrulama

- `https://pimetiket.com/api/public/instagram` → `source: "api"`, `posts` dolu
- Anasayfa alt bölümde gerçek gönderiler (placeholder yerine)

Yerel helper (unit only):

```bash
npm run verify:instagram-token
```

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Placeholder ikonlar | Token yok veya API hata |
| `integration_secrets` yok | Migration 179 |
| Exchange hatası | `INSTAGRAM_APP_SECRET` env |
| 403 OAuthException | App Live değil / izin eksik |
| Token &lt; 14 gün | Admin uyarısı; manuel refresh veya Pazar cron |
