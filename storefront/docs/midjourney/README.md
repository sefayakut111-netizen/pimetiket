# Pim Etiket — Midjourney Görsel Üretim Rehberleri

Bu klasör Sefa'nın **74 görselin** Midjourney ile üretilmesi için sayfa-bazlı prompt rehberlerini içerir.

---

## 📂 Doc index

| Doc | Durum | Görsel sayısı | Slot path |
|-----|-------|---------------|-----------|
| [etiket-cards.md](./etiket-cards.md) | ✅ Hazır (brand refresh) | 11 | `public/etiket-cards/` |
| [sticker-cards.md](./sticker-cards.md) | ⏳ Refresh bekliyor | 11 | `public/sticker-cards/` |
| sablonlar-cards.md | ⏳ Yazılacak | 12 | `public/sablonlar-cards/` |
| anasayfa.md | ⏳ Yazılacak | 5 (hero + 4-adım) | `public/hero/` + `public/home-process/` |
| email-banners.md | ⏳ Yazılacak | 6 | `public/email/` |
| og-images.md | ⏳ Yazılacak | 3 | `public/og/` |
| dashboard-icons.md | ⏳ Yazılacak | 19 (8 + 11) | `public/dashboard/` |
| empty-states.md | ⏳ Yazılacak | 5 | `public/empty/` |
| hakkimizda-timeline.md | ⏳ Yazılacak | 1 | `public/hakkimizda/` |
| iletisim-contact.md | ⏳ Yazılacak | 1 | `public/iletisim/` |
| 404-error.md | ⏳ Yazılacak | 1 | `public/error/` |

**TOPLAM:** ~74 görsel.

---

## 🎨 Brand Base Prompt (TÜM doc'larda aynı)

Her sayfa doc'unda bu paragraf prompt'un başına eklenir:

```
Pim Etiket brand style: warm, friendly Turkish e-commerce brand for digital
label printing. Color palette: coral red #FF6B5B as primary accent, deep navy
#1F2937 for outlines and depth, warm cream #F5EBD9 for soft backgrounds, very
light coral #FFF1EE for subtle tints. Visual style: flat 2D design with subtle
neumorphism — soft dome highlights, gentle drop shadows, 14px corner radius.
Premium yet approachable. Isometric perspective with realistic paper/foil
textures. Subtle noise grain on surfaces. No text, no logo, no watermark.
Clean white background.
--style raw --stylize 100 --v 6
```

`--ar` parametresi sayfa-bazlı değişir (etiket 220:130, sticker 200:130, OG 1200:630, vs.).

---

## 🎭 Pim mascot kuralı

| Sayfa | Pim kullanımı |
|-------|---------------|
| /etiket grid kartları | ❌ Yok (sadece ürün mockup) |
| /sticker grid kartları | ❌ Yok |
| /sablonlar kategori kartları | ❌ Yok (örnek tasarım odaklı) |
| Anasayfa hero | ✅ Pim happy/wave pose |
| Anasayfa 4-adım | ✅ Her adımda Pim farklı pose |
| Email banner'ları | ✅ Pose'a göre (welcome=wave, success=happy, fail=sad) |
| OG sosyal medya | ✅ Pim + ürün karışım |
| Empty state'ler | ✅ Pim think/box/wait |
| Dashboard icon set | ❌ Yok (icon-only) |
| 404 error | ✅ Pim think + soru işareti |

**Sebep:** Etiket/sticker/şablon kartlarında Pim eklemek dikkat dağıtır — kullanıcı ürünü seçmeli, mascot'la oynamamalı. Pim diğer sayfalarda brand identity sinyali olarak gözükür.

---

## 🔧 Workflow ortak

Her sayfa doc'unda aynı 6 adımlık workflow vardır:

1. Midjourney aboneliği (Basic $10/ay)
2. İlk Card 1'i çalıştır → seed bul → kaydet
3. Geri kalan prompt'ları aynı seed ile çalıştır
4. PNG'leri indir + sırala (alfabetik)
5. `node scripts/upload-cards.mjs <kategori> <kaynak-klasor>` çalıştır
6. Bana haber ver, ben kod tarafında path'leri güncelleyim

`scripts/upload-cards.mjs` desteklenen kategoriler: `etiket`, `sticker`, `sablonlar`. Yeni kategoriler eklendiğinde script'e MAPPING eklenmesi gerek.

---

## 📊 Maliyet + süre özeti

| Kategori | Görsel | Üretim süresi | Maliyet |
|----------|--------|---------------|---------|
| Faz 1 ürün vitrin | 22 | ~2 saat | (Basic abonelik içinde) |
| Faz 1.5 anasayfa + sablonlar | 16 | ~1.5 saat | aynı |
| Faz 2 email + sosyal | 9 | ~1 saat | aynı |
| Faz 3 dashboard + empty | 24 | ~2 saat | aynı |
| Faz 4 hikaye | 3 | ~30 dk | aynı |
| **TOPLAM** | **~74** | **~7 saat** | **$10-20** (1-2 ay Basic) |

Midjourney Basic = 200 üretim/ay. 74 görsel × 4 varyant = ~300 üretim → 1.5 ay Basic veya tek seferlik Pro ($30) yeterli.

---

## ✅ Optimization status (deploy edildi)

Sefa Midjourney görsel eklemeden ÖNCE şu optimizasyonlar yapıldı (commit `679b992`):

- ✅ `/etiket` grid Next/Image + aspect-ratio reservation (CLS=0)
- ✅ `/sticker` grid aspect-ratio reservation
- ✅ `layout.tsx` explicit viewport export + theme color
- ✅ `public/manifest.json` PWA + apple-touch-icon
- ✅ `scripts/upload-cards.mjs` batch upload tool

74 görsel eklendiğinde **otomatik AVIF/WebP convert, srcset, lazy load, CLS<0.1** — sıfır ek iş gerekir.

---

## 🎯 Sefa için aksiyon

1. **Etiket'ten başla:** `etiket-cards.md` aç, 11 prompt çalıştır
2. Sonuçları görünce diğer doc'ları sırayla yaz isteyebilirsin: "sticker doc'u refresh", "sablonlar doc yaz", vs.
3. Her seans sonrası: upload script → "hazır" demek → ben path güncellerim → canlı
