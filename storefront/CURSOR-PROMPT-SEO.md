# SEO & AI-Arama Kod Paketi (Faz 1)

> Kaynak plan: `SEO-PLAN-2026-05.md`. Bu prompt **kod işlerini** topluyor. Sefa kararı (31 May):
> AI arama botlarını AÇ (eğitim botları kapalı kalsın); EN hedef ama hreflang AYRI faz (aşağıda NOT).
> CLAUDE.md sefaRules geçerli.

---

## GÖREV 1/6 — robots.ts: AI arama botlarını aç (eğitim botları kapalı)

#### Dosya: `src/app/robots.ts`
AI'da görünmek için **arama/retrieval** botları engeli kalkmalı; **eğitim** botları + SEO scraper'lar kapalı kalsın.

- **AÇ** (her birine `*` ile aynı kural: `allow: "/"` + aynı private `disallow` listesi — admin/panelim/sepet/odeme/api vb.):
  `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `ClaudeBot`, `Claude-Web`, `Applebot` (Extended DEĞİL).
  → Bu botların mevcut `disallow: "/"` kurallarını **kaldır**, yerine `*` ile aynı allow/disallow bloğunu ver.
- **KAPALI kalsın** (eğitim — `disallow: "/"`): `GPTBot`, `Google-Extended`, `CCBot`, `anthropic-ai`,
  `Applebot-Extended`, `Bytespider`, `FacebookBot`, `Diffbot`, `ImagesiftBot`.
- **KAPALI kalsın** (SEO scraper): `AhrefsBot`, `SemrushBot`, `MJ12bot`, `DotBot`, `SeznamBot`, `PetalBot`.
- Dosya başındaki yorumu güncelle: "retrieval botları açık (AI görünürlük), training botları kapalı (kontrol)".
- Private disallow listesini tek sabitte topla (DRY) ve hem `*` hem retrieval botlarında kullan.

**Doğrulama:** `/robots.txt` çıktısında `PerplexityBot`/`OAI-SearchBot`/`ClaudeBot` için `Allow: /` + private bloklar;
`GPTBot`/`Google-Extended`/`CCBot` için `Disallow: /`.

---

## GÖREV 2/6 — `public/llms.txt`

#### Yeni dosya: `public/llms.txt`
AI arama motorlarının siteyi doğru özetlemesi için yapılandırılmış rehber (Markdown). İçerik:
```
# Pim Etiket
> Türkiye'de online etiket ve sticker baskı hizmeti. Kuşe, şeffaf/transparan, kraft, metalik,
> holografik, vinil malzemelerde rulo ve tabaka etiket; die-cut, kiss-cut, bumper sticker baskısı.
> Online yapılandır, tasarım yükle/şablon seç, baskıya gönder.

