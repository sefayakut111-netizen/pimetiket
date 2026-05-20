# /etiket Grid Kartları — Midjourney Prompt Rehberi

**Sayfa:** `/etiket` (görsel ürün filtresi, 11 kart)
**Üretilecek:** 11 PNG (6 rulo + 5 tabaka)
**Hedef:** Premium 3D mockup, brand-tutarlı, mobile-optimized
**Slot path:** `public/etiket-cards/{rulo|tabaka}-<şekil>.png`

---

## 🎨 Brand Base Prompt (HER prompt'a EKLE)

Aşağıdaki paragraf 11 prompt'un başında DEĞİŞMEZ kalır. Tutarlılık için kritik:

```
Pim Etiket brand style: warm, friendly Turkish e-commerce brand for digital
label printing. Color palette: coral red #FF6B5B as primary accent, deep navy
#1F2937 for outlines and depth, warm cream #F5EBD9 for soft backgrounds, very
light coral #FFF1EE for subtle tints. Visual style: flat 2D design with subtle
neumorphism — soft dome highlights, gentle drop shadows, 14px corner radius.
Premium yet approachable. Isometric perspective with realistic paper/foil
textures. Subtle noise grain on surfaces. No text, no logo, no watermark.
Clean white background.
--ar 220:130 --style raw --stylize 100 --v 6
```

### Tutarlılık parametreleri

| Param | Değer | Sebep |
|-------|-------|-------|
| `--seed XXXXX` | İlk üretimden alınan seed (10 prompt aynı kalmalı) | Aynı rulo/kağıt, aynı renk tonu, aynı stil |
| `--ar 220:130` | Kart aspect ratio | Grid layout'la birebir uyumlu (CLS=0) |
| `--style raw` | Düşük artistic decoration | Ürün net görünür |
| `--stylize 100` | Düşük stilize | Doğal renk + form |

**Pim mascot:** Etiket kartlarında Pim KULLANILMAZ — sadece ürün mockup. Pim diğer sayfalarda (anasayfa hero, email banner, error states) gözükür. Bu sayede etiket kartları sade ve ürün-odaklı kalır.

---

## 📐 Çıktı boyutları + entegrasyon

- **Midjourney native:** 2400×1418 (Upscale 2x sonrası)
- **Public path:** `public/etiket-cards/<dosya>.png`
- **Next/Image otomatik:** AVIF/WebP convert, srcset, lazy load
- **Aspect ratio reservation:** `aspect-[220/130]` (sayfada zaten ayarlandı — CLS=0)
- **Mobile sizes prop:** `(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw`

Görseli sıkıştırmana **gerek yok** — Vercel Image Optimization caching ile AVIF üretir (~80KB mobile).

---

## 🔄 ÜST SECTION — Rulo etiket (6 kart)

### Card 1: Özel kesim rulo (Die-cut)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side of frame,
white cylindrical roll with cream-tinted center core showing wound paper
layers, navy outline #1F2937. On right side: two layered die-cut sticker
silhouettes — organic blob shapes with custom contour cut in coral #FF6B5B,
back layer slightly translucent (60% opacity), front layer vivid with white
dashed cut line border. Soft drop shadow under both elements.
```

**Dosya:** `public/etiket-cards/rulo-diecut.png`

---

### Card 2: Şeffaf rulo (Clear)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side, white cylindrical
roll with cream core. On right side: transparent glass-like sticker silhouette
with subtle blue tint (rgba 133,197,255,0.25), navy outline visible through,
small white glass reflection highlight on upper-left. Single layer
emphasizing transparency.
```

**Dosya:** `public/etiket-cards/rulo-clear.png`

---

### Card 3: Yuvarlak rulo (Circle)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side, white cylindrical
roll with cream core. On right side: two stacked circular sticker labels in
coral #FF6B5B with navy outline. Back circle smaller, lighter coral (#FFB5A8),
60% opacity. Front circle larger, vivid #FF6B5B, with white elliptical
highlight on upper-left.
```

**Dosya:** `public/etiket-cards/rulo-circle.png`

---

### Card 4: Kare rulo (Square)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side, white cylindrical
roll. On right side: two stacked square sticker labels in coral #FF6B5B with
navy outline, sharp corners (2px radius), slight rotation (front -4deg, back
+6deg) for stacked depth. White square highlight on front sticker upper-left.
```

