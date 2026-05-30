# Pim Etiket — SEO & AI-Arama (AEO/GEO) Planı

_31 Mayıs 2026. Hedef: Google'da ve AI yanıtlarında (ChatGPT, Perplexity, Google AI Overviews, Claude) etiket/sticker baskı terimlerinde görünmek._

Mevcut durum denetimi: teknik SEO ~%85 hazır (robots, sitemap, canonical, OG, schema güçlü). **En büyük tek sorun: AI arama botları engelli.** Aşağıda Google + AI iki ayrı kol, öncelik sırasıyla.

> Kim yapacak işareti: **[KOD]** = Cursor/Claude · **[SEFA]** = panel/env/içerik/dış · **[İÇERİK]** = blog/metin yazımı

---

## 0. KRİTİK KARAR — AI crawler politikası (AI planının ekseni)

`src/app/robots.ts` şu an **tüm AI botlarını** engelliyor. İki tür AI botu var, ayrımı yapmak şart:

| Tür | Botlar | Ne işe yarar | Öneri |
|---|---|---|---|
| **Arama/alıntı (retrieval)** | OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, ClaudeBot, Claude-Web | AI **cevaplarında seni gösterir/alıntılar** | **AÇ** (görünmek istiyorsan zorunlu) |
| **Eğitim (training)** | GPTBot, Google-Extended, CCBot, anthropic-ai, Applebot-Extended, Bytespider | İçeriğini model **eğitimine** alır | İstersen KAPALI kalsın (görünürlüğü etkilemez) |

**Not (KVKK):** Engelleme gerekçesi "üçüncü tarafa veri satışı yok"tu. Ama AI botlarına açılan sayfalar **public pazarlama sayfaları** (ürün/blog/SSS) — müşteri verisi değil; o route'lar zaten `*` için kapalı. Dolayısıyla retrieval botlarını açmak KVKK'yı ihlal etmez.

**Önerilen politika:** Retrieval botlarını AÇ (görünürlük), training botlarını KAPALI tut (kontrol). Google AI Overviews zaten normal Googlebot ile çalışıyor → ek iş yok, sadece iyi SEO.

---

## A. GOOGLE TARAFI

