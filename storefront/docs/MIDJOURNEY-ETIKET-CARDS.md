# Pim Etiket — /etiket Grid Kart Görselleri için Midjourney Rehberi

**Hedef:** 11 ürün kartı için tutarlı, brand-uyumlu, premium illüstrasyon.

**Mevcut durum:** SVG illüstrasyonları (`public/assets/svg/cards/*.svg`) — orta kalite, hızlı çözüm. Bu rehber Midjourney ile **premium PNG mockup** üretmek için.

**Sefa için:** Aşağıdaki 11 prompt'u sırayla Midjourney'e gönder. Aynı `--seed` ile tutarlılık. Sonuçları `public/etiket-cards/` altına PNG olarak koy, ben `imageSrc` path'lerini değiştireyim.

---

## 1. Brand Stil Rehberi (Style Reference)

Tüm 11 prompt'a EKLE — değişmesin, tutarlılık için:

```
isometric vector illustration, e-commerce product card, label printing,
brand color #FF6B5B coral red, secondary cream #F4F1E6, navy outline #1F1B2D,
flat 2D style with subtle 3D depth, soft drop shadow, clean minimal,
white background, centered composition, no text, no logo,
220×130 aspect ratio horizontal, product mockup
--ar 220:130 --style raw --stylize 100 --v 6
```

### Tutarlılık için kritik parametreler:
- `--seed 12345` (Sefa ilk üretimde rastgele seed alır, sonraki 10 prompt aynı seed ile)
- `--style raw` — fazla artistic decoration olmasın
- `--stylize 100` — düşük stilize, ürün doğru gözüksün
- `--ar 220:130` — bizim kart oranı (yatay)
- `--no text, logo, watermark` — temiz görsel

---

## 2. ÜST SECTION — Rulo etiket (6 kart)

### Card 1: Özel kesim rulo (Die-cut roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core showing, navy outline,
two layered die-cut sticker silhouettes on right side in coral #FF6B5B
showing custom contour shape, organic blob silhouettes,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth, clean minimal --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-diecut.png` (2400×1418 retina veya 1200×709)

---

### Card 2: Şeffaf rulo (Clear roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core, navy outline,
two transparent glass-like sticker silhouettes on right side
with subtle blue tint and glass highlight reflection,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-clear.png`

---

### Card 3: Yuvarlak rulo (Circle roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core, navy outline,
two circular round sticker labels on right side in coral #FF6B5B,
stacked at slight angle, white highlight on top circle,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-circle.png`

---

### Card 4: Kare rulo (Square roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core, navy outline,
two square sticker labels on right side in coral #FF6B5B,
stacked with slight rotation 4-6 degrees, sharp corners,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-square.png`

---