**Dosya:** `public/etiket-cards/rulo-square.png`

---

### Card 5: Dikdörtgen rulo (Rectangle)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side, white cylindrical
roll. On right side: two stacked horizontal rectangle sticker labels in coral
#FF6B5B with navy outline. Classic rectangular shape with sharp corners,
back rectangle 4° rotated, front -3° rotated for depth. White rectangle
highlight stripe on front upper portion.
```

**Dosya:** `public/etiket-cards/rulo-rectangle.png`

---

### Card 6: Oval rulo (Oval)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of label printing roll on left side, white cylindrical
roll. On right side: two stacked oval/ellipse sticker labels in coral #FF6B5B
with navy outline, smooth elliptical shape. Back oval lighter (#FFB5A8) 60%
opacity, front oval vivid. Small elliptical white highlight on front.
```

**Dosya:** `public/etiket-cards/rulo-oval.png`

---

## 📄 ALT SECTION — Tabaka etiket (5 kart)

### Card 7: Yuvarlak tabaka (Circle sheet)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of A4 paper sheet rotated -7 degrees, white sheet
with cream-tinted gradient (#F5EBD9 lower edge), navy outline #1F2937,
secondary cream sheet shadow behind at -3deg for stacked depth. Grid of
12 circular round stickers arranged 3 columns × 4 rows in coral #FF6B5B
with navy outlines, evenly spaced. Soft drop shadow under sheet.
```

**Dosya:** `public/etiket-cards/tabaka-circle.png`

---

### Card 8: Özel kesim tabaka (Die-cut sheet)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of A4 paper sheet rotated -7 degrees, white sheet
with cream gradient, navy outline, stacked sheet shadow behind. Grid of
6 die-cut blob silhouettes arranged 2 columns × 3 rows in coral #FF6B5B
with navy outlines, organic custom shapes (each slightly different).
```

**Dosya:** `public/etiket-cards/tabaka-diecut.png`

---

### Card 9: Oval tabaka (Oval sheet)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of A4 paper sheet rotated -7 degrees, white sheet
with cream gradient. Grid of 8 horizontal oval ellipse stickers arranged
2 columns × 4 rows in coral #FF6B5B with navy outlines, smooth elliptical
shapes. Soft drop shadow under sheet.
```

**Dosya:** `public/etiket-cards/tabaka-oval.png`

---

### Card 10: Dikdörtgen tabaka (Rectangle sheet)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of A4 paper sheet rotated -7 degrees, white sheet
with cream gradient. Grid of 8 horizontal rectangle stickers arranged
2 columns × 4 rows in coral #FF6B5B with navy outlines, sharp corners
(2px radius), classic rectangular shape. Soft drop shadow under sheet.
```

**Dosya:** `public/etiket-cards/tabaka-rectangle.png`

---

### Card 11: Kare tabaka (Square sheet)

```
[BRAND BASE PROMPT YUKARIDA]

Isometric illustration of A4 paper sheet rotated -7 degrees, white sheet
with cream gradient. Grid of 9 square stickers arranged 3 columns × 3 rows
in coral #FF6B5B with navy outlines, sharp corners (2px radius), perfectly
equal sides. Soft drop shadow under sheet.
```

**Dosya:** `public/etiket-cards/tabaka-square.png`

---

## 🔄 Workflow — Sefa için adım adım

### 1. Midjourney aboneliği
- `midjourney.com` → Subscribe → **Basic Plan ($10/ay)** yeterli (200 görsel)
- Discord davetiyesi otomatik gelir

### 2. İlk seed'i belirle
- Card 1 prompt'unu **brand base prompt ile birlikte** yapıştır
- 4 varyant gelir → en beğendiğini **U1/U2/U3/U4 ile Upscale**
- Sonuç PNG metadata'sında seed numarası: `... --seed 1234567890`
- Bu seed'i **panoya kopyala**

### 3. Sonraki 10 prompt'ta SAME seed
- Yukarıdaki 10 prompt'ta seed yerine bulduğun seed'i yaz
- Aynı rulo silindiri, aynı kağıt textūrü, aynı renk tonu garantili

### 4. İndir + sırala
- Her görseli Discord'dan "Save Image As..." ile indir
- Klasör adı veya isimle kaydet (örn `01-diecut.png`, `02-clear.png` ...)
- Hepsini tek klasöre koy (örn `~/Downloads/midjourney-etiket/`)

### 5. Batch upload (otomatik isimlendirme)
```bash
cd core/storefront
node scripts/upload-cards.mjs etiket ~/Downloads/midjourney-etiket
```

Script alfabetik sırada okur ve şu isimlerle `public/etiket-cards/` altına kopyalar:
1. `rulo-diecut.png`
2. `rulo-clear.png`
3. `rulo-circle.png`
4. `rulo-square.png`
5. `rulo-rectangle.png`
6. `rulo-oval.png`
7. `tabaka-circle.png`
8. `tabaka-diecut.png`
9. `tabaka-oval.png`
10. `tabaka-rectangle.png`
11. `tabaka-square.png`

### 6. Bana haber ver
"Etiket Midjourney görselleri hazır" de — ben `src/app/etiket/page.tsx`'te 11 satır `imageSrc` path'ini SVG → PNG'ye çeviririm. ~5 dk iş.

---

## ✅ Kalite kontrol checklist

İndirmeden önce her görsel için kontrol et:

- [ ] Coral kırmızı tutarlı mı? (#FF6B5B civarı, çok pembe/turuncu değil)
- [ ] Navy outline #1F2937 (saf siyah değil, hafif mavi-gri)
- [ ] White background gerçekten temiz mi? (gri/sarı tinti yok)
- [ ] Aspect ratio 220:130 mi? (Midjourney bazen 1:1 üretir, regenerate)
- [ ] Drop shadow yumuşak mı? Sert siyah kenar değil
- [ ] Rulo silindiri 3D görünüyor mu? (sadece yan dairesi değil)
- [ ] Tabaka kartlarda kağıt -7° rotate var mı?
- [ ] Stickers boyutu kart için uygun mu? (çok büyük/küçük olmasın)
- [ ] Text / logo / watermark var mı? VAR ise regenerate
- [ ] 11 görsel **aynı** stil-renk-perspektif mi (tutarlılık)?

---

## 🎯 Sonraki adımlar (Sefa için)

1. Bu doc'u oku, brand base prompt'u Discord'a kopyala
2. Card 1'i çalıştır, seed bul, kaydet
3. Diğer 10 prompt'u aynı seed ile sırayla çalıştır
4. Upload script ile public/'a yükle
5. Bana haber → ben path'leri güncellerim → canlıya çıkar

**Süre tahmin:** Üretim ~1 saat, indirme + upload ~30 dk, code update ~5 dk = **~2 saat toplam**.

**Maliyet:** $10 Basic abonelik (1 ay yeterli, sonra cancel) — 11 prompt × 4 varyant = 44 görsel üretim, Basic 200/ay limitinin %22'si.

---

## 🔮 Sonraki sayfalar

Bu pattern'le sonra şu doc'lar yazılacak:
- `docs/midjourney/sticker-cards.md` (11 sticker, brand refresh) — ⏳ var ama refresh bekliyor
- `docs/midjourney/sablonlar-cards.md` (12 kategori — zeytinyağı/bal/kozmetik vs.)
- `docs/midjourney/anasayfa.md` (hero + 4-adım illustrasyon)
- `docs/midjourney/email-banners.md` (6 banner — Pim mascot pose'larıyla)
- `docs/midjourney/og-images.md` (3 sosyal medya)
- `docs/midjourney/dashboard-icons.md` (8 status + 11 SSS icon)
- `docs/midjourney/empty-states.md` (5 boş durum)
- `docs/midjourney/hakkimizda-timeline.md`
- `docs/midjourney/iletisim-contact.md`
- `docs/midjourney/404-error.md`

Sefa her birini seans seans isteyince yazarım.
