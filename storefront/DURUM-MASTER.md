# DURUM-MASTER — Pencereler Arası Tek Referans

> Son güncelleme: 2026-05-31 · Birden fazla Cursor/Claude penceresinde yürüyen işin tek konsolide görünümü.
> Git kökü: `pim-etiket/core` · App: `storefront` · Remote: `github.com/sefayakut111-netizen/pimetiket` (push → Vercel auto-deploy)

---

## Durum lejantı
✅ Bitti & canlıda · 🟡 Kodda bitti, deploy/push bekliyor · 🔵 Yerelde commit'siz · 👤 Sende (panel/env) · ⏭️ Bilerek sonraya

---

## 1) Kullanıcı tarafı bug paketi (Cursor, 2 tur — 11 + 9 madde) — ✅ canlıda (`0d6109e`)

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

## 2) Güvenlik checkout cila (review düzeltmeleri) — ✅ canlıda (`0d6109e`)
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

## 5) Admin negatif analiz (31 May) — ✅ kod canlıda
Rapor: `docs/ADMIN-NEGATIF-ANALIZ.md` · Araç: `scripts/admin-negative-audit.mjs` · E2E: `admin-journey.spec.ts` (45 rota). Bulgu: 1 P0 · 12 P1 · 11 P2 · 6 P3.
- **P1 sessiz fetch + RBAC** (`19a9a3d`): `AdminFetchErrorBanner` + fason/kvkk/denetçiler/finans/ai-qc hata banner'ı; `ADMIN_PATH_MODULES` → sistem=staff, kuyruk=orders, trafik=dashboard. ✅ canlıda.
- **P0 grant-credit + P1 siparisler** (`<bu commit>`): Raporun "zaten remote'da var" dediği bu iki fix aslında origin'de **yoktu** (deploy ayrı klona gitmiş). `core`'da commit'siz duruyordu → senkron + commit edildi: grant-credit `assertAdmin` guard, siparisler/[id] `loadError` + 404 ayrımı. ✅
- **Pencere senkronu:** `core` (gerçek repo, `pim-etiket/core/.git`) origin'e hizalandı; gereksiz `_deploy-pimetiket` klonu silinebilir. Pre-sync yedeği: `git stash` (`core-pre-sync-backup-31may`).

**Migration doğrulandı (31 May, read-only prod sorgu):** Mig **110** ✅ uygulanmış (`orders.paid_at`, `design_files.created_at`, `fn_process_proof_pending_sla` mevcut) · Mig **075** ✅ uygulanmış (product_cards 22 satır, U+FFFD = 0). "Belirsiz" değil — ikisi de canlıda.
**Hâlâ manuel (prod/env):** müşteriler RLS diagnostic, E2E runtime (Supabase env gerekli — `bot:admin`).

---

## 6) Ürün/yapılandırıcı negatif analiz + fix (31 May) — ✅ kod canlıda (`76b7f82`)
Rapor: `docs/URUN-NEGATIF-ANALIZ.md` · Araç: `product-configurator-audit.mjs` (`npm run verify:product-audit`) · E2E: `customer-product-matrix.spec.ts` + `customer-sarim-step-order.spec.ts` (`npm run bot:product` 26/26). Bulgu: **0 P0 · 2 P1 · 5 P2 · 3 P3**. 22/22 yapılandırıcı OK.
- **P1 #1 bumper duplicate `#step-3`** → ✅ fix: i18n `context.tsx` `hydrated` flag (locale oturana kadar skeleton, hydration mismatch önlenir) + `use-sanitize-empty-query-param.ts` (`?form=` boş param temizlenir). Origin'de doğrulandı (hydrated ×7, dosya var).
- **P1 #2 yuvarlak rulo malzeme adı drift** → ✅ fix: müşteri tarafında adlar her zaman `MATERIALS` const'tan; **Migration 126** admin `pricing_config` etiket_rulo adlarını normalize etti.
- **P2 #3 sticker sheet başlık** → ✅ fix: **Migration 082** prod'a uygulandı, "Tabaka Sticker" → "Sticker Sayfası".
- **P2 #4 kiss-cut fiyat şeffaflığı** → ✅ fix: PriceCard üstüne not — *"Fiyat özel kesim tarifesinden hesaplanır; yarı kesim üretim aşamasında uygulanır."* (origin'de doğrulandı).
- **Senkron:** Cursor yine ayrı yerden commit'lemiş; `core` working tree'deki redundant edit'ler origin'le (76b7f82) eşleşti, stash→ff ile hizalandı. Divergence yok.
- **✅ Prod doğrulandı (read-only, Cursor):** Mig 082 → `product_cards.sheet.title_tr` = "Sticker Sayfası" ✓ · Mig 126 → etiket_rulo adları (Kraft/Kuşe/Opak PP/Ultra Clear/Metalize), "Beyaz semi-glos" drifti yok ✓. Script çalıştırılmadı, prod zaten hedef durumdaydı.
- **🔎 Küçük açık soru (Cursor'a):** Prod etiket_rulo'da "seffaf" malzeme id'si yok; ama ürün matrisinde **E2 Şeffaf Rulo** (`shape=clear`) var → muhtemelen "ultra/Ultra Clear" malzemesine map oluyor. Şeffaf Rulo'nun fiyatı doğru malzemeden mi geliyor, bir teyit edilsin (kritik değil).

---

## 🚦 Production durumu (31 May — tamam)
1. ✅ **Push edildi** → `0d6109e` (bug+güvenlik) + `a6da8fc` (konumlandırma) + `19a9a3d` (admin P1) `origin/main`'de → Vercel auto-deploy
2. ✅ **Migration 125 uygulandı** → uzak Supabase'de `returns_one_pending_per_order_idx` doğrulandı (`apply-migrations-125.mjs`)
3. ✅ **Admin P0/P1 tamamlandı** → grant-credit guard + siparisler hata gösterimi (`core` senkron sonrası commit)

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
