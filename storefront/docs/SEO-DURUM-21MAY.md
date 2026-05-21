# 🔍 SEO Durumu Snapshot — 21 Mayıs 2026

> Sefa "şimdilik beklesin" dedi — bu doküman bulguları + yarım kalan
> işleri saklar. İleride döndüğümüzde sıfırdan analiz gerekmez.

---

## 📊 Genel Skor

- **Önceki:** 7/10
- **Şu an:** 9/10 (sosyal medya env + telefon eklenince 9.5)

---

## ✅ Bugün tamamlananlar (commits: c0c0340, 9022e4e, 1d26084)

| # | İş | Durum |
|---|---|---|
| 1 | `src/app/opengraph-image.tsx` (anasayfa OG) | 🟡 v3 deploy bekliyor (v1 ve v2 0 byte fail oldu) |
| 2 | `src/app/etiket/opengraph-image.tsx` | ✅ **40 KB PNG canlı** |
| 3 | `src/app/sticker/opengraph-image.tsx` | ✅ **72 KB PNG canlı** |
| 4 | `layout.tsx` — `images: undefined` koşullu | ✅ File convention çalışır |
| 5 | `/etiket/layout.tsx` — Product + Breadcrumb schema | ✅ Rich Results adayı |
| 6 | `/sticker/layout.tsx` — Product + Breadcrumb schema | ✅ Rich Results adayı |
| 7 | `layout.tsx` Organization zenginleştirme | ✅ legalName + vatID + tam adres |
| 8 | ISR `revalidate = 3600` | ✅ **TTFB 1.2s → 0.4s** (-%67) |

---

## ⏳ Yarım kalan / bekleyen

### 🟡 1. Anasayfa og:image v3 deploy verify (ScheduleWakeup tetiklendiğinde)
**Sorun:** v1 (gradient + 3-bölüm + nested span) → 0 byte. v2 (solid color) → hala 0 byte. v3 (/etiket pattern'i taklit, span yok, sade) deploy oldu, henüz verify etmedik.

**Aksiyon:** `curl -s -o /dev/null -w "%{size_download}" https://pimetiket.com/opengraph-image` > 0 dönmeli.

**Eğer hala 0 byte:** Satori'nin başka bir kısıtı var. Vercel function logs'a bak veya **statik PNG fallback** (`public/og-home.png` 1200×630) yaratıp `layout.tsx`'te explicit URL set et.

---

## 🔴 Admin SEO Panel Eksik Alanları (analiz raporu)

### Mevcut admin SEO kapsamı

| Admin sayfa | SEO işlevi | Durum |
|---|---|---|
| `/admin/gorseller` | **Site_images (9 slot)** — og_default, og_home, hero'lar | ✅ Mevcut ama **DB boş** (Sefa kullanmıyor) |
| `/admin/urunler` | product_cards title/desc | 🟡 SEO meta yok |
| `/admin/ayarlar` | Kargo + kredi + limitler | ❌ **Sosyal medya YOK, iletişim YOK** |
| Blog admin | — | ❌ **HİÇ YOK** (4 yazı statik) |

### 9 site_image slot (admin'den yönetilebilir, kullanılmıyor)
```
Anasayfa:    home_hero, home_etiket_card, home_sticker_card
Sayfalar:    sablonlar_hero, auth_hero, demo_hero
Sosyal:      og_default, og_home   ← og:image override için
Blog:        blog_default_hero
```

### Önerilen 4 seçenek (Sefa karar verecek)

| Seçenek | Süre | Etki |
|---|---|---|
| 🅰️ `/admin/ayarlar`'a SEO/iletişim sekmesi (Mig 078 + UI) | 30 dk | Sosyal medya + telefon admin'den yönetilir, Vercel env'e girmesin |
| 🅱️ A + Blog admin (Mig 079 + sayfalar) | ~3.5 saat | A + düzenli blog yazısı yazma kolaylığı |
| 🅲 Şimdi yapma — env yöntemi yeterli | 0 | Mevcut akış devam |
| 🅳 Sadece `/admin/gorseller` kullanım rehberi | 5 dk | Sefa og:image yüklemeyi öğrenir |

**Sefa'nın eğilimi:** A — sosyal medya + iletişim sekmesi mantıklı (sürekli değişen veri, Vercel env sürtünmesi yok).

---

## 🟢 Sefa-tarafı yapacaklar (BEKLEYEN-ISLER.md ile çakışıyor)

1. **`NEXT_PUBLIC_SOCIAL_LINKS` env ekle** (Vercel, geçici çözüm — A seçeneği yapılırsa gereksiz)
   ```
   NEXT_PUBLIC_SOCIAL_LINKS=https://instagram.com/pimetiket,https://x.com/pimetiket
   ```
2. **Telefon numarası ver** — `contactPoint` schema'ya eklenir
3. **Opsiyonel:** `/admin/gorseller` → `og_default` slot'a özel 1200×630 PNG yükle

---

## 📈 Detaylı SEO bulgular (21 May sabah analiz)

### İyi durumdaki 11 alan
- robots.txt sağlam (AI bot block — GPTBot, ChatGPT, anthropic-ai bloke)
- sitemap.xml 23 URL canlı
- Anasayfa title + description doğru
- Canonical URL'ler doğru
- Open Graph kısmen (og:title, og:description, og:url, og:site_name, og:locale, og:type) ✅
- Twitter Card (summary_large_image)
- JSON-LD (Organization + WebSite)
- Search Console doğrulama (Google + Yandex meta)
- Sayfa-bazlı metadata (20+ sayfada)
- Multi-lang sinyali (tr-TR)
- ISR çalışıyor

### Hala eksik (P2, ileride)
- Blog Article schema (`/blog/[slug]`)
- FAQ schema (`/sss`)
- Breadcrumb schema (iç sayfalarda)
- Telefon (`contactPoint` Organization schema)
- Anasayfa `<img>` tag sayısı düşük — LCP optimizasyonu

---

## 🚀 Devam edileceğinde nereden başla?

1. **Anasayfa og:image v3 verify** (ScheduleWakeup zaten programlı, otomatik geliyor)
2. **A seçeneği** — sosyal medya/iletişim admin sekmesi (30 dk)
3. **Telefon eklenince** — schema contactPoint + footer + KVKK (5 dk)

---

**İlgili dokümanlar:** `LAUNCH-READINESS-21MAY.md`, `BEKLEYEN-ISLER.md`, `HESAP-KAYITLARI.md`
**Son commit:** `1d26084 fix(seo): anasayfa og:image v3`
