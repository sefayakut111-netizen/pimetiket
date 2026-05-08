# 🟢 Quality Audit — A11y + SEO + Performance

**Tarih**: 2026-05-09
**Kapsam**: `storefront/` (29 sayfa, MVP — F-K backend henüz yok)
**Mod**: R1 audit-only (widget rapor → lokal Claude uygula)
**Plan adımı**: E (sayfa migration) tamamlandı, F-I backend öncesi polish
**Commits**: `123d150` (SEO), `934b3be` (A11y), bu commit (Perf + doc)

---

## TL;DR

29 sayfa storefront'ta widget Claude'un dual-Claude review'u sonrası 🟠 (eksik CTA wiring) ve 🟢 (a11y/SEO/perf polish) sırayla kapatıldı. Sefa zaten `lang="tr"`, `font-display: swap`, font subsets, decorative icon `aria-hidden`, `aria-pressed` toggle pattern'leri gibi temelleri kurmuş — bu tur **boşluk doldurma**, refactor değil.

3 atomik commit:

| Commit | Konu | Dosya |
|---|---|---|
| `123d150` | SEO meta + robots + sitemap + JSON-LD | 34 |
| `934b3be` | A11y skip-link + focus-visible + fieldset | 6 |
| (bu) | Perf next.config + reduced-motion + doc | 3 |

Build: 31 → **33 route** (yeni: `/robots.txt`, `/sitemap.xml`). TS clean.

---

## 🟢 SEO — Uygulanan

### S-1 · Sayfa-bazlı metadata (22 sayfa)

**Bulgu**: Root `app/layout.tsx` global metadata'sı vardı, ancak 29 sayfanın 6 yasal sayfa hariç hepsinde `metadata` export'u yoktu. Her sayfa SERP'te aynı title ile çıkıyordu.

**Uygulama**:
- Root layout'ta `metadataBase`, `title.template = "%s · Pim Etiket"`, `openGraph`, `twitter`, `robots`, `applicationName`, `keywords`, `category` eklendi.
- Server pages (`/`, `/hakkimizda`, `/iletisim`, `/panelim`, `/admin`) → `export const metadata` direkt `page.tsx`'e.
- Client pages (17) → kardeş `layout.tsx` (server component) ile metadata. Page'lerin `"use client"` durumu korundu.
- Yasal 6 sayfada title temizlendi (template otomatik `· Pim Etiket` ekliyor) + description + canonical.
- Tüm noindex sayfalar (`/admin/*`, `/panelim`, `/profil`, `/cuzdan`, `/adreslerim`, `/fatura-bilgileri`, `/siparislerim`, `/siparis/[id]`, `/sepet`, `/odeme`, `/odeme-sonuc`, `/sifre-sifirla`, `/auth`) için `robots: { index: false, follow: false }` set edildi.

### S-2 · `robots.txt` + `sitemap.xml`

`app/robots.ts` ve `app/sitemap.ts` (Next 16 file-based metadata routes).

- `robots.txt`: tüm hesabım/admin/funnel route'larını disallow + sitemap link.
- `sitemap.xml`: 12 public route (anasayfa + ürün × 2 + marketing × 3 + yasal × 6).
- Site URL: `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"` — `.env.example` template eklendi.

### S-3 · Structured data (JSON-LD)

Root layout'a 2 schema:
- `Organization` (name, url, logo, address: Bursa/TR)
- `WebSite` (potentialAction `SearchAction`)

**Atlananlar (J/L turuna ertele)**:
- `BreadcrumbList` — etiket/sticker'da görsel breadcrumb var ama her sayfada yok, J turunda tutarlı eklenir.
- `FAQPage` — `/sss` sayfasında accordion var, J turunda eklenir.
- `Product` — fiyat dinamik (configurator), backend SKU bilgisi gerek (I sonrası).
- `Review` / `AggregateRating` — gerçek review sistemi yok.

---

## 🟢 A11y — Uygulanan

### A-1 · Skip-link (WCAG 2.4.1)

Root layout'ta `<a href="#main">` (sr-only + focus:not-sr-only). AppShell ve AdminShell wrapper'ları `<div id="main" tabIndex={-1}>` ile hedef oldu.

**Karar**: Sayfaların kendi `<main>` etiketi var → wrapper `<div>` (HTML5 nested main yasak). Wrapper landmark değil, sadece skip target.

### A-2 · Global `:focus-visible` (WCAG 2.4.7)

