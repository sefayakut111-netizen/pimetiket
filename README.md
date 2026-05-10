# Pim Etiket

Türkiye merkezli dijital baskı e-ticaret platformu.
Düşük MOQ + geniş malzeme yelpazesi + AI destekli akıllı süreç.
Üretim fason ortaklarda; biz vitrin + operasyon + müşteri yönetimi sunarız.

**Canlı:** [pimetiket.com](https://pimetiket.com)
**Sahibi:** Sefa Yakut Kırtasiye Baskı Ticaret Ltd. Şti.
**Vergi Dairesi / No:** Doğanbey / 7580607612
**Not:** Şirket ünvanı resmî değişiklik sürecindedir.

---

## Hedef kitle

- Küçük marka sahipleri (kozmetik, gıda, butik üreticiler)
- Bireysel / yaratıcı satıcılar (Etsy tarzı)
- Etkinlik organizatörleri (sticker tarafı)
- KOBİ'ler (kurumsal etiket ihtiyacı)

## Stack (canlı)

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind 4 + React 19
- **Backend (BaaS):** Supabase (PostgreSQL + Auth + Storage + Realtime, AWS Frankfurt eu-central-1)
- **AI:** OpenAI GPT-4o (designer agent, tool calling) + GPT-4o-mini (welcome/shipper persona, cost tier)
- **Hosting:** Vercel (otomatik git push deploy)
- **DNS:** GoDaddy A + CNAME → Vercel
- **Mail (transactional):** Resend (kuruluyor)
- **Mail (gelen kutusu):** Google Workspace — info@pimetiket.com
- **Ödeme:** PayTR iFrame API (3D Secure) — onay sürecinde
- **Analytics:** GA4 + PostHog (KVKK çerez izni gated)
- **Hata takibi:** Sentry (kuruluyor)

## Klasör yapısı

```
pimetiket/
├── storefront/             # Next.js 16 production app (canlı)
│   ├── src/
│   │   ├── app/            # 50+ sayfa (App Router)
│   │   │   ├── api/        # 9 API route (PayTR, Pim chat, design upload)
│   │   │   └── admin/      # 15 admin sayfası
│   │   ├── components/     # UI kütüphanesi
│   │   ├── lib/            # Pim personas, pricing engine, Supabase client
│   │   └── middleware.ts   # Auth gate
│   ├── supabase/
│   │   ├── migrations/     # 9 SQL migration (16 tablo + RLS)
│   │   └── bundled-schema.sql
│   ├── public/             # Static assets
│   ├── GO-LIVE.md          # Production launch checklist
│   ├── DEPLOY.md           # Deploy rehberi
│   ├── SETUP.md            # Local dev setup
│   ├── TODO-SEFA.md        # Sefa'nın bekleyen işleri
│   └── package.json
├── docs/                   # Internal planlama dokümantasyonu
└── README.md
```

## Sayfalar (canlı)

50+ sayfa, 4 ana grup:

- **Public**: `/`, `/etiket`, `/sticker`, `/galeri`, `/blog`, `/sss`, `/hakkimizda`, `/iletisim`, `/demo`
- **Hesap (auth)**: `/panelim`, `/profil`, `/siparislerim`, `/adreslerim`, `/cuzdan`, `/iadelerim`, `/tasarimlarim`, `/fatura-bilgileri`, `/bildirim-tercihleri`
- **Yasal**: `/kvkk`, `/gizlilik`, `/cerez`, `/sartlar`, `/mesafeli-satis`, `/cayma-hakki`, `/iade-degisim-politikasi`, `/on-bilgilendirme`
- **Admin**: `/admin/*` (15 sayfa — sipariş, müşteri, fason, kupon, raporlar, AI QC, audit log, vs.)

Detay: [Site haritası](#) (sohbet kayıtlarında mevcut)

## Maskot — Pim

"Etiket Baykuşu" karakter — wireframe SVG, 9 ifade pozu (wave, think, inspect, happy, sad, excited, box, chat, wait).
3 persona ile AI sohbet: **Welcome Pim** (karşılama), **Tasarımcı Pim** (fiyat tool calling), **Kargocu Pim** (sipariş takibi).

## Local development

```bash
cd storefront
npm install
cp .env.example .env.local   # values doldur
npm run dev                  # http://localhost:3000
```

Detaylı setup: [storefront/SETUP.md](storefront/SETUP.md)

## Deploy

```bash
git push origin main         # → Vercel auto-deploy ~40 sn
```

Deploy adımları + DNS rehberi: [storefront/DEPLOY.md](storefront/DEPLOY.md)

## Yol haritası — bekleyen işler

[storefront/TODO-SEFA.md](storefront/TODO-SEFA.md) içinde kronolojik liste.

## Lisans

Proprietary — tüm hakları saklıdır.