## Ürünler
- [Etiket baskı](https://pimetiket.com/etiket): rulo + tabaka; kuşe, şeffaf, kraft, metalik...
- [Sticker baskı](https://pimetiket.com/sticker): die-cut, kiss-cut, holografik, transparan, bumper
- [Malzemeler](https://pimetiket.com/malzemeler): 8 malzeme + kaplama + özelleştirme
- [Hazır kesim şablonları](https://pimetiket.com/sablonlar): 65 die-cut şablon

## Bilgi / Rehber
- [SSS](https://pimetiket.com/sss): malzeme, kesim, teslimat, ödeme soruları
- [Blog](https://pimetiket.com/blog): etiket/sticker rehberleri ve karşılaştırmalar

## İletişim
- [İletişim](https://pimetiket.com/iletisim)
```
> Gerçek domain'i `NEXT_PUBLIC_SITE_URL`'den değil, statik dosya olduğu için sabit `https://pimetiket.com`
> yaz (doğru domaini Sefa teyit etsin). Kısa, net, link-ağırlıklı tut.

**Doğrulama:** `/llms.txt` erişilebilir, geçerli markdown, linkler doğru.

---

## GÖREV 3/6 — /iletisim: LocalBusiness schema + canonical

#### Dosya: `src/app/iletisim/page.tsx` (+ layout varsa metadata)
- `SchemaJsonLd` + `localBusinessSchema(...)` mount et (`@/components/SchemaJsonLd`).
  Telefon/adres/çalışma saatleri **placeholder** geç ve `<!-- SEFA: telefon/adres/saat doldur -->` yorumu bırak
  (Sefa gerçek bilgiyi verecek). Adres alanı yoksa en azından il/ilçe + email + URL.
- Metadata'ya `alternates: { canonical: "/iletisim" }` ekle (diğer sayfalarla tutarlılık).

**Doğrulama:** `/iletisim` kaynağında LocalBusiness JSON-LD + `<link rel=canonical>` var.

---

## GÖREV 4/6 — Blog ISR

#### Dosya: `src/app/blog/[slug]/page.tsx`
- `export const revalidate = 3600;` ekle (1 saat ISR). `force-dynamic` varsa kaldır.
- `generateStaticParams()` ekle (yayınlanmış slug'lar) → en çok okunan yazılar build'de statik üretilsin.

**Doğrulama:** Blog yazısı statik/ISR servis edilir; içerik güncellemesi ≤1 saatte yansır.

---

## GÖREV 5/6 — Programatik malzeme landing sayfaları `/malzeme/[slug]` (en büyük organik kazanım)

#### Yeni: `src/app/malzeme/[slug]/page.tsx` (+ gerekirse `layout.tsx`/`generateMetadata`)
- Malzeme verisini `/malzemeler` sayfasındaki **MATERIALS** dizisinden TEK KAYNAK olarak çıkar
  (`src/app/malzemeler/page.tsx` içindeki listeyi `src/lib/seo/materials.ts`'e taşı, iki sayfa da kullansın — duplike etme).
- Slug'lar (8): `kraft`, `beyaz-semi-glos`, `ultra-clear`, `metalik`, `vinil`, `transparan`, `holografik`, `simli`
  (mevcut id'lerin kebab hali; `id↔slug` map'i `materials.ts`'te).
- `generateStaticParams()` ile 8 sayfa statik üret.
- `generateMetadata`: title `"{Malzeme} Etiket & Sticker Baskı — Pim Etiket"`, açıklama malzeme tanımından,
  `alternates.canonical: /malzeme/{slug}`, OG.
- Sayfa içeriği (AI-alıntısına uygun): H1 + malzeme tanımı (net 1-2 cümle) + kullanım alanları (liste) +
  "kime uygun" + uygun ürünlere CTA (`/etiket`, `/sticker`) + 3-5 SSS (`faqSchema`) + `breadcrumbSchema`.
- **Sitemap:** `src/app/sitemap.ts`'e 8 `/malzeme/{slug}` URL'sini ekle (priority 0.7, monthly).
- **İç linkleme:** `/malzemeler` sayfasındaki her malzeme kartından ilgili `/malzeme/{slug}` detayına link.

**Doğrulama:** `/malzeme/kraft` vb. 8 sayfa açılır, kendi metadata + FAQ + breadcrumb schema'lı; sitemap'te;
`/malzemeler`'den linkli; tek malzeme veri kaynağı (`materials.ts`).

---

## GÖREV 6/6 — Product schema teslimat/iade zenginleştirme (küçük)

#### Dosya: `src/components/SchemaJsonLd.tsx` (`productSchema`)
`AggregateOffer` zaten var. Mümkünse ekle: `priceCurrency: "TRY"`, `availability`,
`shippingDetails`/`hasMerchantReturnPolicy` (TKHK/iade politikasına uygun — "süresiz" YASAK, somut gün ver).
Riskli/zaman alıcıysa atla; sefaRules'a aykırı alan ekleme.

**Doğrulama:** `/etiket` Product JSON-LD `priceCurrency: TRY` + availability içerir; Rich Results Test'te hatasız.

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz.
2. `/robots.txt`: retrieval botları Allow, training/scraper Disallow.
3. `/llms.txt` erişilebilir.
4. `/iletisim` LocalBusiness + canonical.
5. `/malzeme/{8 slug}` çalışıyor, sitemap + iç link + schema.
6. Blog ISR; mevcut sayfalar (anasayfa, etiket, sticker, sss) bozulmadı.
7. Google Rich Results Test: Product, FAQPage, LocalBusiness, Breadcrumb hatasız.

## YENİ/DEĞİŞEN DOSYALAR
Yeni: `public/llms.txt`, `src/lib/seo/materials.ts`, `src/app/malzeme/[slug]/page.tsx` (+layout).
Düzenlenecek: `src/app/robots.ts`, `src/app/iletisim/page.tsx`, `src/app/blog/[slug]/page.tsx`,
`src/app/sitemap.ts`, `src/app/malzemeler/page.tsx` (materials.ts'e refactor + linkler),
`src/components/SchemaJsonLd.tsx` (opsiyonel).

## BU PROMPTTA YOK (ayrı faz — büyük iş)
**EN / hreflang:** Mevcut i18n client-side (localStorage; ayrı `/en` URL yok). Doğru hreflang için
`/en/*` route yapısı (App Router locale routing) gerekir — ayrı planlanacak. Bu pakette `alternates.languages`
EKLEME (olmayan `/en` URL'lerine hreflang vermek 404 sinyali olur, zarar verir).
</content>