`globals.css`'e tek kural: 2px `--color-pim-mercan` outline + 2px offset. `tabindex="-1"` wrapper'larda kapalı (skip-link target'a focus alındığında çerçeve gerekmesin).

### A-3 · TopBar sepet aria-label

Önce: `aria-label="Sepet (2 ürün)"` (sabit "2", mock data — boş sepette de "2 ürün" der → yanıltıcı).
Sonra: `aria-label="Sepet"` + TODO comment ("I adımında dinamik bağlanacak").

### A-4 · 3D/Düz toggle

Önce: noop button'lar (onClick yok, görsel state yok).
Sonra: `disabled aria-disabled="true" aria-pressed` + `role="group"` + `title` tooltip + visual disabled state.

**Karar**: Toast bağlamadık çünkü kullanıcı görsel değişiklik bekler — disabled doğru sinyal.

### A-5 · Sarım yönü `<fieldset>` + `<legend>`

Önce: 2 `<div>` blok ("DIŞA SARIM" / "İÇE SARIM" sadece görsel separator).
Sonra: 2 `<fieldset>` + `<legend>` semantic gruplandırma. Her `SelectableCard`'a `aria-label="Dışa/İçe sarım yön N"`.

Screen reader artık "Dışa sarım yön 1, basılmadı" gibi tam context duyacak.

### A-6 · Profil bildirim checkbox `id`+`name`+`htmlFor`

Önce: `<label>` checkbox sarıyordu (implicit association ✓), ama input'ta `id`/`name` yok → form submit'te kullanılamaz.
Sonra: `id="notif-{id}"` + `name="notif-{id}"` + `htmlFor` eklendi. I adımı için hazır.

### A-7 · `Eyebrow` heading hierarchy doğrulandı

`Eyebrow` `<span>` (neutral, h2/h3 olarak yorumlanmaz) — heading order ihlali yok ✓.

---

## 🟢 Performance — Uygulanan

### P-1 · `next.config.ts` tuning

```ts
{
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
}
```

`poweredByHeader: false` — `X-Powered-By: Next.js` header'ını kaldırır (security + ~30 byte/response).

### P-2 · `prefers-reduced-motion`

`globals.css`'e media query: motion-sensitive kullanıcılar için animation/transition 0.01ms cap. `animate-fade-up`, `hover:-translate-y-0.5` ve diğer transition'lar otomatik etkilenir.

---

## 🚫 Bilinçli scope-dışı

PLAN.md'ye ve karar süzgecine göre **bu turda yapılmadı**:

- **i18n çoklu dil** (`hreflang`, dil switcher) — PLAN.md TR-only
- **B2B portal SEO** — out-of-scope
- **Marketplace schema** — yok
- **Çoklu döviz** — TRY-only
- **RN/mobile app şeması** — yok
- **`<img>` → `next/image` migration** — Pim mascot inline SVG, profesyonel vektör asset gelmeden migration prematüre. PIM_MASCOT_BRIEF.md'de planlı.
- **Real OG image** — `images: ["/og-default.png"]` field'ı root metadata'dan **çıkarıldı**, mascot final'iyle paralel eklenecek.
- **Apple touch icon + PWA manifest** — placeholder PNG yaratmak yerine asset hazır olunca.
- **`Product` JSON-LD** — fiyat dinamik, backend gerek (I sonrası).
- **`BreadcrumbList` + `FAQPage` JSON-LD** — J/L turunda tutarlı şekilde.

---

## ❓ Karar verilenler özet

| # | Konu | Karar |
|---|---|---|
| 1 | `NEXT_PUBLIC_SITE_URL` | `.env.example` + `localhost:3000` fallback. Production: `https://pimetiket.com` |
| 2 | JSON-LD scope | Sadece Organization + WebSite. FAQ + Breadcrumb J/L'de |
| 3 | 3D/Düz toggle | `disabled` + `aria-disabled` + `title` (Toast yanlış sinyal) |
| 4 | Pim asset migration | Scope-out — profesyonel vektör beklenecek |
| 5 | OG image | `images` field'ı şimdi metadata'dan çıkarıldı |
| 6 | Apple icon / PWA manifest | Asset hazır olunca, şimdi atla |

---

## Build verifikasyon

```
✓ Compiled successfully in 5.2s
✓ Generating static pages (33/33)

Route summary:
  31 → 33 route (+ /robots.txt, + /sitemap.xml)
  TypeScript: clean
  Static prerender: 32/33 (yalnız /siparis/[id] dynamic)
```

---

## Sonraki adımlar (J / L turu için not)

1. Pim mascot profesyonel vektör hazır olunca:
   - `public/og-default.png` (1200×630)
   - Root metadata'ya `openGraph.images` + `twitter.images`
   - `app/opengraph-image.tsx` (Next 16 dynamic OG generation alternatifi)
   - `app/apple-icon.png` (180×180)
2. PWA manifest: `app/manifest.ts` (Cloudflare deploy sonrası)
3. JSON-LD: `BreadcrumbList` (etiket + sticker) + `FAQPage` (sss)
4. Backend bağlandıktan sonra (I sonrası): TopBar sepet `aria-label` dinamik count + `Product` JSON-LD
