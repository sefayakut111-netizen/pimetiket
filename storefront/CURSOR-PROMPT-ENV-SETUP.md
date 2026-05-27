`.env.local` dosyasını aç ve eksik env var'ları ekle. Supabase Dashboard'dan key'leri al.

## ADIM 1 — Supabase Anon Key ekle
`.env.local`'a ekle (Supabase Dashboard → Project Settings → API → anon public key):
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Mevcut `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` zaten var — dokunma.

## ADIM 2 — Site URL ekle
```
NEXT_PUBLIC_SITE_URL=https://pimetiket.com
```

## ADIM 3 — OpenAI API Key ekle
```
OPENAI_API_KEY=
```
Kullanıcıdan key'i iste — sen üretemezsin.

## ADIM 4 — Resend API Key ekle
```
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
```
Kullanıcıdan key'i iste.

## ADIM 5 — Eski Medusa key'lerini sil
Şu satırları `.env.local`'dan SİL (artık kullanılmıyor):
```
NEXT_PUBLIC_MEDUSA_BACKEND_URL
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
NEXT_PUBLIC_DEFAULT_REGION
```

## ADIM 6 — Vercel'e de aynı env var'ları ekle
Vercel Dashboard → Project → Settings → Environment Variables → Production scope'a ekle:
- Tüm `NEXT_PUBLIC_*` var'ları
- Tüm server-side var'ları (SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, RESEND_API_KEY, CRON_SECRET, R2_* var'ları)

Kullanıcıya hangi key'lerin eksik olduğunu sor — sen üretemezsin, kullanıcı yapıştırmalı.
