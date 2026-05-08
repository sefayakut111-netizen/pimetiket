# Pim Etiket — Tasarım Taslakları

Bu klasör **tasarım iterasyonlarının arşividir**. Production kodu DEĞİLDİR.
Production kodu Next.js 14 + TypeScript + Tailwind ile `storefront/` altında
yazılacak (D adımı sonrası).

---

## v1-jsx — React + Babel-standalone (ilk iterasyon)

**Format:** 9 JSX dosyası + 1 CSS, tek HTML kabuk.
React 18 CDN + Babel browser-side transform.

**Sayfa sayısı:** 4 ana (Home, Etiket, Sticker, Dashboard) + global Chat widget.
**Routing:** Hash router (`#etiket`, `#sticker`, `#dashboard`).

**Açmak için:**
```
v1-jsx/Pim Etiket.html  →  tarayıcıda aç
```

**Dosyalar:**
- `Pim Etiket.html` — kabuk; 8 JSX + 1 CSS yükler
- `design.css` — design tokens (`:root` CSS vars), button, card, pill, input
- `pim.jsx` — Pim mascot SVG component (9 pose, animasyonlu)
- `icons.jsx` — Lucide-tarzı outline ikon set
- `app.jsx` — App shell + topbar + footer + hash router
- `home.jsx` — Anasayfa (hero + 3 pillar + product cards + how-it-works + testimonials + FAQ + CTA)
- `etiket.jsx` — Rulo etiket konfigürasyon (5 step + 3D-ish preview + canlı fiyat)
- `sticker.jsx` — Sticker konfigürasyon (4 step + tier kartlar + Apple-tarzı upsell)
- `dashboard.jsx` — Kullanıcı paneli (hero + stats + quick actions + sipariş timeline + cüzdan + tasarım kütüphanesi)
- `chat.jsx` — Pim chat widget (sağ alt FAB + 540px panel)

**Güçlü yönler:** Pim mascot tam entegre. Design tokens tek kaynak.
**Sınırlar:** Babel browser-side compile yavaş; SEO için SSR yok; tip güvenliği yok.

---

## v2-html — Vanilla HTML multi-page (ikinci iterasyon)

**Format:** 9 ayrı HTML sayfası + tek `styles.css` + tek `app.js`.
Babel veya React YOK — saf HTML/CSS/JS.

**Sayfa sayısı:** 9 (index, etiket, sticker, dashboard, auth, cuzdan, hakkimizda, sepet, siparis).

**Açmak için:**
```
v2-html/index.html  →  tarayıcıda aç
```

**Dosyalar:**
- `index.html` — Anasayfa
- `etiket.html` — Etiket konfigürasyon
- `sticker.html` — Sticker konfigürasyon
- `dashboard.html` — Kullanıcı paneli
- `auth.html` — Giriş / kayıt
- `cuzdan.html` — Cüzdan ve işlemler
- `hakkimizda.html` — Hakkımızda
- `sepet.html` — Alışveriş sepeti
- `siparis.html` — Sipariş detay / takip
- `styles.css` — Tüm stiller (design tokens dahil)
- `app.js` — Paylaşılan JS (nav, modal, vs.)

**Güçlü yönler:** Daha geniş sayfa kapsamı (auth/sepet/cüzdan/hakkimizda/sipariş).
**Sınırlar:** Component reuse yok; her sayfa bağımsız HTML.

---

## v1 ve v2 ilişkisi

**Aynı tasarım dilini paylaşıyorlar:**
- Aynı `--pim-mercan: #FF6B5B`
- Aynı `--krem: #F5EBD9`, `--lacivert: #1F2937`
- Aynı Nunito font
- Aynı border radius, shadow paterni
- Aynı Pim mascot

**Farklı oldukları yerler:**
- v1: 4 sayfa, React component'ler, hash router
- v2: 9 sayfa, vanilla HTML, link-based navigation

Production'da **v1'in component yapısı** + **v2'nin sayfa kapsamı** birleştirilecek (Next.js file-based router + TS components).

---

## Production'a taşıma — D adımında

Bu taslakların kodu **doğrudan kopyalanmaz**. Şu dönüşümlerden geçer:

| Şu an | Production hedef |
|---|---|
| Babel-standalone CDN | Next.js 14 + SWC build |
| `:root` CSS vars | Tailwind v3 config + CSS vars (korunur) |
| Vanilla CSS classes (.btn, .card, .pill) | Tailwind utility-first + 1-2 component class |
| `window.Pim`, `window.Icon` | ESM imports + TypeScript |
| Hash router | Next.js file-based router |
| Inline styles | Tailwind utility classes |
| Hardcoded TR strings | i18n (tr.json) |

**Korunacaklar:**
- Tüm renkler, font, radius, shadow tokenları
- Pim mascot SVG (TS'e dönüştürülecek)
- Voice/tone (Türkçe samimi anlatıcı dil)
- Animasyonlar (`pim-bob`, `pim-wave-hand`, `count-pulse`, `fade-up`)