### P0 — Hızlı kazanımlar (kod + kurulum, gün içinde)
1. **[SEFA] Google Search Console** — domain doğrula + `sitemap.xml` submit. Tüm Google görünürlüğünün ön koşulu; index durumu + arama sorguları buradan görünür. (Env: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.)
2. **[SEFA] GA4** — `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (analytics oturumundan kalan iş).
3. **[KOD] /iletisim'e LocalBusiness schema + canonical** — Google "İşletme Bilgileri" paneli + yerel arama. (`SchemaJsonLd` zaten `localBusinessSchema()` içeriyor, sadece mount edilecek; telefon/adres/saat Sefa verecek.)
4. **[KOD] Blog `revalidate=3600`** — `blog/[slug]/page.tsx` ISR cache (şu an her istekte render).
5. **[SEFA] Sosyal medya linkleri** — `NEXT_PUBLIC_SOCIAL_LINKS` → Organization `sameAs` (knowledge graph + güven).

### P1 — İçerik & yapı (asıl sıralama buradan gelir, 1-2 hafta)
6. **[KOD] Programatik malzeme/tür landing sayfaları** — `/malzeme/[slug]` (kuşe, şeffaf/transparan, kraft, metalik/simli, holografik, vinil…) ve kesim/şekil için (`/sticker/die-cut`, `/etiket/rulo`). Her sayfa: malzeme açıklaması + uygun ürün/şablon grid + 3-5 SSS + ilgili blog linkleri. **En büyük SEO kazancı buradadır** — "kuşe etiket baskı", "şeffaf etiket", "holografik sticker" gibi long-tail terimler tek tek sayfa ister; şu an hepsi tek grid'de eziliyor.
7. **[İÇERİK] Blog içerik takvimi** — ayda 4-6 yazı, niyet (intent) bazlı:
   - *Bilgilendirici:* "Kuşe mi şeffaf etiket mi?", "Die-cut sticker nedir?", "Zeytinyağı etiketi tasarımı ipuçları", "Kombucha etiketinde yasal zorunluluklar".
   - *Karşılaştırma:* "Rulo vs tabaka etiket", "Mat vs parlak laminasyon".
   - *Sektörel:* "Butik kozmetik markası için etiket rehberi" (zeytinyağı/bal/mum/kahve/pet — her dikey ayrı yazı).
   - Her yazıya `seoTitle` (~55 karakter) + `seoDescription` (~155) + kapak görseli + iç linkler (ürün + diğer yazı).
8. **[KOD] Blog etiket (tag) sistemi + iç linkleme** — `/blog/etiket/[tag]`; yazılar arası ve yazı→ürün çapraz link (topical authority + crawl derinliği).
9. **[KOD] hreflang / `alternates.languages`** — TR/EN. EN için `/en` prefix route stratejisi veya en azından `alternates.languages` tanımı; yoksa Google TR/EN'i kopya sanabilir. (i18n şu an client-side; karar gerek — bkz. notlar.)

### P2 — Otorite & teknik ince ayar (sürekli)
10. **[SEFA] Backlink & listeleme** — Google Business Profile, sektör dizinleri, "etiket baskı" yapan firmaların çıktığı karşılaştırma/blog siteleri, sosyal kanıt. Domain otoritesi sıralamanın belkemiği; kod bunu çözmez.
11. **[SEFA] İlk yorumlar** — `AggregateRating` schema hazır ama `reviewCount>0` şartı var. İlk gerçek yorumlar gelince yıldız rich-result açılır → CTR artışı.
12. **[KOD] Core Web Vitals** — prefetch/503 işi bitti; deploy sonrası Search Console "Core Web Vitals" + PageSpeed ile doğrula, LCP/CLS regresyonu varsa düzelt.

---

## B. AI TARAFI (AEO/GEO — AI cevaplarında çıkmak)

### P0 — Görünürlüğün ön koşulu
1. **[KOD] robots.ts retrieval botlarını AÇ** (yukarıdaki KRİTİK KARAR). Bu yapılmadan aşağıdaki her şey boşa; AI siteyi okuyamaz.
2. **[KOD] `public/llms.txt`** — AI'a siteyi özetleyen yapılandırılmış rehber: ne yaptığımız (Türkiye'de online etiket/sticker baskı), ürün/malzeme listesi, anahtar sayfaların linkleri (etiket, sticker, malzemeler, SSS, blog), iletişim. AI arama motorları bunu okur → doğru/eksiksiz alıntılar.

### P1 — Alıntılanabilirlik (citation-readiness)
3. **[İÇERİK] AI'ın alıntılamayı sevdiği format** — net tanımlar ("X nedir: tek cümle"), Q&A blokları, **karşılaştırma tabloları**, madde listeleri, fiyat/teslimat gibi somut sayılar. SSS ve malzeme sayfaları buna uygun yazılmalı. AI cevapları kısa, kesin, tablo/liste içeren kaynakları seçer.
4. **[KOD] Schema zenginleştirme** — Product'a `Offer` (fiyat aralığı, teslimat, iade), `BreadcrumbList` her landing'de, malzeme sayfalarına `FAQPage`. Yapılandırılmış veri AI'ın içeriği doğru ayrıştırmasını kolaylaştırır.
5. **[İÇERİK] Marka/varlık tutarlılığı** — "Pim Etiket" her yerde aynı tanımla ("Türkiye'de online etiket ve sticker baskı") geçsin (anasayfa, hakkımızda, llms.txt, schema, sosyal profiller). AI markayı bir "varlık" olarak öğrenir.

### P2 — Dış sinyal (AI'ın güvendiği kaynaklar)
6. **[SEFA] Üçüncü taraf görünürlük** — AI cevapları büyük ölçüde Reddit/Ekşi/forum, karşılaştırma siteleri, sektör blogları ve (varsa) Wikipedia/Vikipedi'den beslenir. "Türkiye etiket baskı" bağlamında bu kaynaklarda Pim Etiket'in geçmesi (içerik, yorum, PR) AI görünürlüğünü koddan daha çok artırır.
7. **[SEFA] Google Merchant / yapılandırılmış ürün feed** (opsiyonel) — AI alışveriş yanıtları için ürün verisi.

---

## ÖNCELİKLENDİRİLMİŞ İCRA SIRASI
1. **[KOD] robots AI politikası + llms.txt** ← AI görünürlüğünü açan tek hamle
2. **[SEFA] Search Console + GA4 + sosyal env** ← Google'ın ön koşulu
3. **[KOD] /iletisim LocalBusiness + blog revalidate + Product Offer schema** ← hızlı kazanım
4. **[KOD] Programatik malzeme/tür landing sayfaları** ← en büyük organik kazanım
5. **[İÇERİK] Blog takvimi + SSS/malzeme AI-format** ← süregelen
6. **[SEFA] Backlink/listeleme/yorum + dış AI sinyali** ← otorite (sürekli)

## NOTLAR
- Anahtar kelime hacimleri kesinleşmeden (Search Console + Keyword Planner) içerik başlıklarını veriyle netleştir; tahminle değil.
- hreflang için EN gerçekten hedefleniyor mu? Hayırsa TR-only `canonical` yeterli, `/en` prefix'e gerek yok — gereksiz karmaşa yaratma.
- Kod işleri için ayrı Cursor prompt'u: robots+llms.txt+schema+landing sayfaları paketlenecek.
</content>
