# Pim Etiket

Türkiye merkezli dijital baskı e-ticaret platformu.
Düşük MOQ + geniş malzeme yelpazesi + AI destekli akıllı süreç.
Üretim fason ortaklarda; biz vitrin + operasyon + müşteri yönetimi sunarız.

**Başlangıç tarihi:** 2026-05-08
**Sahibi:** Sefa Yakut

> ⚠️ Bu **Packanalyz'den tamamen ayrı** bir projedir. Kod, müşteri tabanı, veritabanı paylaşılmaz.

---

## Hedef kitle

- Küçük marka sahipleri (kozmetik, gıda, butik üreticiler)
- Bireysel/yaratıcı satıcılar (Etsy tarzı)
- Etkinlik organizatörleri (sticker tarafı)
- KOBİ'ler (kurumsal etiket ihtiyacı)

## Stack (planlanmış)

- **Backend:** Medusa.js v2 (TypeScript, headless commerce)
- **Storefront:** Next.js 14 + TypeScript + Tailwind + Framer Motion
- **Database:** PostgreSQL 14+ (Supabase managed, **ayrı org**)
- **Cache:** Redis
- **Storage:** S3-uyumlu (Cloudflare R2 veya MinIO)
- **AI:** Anthropic Claude API (chatbot + dosya QC + IP tarama) + vision
- **Mobile:** 1. faz PWA, 2. faz React Native (Expo)
- **Deploy:** Backend → Railway/Hetzner, Storefront → Vercel/Cloudflare Pages, CDN → Cloudflare
- **CI/CD:** GitHub Actions

## Maskot — Pim

"Etiket Profesörü" karakter — gözlüklü, krem önlüklü. 9 ifade pozu (wave, think,
inspect, happy, sad, excited, box, chat, wait). Markanın kalbi; her sayfada en
az bir yerde yer alır.

## Klasör yapısı

```
pimetiket/
├── design-prototype/    # Tasarım taslakları (production kodu DEĞİL)
│   ├── v1-jsx/          # React + Babel-standalone, 4 sayfa hash router
│   └── v2-html/         # Vanilla HTML/JS multi-page, 9 sayfa
├── docs/                # Mimari, state machine, modül planı (B adımı)
├── reference/           # Medusa develop branch zip (kaynak okuma)
└── (sonra) backend/     # Medusa v2 backend (D adımında scaffold)
└── (sonra) storefront/  # Next.js 14 storefront (D adımında scaffold)
```

## Yol haritası

| # | Adım | Durum |
|---|---|---|
| **A** | Workspace ve klasör kurulum, git init | ✅ Bu commit |
| **B** | Tasarım sistemi dokümantasyonu (`docs/DESIGN_SYSTEM.md`) | ⏳ |
| **C** | 7 mikro tutarsızlığı taslakta düzelt | ⏳ |
| **D** | Next.js 14 + Tailwind storefront scaffold (Pim tokens) | ⏳ |
| **E** | Sayfa sayfa migration (Home → Sticker → Etiket → Dashboard) | ⏳ |
| **F** | Medusa v2 backend scaffold + Supabase bağlantısı | ⏳ |
| **G** | Custom modules: label-config, pricing-engine, qc-pipeline, fason-routing | ⏳ |
| **H** | iyzico/ParamPOS payment provider | ⏳ |
| **I** | Sipariş state machine + dosya QC akışı | ⏳ |
| **J** | Operatör paneli (Medusa admin extension) | ⏳ |
| **K** | E-fatura + kargo (Yurtiçi/Aras/Sürat) entegrasyonları | ⏳ |
| **L** | Production deploy + monitoring | ⏳ |

## Tasarım taslağını çalıştırmak

```bash
# v1 (React+JSX taslak)
cd design-prototype/v1-jsx
# tarayıcıda "Pim Etiket.html" aç (Babel-standalone in-browser compile eder)

# v2 (HTML multi-page taslak)
cd design-prototype/v2-html
# tarayıcıda index.html aç
```

Her iki taslak da statik dosyalardır — backend yok.

## Lisans

Proprietary — tüm hakları saklıdır.