### Card 5: Dikdörtgen rulo (Rectangle roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core, navy outline,
two horizontal rectangle sticker labels on right side in coral #FF6B5B,
stacked at slight angle, classic rectangular shape with sharp corners,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-rectangle.png`

---

### Card 6: Oval rulo (Oval roll)

```
isometric illustration of label printing roll on left side,
white cylinder roll with cream core, navy outline,
two oval ellipse sticker labels on right side in coral #FF6B5B,
stacked with slight overlap, smooth elliptical shape,
soft drop shadow, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/rulo-oval.png`

---

## 3. ALT SECTION — Tabaka etiket (5 kart)

### Card 7: Yuvarlak tabaka (Circle sheet labels)

```
isometric illustration of A4 paper sheet rotated 7 degrees,
white sheet with cream undertone, navy outline, stacked sheet shadow behind,
grid of 12 circular round stickers on sheet (3 columns 4 rows) in coral #FF6B5B,
each circle with navy outline, evenly spaced,
soft drop shadow under sheet, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/tabaka-circle.png`

---

### Card 8: Özel kesim tabaka (Die-cut sheet labels)

```
isometric illustration of A4 paper sheet rotated 7 degrees,
white sheet with cream undertone, navy outline, stacked sheet shadow behind,
grid of 6 die-cut blob silhouettes on sheet (2 columns 3 rows) in coral #FF6B5B,
each with navy outline, organic custom shapes,
soft drop shadow under sheet, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/tabaka-diecut.png`

---

### Card 9: Oval tabaka (Oval sheet labels)

```
isometric illustration of A4 paper sheet rotated 7 degrees,
white sheet with cream undertone, navy outline, stacked sheet shadow behind,
grid of 8 horizontal oval ellipse stickers on sheet (2 columns 4 rows) in coral #FF6B5B,
each with navy outline, smooth elliptical shape,
soft drop shadow under sheet, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/tabaka-oval.png`

---

### Card 10: Dikdörtgen tabaka (Rectangle sheet labels)

```
isometric illustration of A4 paper sheet rotated 7 degrees,
white sheet with cream undertone, navy outline, stacked sheet shadow behind,
grid of 8 horizontal rectangle stickers on sheet (2 columns 4 rows) in coral #FF6B5B,
each with navy outline, sharp corners, classic rectangular shape,
soft drop shadow under sheet, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/tabaka-rectangle.png`

---

### Card 11: Kare tabaka (Square sheet labels)

```
isometric illustration of A4 paper sheet rotated 7 degrees,
white sheet with cream undertone, navy outline, stacked sheet shadow behind,
grid of 9 square stickers on sheet (3 columns 3 rows) in coral #FF6B5B,
each with navy outline, sharp corners, perfectly equal sides,
soft drop shadow under sheet, white background, e-commerce product card,
flat 2D with subtle depth --ar 220:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/etiket-cards/tabaka-square.png`

---

## 4. Workflow — Sefa için adım adım

### Adım 1: Discord'da Midjourney'e bağlan
`midjourney.com` → Subscribe (Basic Plan $10/ay yeterli, 200 görsel/ay).

### Adım 2: İlk seed'i belirle
Card 1'i çalıştır → 4 varyant gelir → en beğendiğin V1/V2/V3/V4 ile **Upscale** yap. Sonuç PNG'nin metadata'sında `seed` yazıyor (`...seed 1234567890`). Bu seed'i kopyala.

### Adım 3: Sonraki 10 prompt'ta SAME seed kullan
Yukarıdaki tüm prompt'larda `--seed 12345`'i bulduğun seed ile değiştir. Bu tutarlılığı sağlar (aynı rulo, aynı kağıt, aynı renk).

### Adım 4: İndir + isimlendir
Her görseli sağdaki listede yazan **dosya ismiyle** indir. Discord'daki "Save Image As..." kullan.

### Adım 5: `public/etiket-cards/` klasörüne koy
```
public/etiket-cards/
  rulo-diecut.png
  rulo-clear.png
  rulo-circle.png
  rulo-square.png
  rulo-rectangle.png
  rulo-oval.png
  tabaka-circle.png
  tabaka-diecut.png
  tabaka-oval.png
  tabaka-rectangle.png
  tabaka-square.png
```

### Adım 6: Bana haber ver
"Midjourney görselleri hazır" de — ben `src/app/etiket/page.tsx`'te 11 satır `imageSrc` path'ini SVG → PNG'ye çeviririm. ~5 dk iş.

---

## 5. Kalite kontrol checklist

PNG indirmeden önce kontrol et:
- [ ] Renk tutarlı mı? Hepsinde aynı coral kırmızı (#FF6B5B civarı)?
- [ ] Beyaz background temiz mi? (transparent değilse OK ama gri/sarı tonlu olmasın)
- [ ] Rulo / kağıt boyutu benzer mi? (kart yan kart farklı boyutta gözükmesin)
- [ ] Aspect ratio 220:130? (Midjourney bazen 1:1 üretir, regenerate)
- [ ] Drop shadow var mı? Çok sert değil yumuşak mı?
- [ ] Text / logo / watermark VAR mı? Varsa regenerate

---

## 6. Alternatif tool'lar (Midjourney yerine)

| Tool | Fiyat | Avantaj |
|------|-------|---------|
| **Midjourney** | $10/ay | En tutarlı, en kaliteli |
| **Ideogram** | $0 (free tier) | Daha hızlı, text de doğru |
| **DALL-E 3** (ChatGPT) | $20/ay (Plus) | İyi quality, az seçenek |
| **Stable Diffusion** (local) | $0 | Self-hosted, sınırsız |
| **Adobe Firefly** | $0-15/ay | Adobe ürünleriyle entegre |

**Önerim:** Midjourney + Basic ($10) tek seferlik üretim için ideal. 200 görsel/ay alıyorsun, 11 kart × ~4 varyant = 44 görsel = yeterli + iterasyon.

---

## 7. İleride — sticker grid de aynı pattern

Sticker reform yapıldığında (Sefa onaylayınca) aynı rehber sticker için kullanılır. Tek değişiklik: prompt'larda "label" yerine "vinyl sticker" yaz, biraz daha canlı renk paleti istersen brand'a uygun.

Hazır olduğunda haber et — ben sticker-specific Midjourney rehberini de yazarım.
