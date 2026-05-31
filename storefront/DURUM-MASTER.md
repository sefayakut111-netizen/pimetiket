# DURUM-MASTER — Pencereler Arası Tek Referans

> Son güncelleme: 2026-05-31 · Birden fazla Cursor/Claude penceresinde yürüyen işin tek konsolide görünümü.
> Git kökü: `pim-etiket/core` · App: `storefront` · Remote: `github.com/sefayakut111-netizen/pimetiket` (push → Vercel auto-deploy)

---

## Durum lejantı
✅ Bitti & canlıda · 🟡 Kodda bitti, deploy/push bekliyor · 🔵 Yerelde commit'siz · 👤 Sende (panel/env) · ⏭️ Bilerek sonraya

---

## 1) Kullanıcı tarafı bug paketi (Cursor, 2 tur — 11 + 9 madde) — 🔵 yerelde

**Tur 1 (P0–P2, 11 madde):**
- Ödeme/güvenlik: server-side kupon+tutar (`coupon-server.ts`, `payment/init`); PayTR callback RPC hatasında sessiz "OK" yok → 500 retry; checkout min/max + kargo eşiği + site ayarları sepet subtotal ile hizalı
- Auth: şifre sıfırlama PKCE (`exchangeCodeForSession`); open-redirect `sanitize-next-path`
- Sipariş/tasarım: `human_review_failed` yeniden yükleme; iade formunda gerçek e-posta; sepet merge anahtarı + `pim_cart_merge_dropped`
- Profil/hata: gerçek şifre değiştir + KVKK silme (`/api/me/kvkk-requests`); `mapApiError`; middleware `/tasarimlarim` `/ayarlar/*` korumalı, MFA fail-closed

**Tur 2 (9 madde):**
| # | Sorun | Düzeltme |
|---|---|---|
| A1 | Bildirim tercihi localStorage'da | `customer-notification-prefs.ts` → DB (`notification_prefs`), cihazlar arası |
| A2 | Abonelik iptali login tuzağı | `/cikis`'te giriş yap + destek ayrımı |
| A3 | Çift `payment/init` | Pending intent varsa mevcut PayTR URL + sessionStorage kilidi |
| A4 | Her hatada `/odeme-sonuc?fail` | Kupon/fiyat hatasında sayfada kal + toast |
| A5 | Merge tier bozulması → ödeme reddi | Eşleşen satır birleştirilmiyor, ayrı satır |
| A6 | Misafir tasarım sunucuya gitmiyor | Giriş yap banner (tam anon upload ⏭️) |
| B6 | Girişli sepet önce boş | Hydrate bitene kadar skeleton |
| A7 | İade duplicate yok | `POST /api/me/returns` ownership + 409; migration 125 |
| A8 | Onay 403 ham metin | `loadError` + `mapApiError` |
| B1–B4 | `/editor`, RSC prefetch, admin izin fail-open, `/demo` | middleware koruma + fail-closed + admin/staff |

---

## 2) Güvenlik checkout cila (review düzeltmeleri) — 🔵 yerelde
- MFA fail-closed döngüsü: `getAAL` throw → `/admin/profil` + `/2fa` erişilebilir, sole-admin kilitlenmez (`middleware.ts`)
- Ölü ikinci `shipping_mismatch` bloğu kaldırıldı (`payment/init`)
- Kupon audit: `couponDiscount` → `coupon_uses.discount_amount` (`payment/callback`)

---

## 3) Editör kenar-durum fix — ✅ canlıda (`0522c86`, push'lu)
- bg-remove sonrası mm korunuyor (`skipDimResetRef`); `pimUserMovedImage` + Sığdır butonu; `ensureDraftSaved()` tek-uçuş export.

---

## 4) SEO (3 paket)
- **Faz 1 kod paketi** — ✅ canlıda (`3dfc432`): robots AI politikası, llms.txt, 8 `/malzeme` landing, Product schema (shipping + iade 14g)
- **IndexNow + indeksleme otomasyonu** — ✅ canlıda (`522ac78`, `5c1a384`): GA4 `G-ZCN6RVXCEF`, PostHog, IndexNow cron (31 URL/202), SeoAuditor
- **Marka konumlandırma** — 🟡 `a6da8fc` commit'li, **push/deploy bekliyor**: root metadata "online etiket & sticker baskı", title kategori-net, Organization schema, llms.txt etiket-öncelikli

---

## 🚦 Production'a alınacaklar (sıra)
1. **Push** → `a6da8fc` (konumlandırma) + bug paketi + güvenlik cila → Vercel auto-deploy
2. **Migration 125** → uzak Supabase (`supabase db push` / SQL). Push edilmezse API yine 409 döner ama DB seviyesinde duplicate kilidi olmaz.

---

## 👤 Sende — tek seferlik (kod değil)
1. **GSC sitemap submit**: Search Console → Sitemaps → `pimetiket.com/sitemap.xml` (cron şu an `gsc.configured: false`)
2. **`/admin/trafik` GA4 Data API**: `GA4_PROPERTY_ID`, `GA4_SA_CLIENT_EMAIL`, `GA4_SA_PRIVATE_KEY` (Vercel)
3. **İletişim gerçek bilgi**: `iletisim/layout.tsx` placeholder (+90 XXX, adres, saat) → LocalBusiness
4. **Sosyal `sameAs`**: `NEXT_PUBLIC_SOCIAL_LINKS` (opsiyonel)
5. **OG görsel metni**: `opengraph-image.tsx` hâlâ eski "AI destekli dijital baskı"

---

## ⏭️ Bilerek sonraya
- Misafir tam anon temp upload (A6 tam çözüm)
- EN/hreflang (client i18n, `/en/*` yok)
- Bakım modu fail-open, OAuth sessiz redirect (ops iyileştirmesi)

---

## ✔️ Hızlı kontrol (deploy sonrası)
| Kontrol | Beklenen |
|---|---|
| `/robots.txt` | PerplexityBot Allow, GPTBot Disallow |
| `/llms.txt` | Etiket-öncelikli açılış |
| `/malzeme/kraft` | 200 + schema |
| `/api/health` | ga4: true, version güncel |
| Ana sayfa `<title>` | "Online Etiket & Sticker Baskı" |
