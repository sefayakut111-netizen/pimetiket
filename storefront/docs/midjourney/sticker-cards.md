# Pim Etiket — /sticker Grid Kart Görselleri için Midjourney Rehberi

**Hedef:** 11 sticker kartı için tutarlı, brand-uyumlu premium illüstrasyon.

**Mevcut durum:** Inline basit SVG silüetleri (geçici çözüm). Bu rehber Midjourney ile **premium PNG mockup** üretmek için.

**Sefa için:** Aşağıdaki 11 prompt'u sırayla Midjourney'e gönder. Aynı `--seed` ile tutarlılık. Sonuçları `public/sticker-cards/` altına PNG olarak koy, ben kart `svg` field'ını `<Image src={...} />`'ye çeviririm.

---

## 1. Brand Stil Rehberi (Style Reference)

Tüm 11 prompt'a EKLE — değişmesin, tutarlılık için:

```
isometric vector illustration, e-commerce product card, vinyl sticker,
brand color #FF6B5B coral red, secondary cream #F4F1E6, navy outline #1F1B2D,
flat 2D style with subtle 3D depth, soft drop shadow, clean minimal,
white background, centered composition, no text, no logo, no watermark,
200×130 aspect ratio horizontal, product mockup
--ar 200:130 --style raw --stylize 100 --v 6
```

### Tutarlılık parametreleri:
- `--seed 12345` (ilk üretimde rastgele seed → 10 prompt aynı seed)
- `--style raw` — fazla artistic decoration olmasın
- `--stylize 100` — düşük stilize
- `--ar 200:130` — kart oranı
- `--no text, logo, watermark`

---

## 2. ÜST SECTION — Tekil sticker (10 kart)

### Card 1: Özel kesim (Die cut)

```
isometric illustration of die-cut vinyl sticker with custom contour cut,
organic blob silhouette in coral #FF6B5B with navy outline,
white dashed cut line border, soft drop shadow,
white background, e-commerce product card, flat 2D with subtle depth
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/diecut.png`

---

### Card 2: Yuvarlak (Circle)

```
isometric illustration of two circular vinyl stickers stacked at angle,
front circle in coral #FF6B5B with navy outline, back circle slightly smaller
in light coral, white highlight reflection, soft drop shadow,
white background, e-commerce product card
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/circle.png`

---

### Card 3: Dikdörtgen (Rectangle)

```
isometric illustration of two horizontal rectangle vinyl stickers stacked
at slight angle, front sticker in coral #FF6B5B with navy outline,
back sticker offset behind in light coral, sharp corners,
soft drop shadow, white background, e-commerce product card
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/rectangle.png`

---

### Card 4: Kare (Square)

```
isometric illustration of two square vinyl stickers stacked at slight rotation,
front sticker in coral #FF6B5B with navy outline, back sticker offset behind,
sharp corners, soft drop shadow, white background, e-commerce product card
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/square.png`

---

### Card 5: Oval

```
isometric illustration of two oval ellipse vinyl stickers stacked at slight angle,
front oval in coral #FF6B5B with navy outline, back oval offset behind,
smooth elliptical shape, soft drop shadow, white background
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/oval.png`

---

### Card 6: Bumper (Tampon)

```
isometric illustration of two long horizontal bumper stickers stacked,
elongated pill shape in coral #FF6B5B with rounded corners and navy outline,
car bumper sticker style, white highlight stripe on top sticker,
soft drop shadow, white background, e-commerce product card
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/bumper.png`

---

### Card 7: Kiss cut (Yarı kesim)

```
isometric illustration of kiss-cut sticker — vinyl die-cut shape on intact
white backing paper, sticker in coral #FF6B5B with navy outline, the backing
paper extends beyond sticker edge, dashed cut line visible only on sticker
(not backing), soft drop shadow, white background
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/kisscut.png`

---

### Card 8: Şeffaf (Clear)

```
isometric illustration of transparent clear vinyl sticker, glass-like with
subtle blue tint and reflective highlight, navy outline showing through,
organic blob shape, soft drop shadow, white background
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/clear.png`

---

### Card 9: Holografik (Holographic)

```
isometric illustration of holographic rainbow vinyl sticker, prismatic
color shift from pink to purple to cyan to green to yellow, navy outline,
organic blob shape, glossy reflective surface, soft drop shadow,
white background, premium iridescent finish
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/holo.png`

---

### Card 10: Simli (Glitter)

```
isometric illustration of glitter sparkle vinyl sticker in coral #FF6B5B
with white sparkle dots scattered across surface, metallic glittery texture,
navy outline, organic blob shape, premium shimmer effect,
soft drop shadow, white background
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/simli.png`

---

## 3. ALT SECTION — Sticker tabaka (1 kart)

### Card 11: Sticker tabaka (Sticker sheets)

```
isometric illustration of A4 paper sheet rotated 6 degrees with mixed sticker
shapes arranged on it, white sheet with navy outline, stacked sheet shadow
behind, mix of circles, squares, rectangles, and ovals in coral #FF6B5B
each with navy outline, soft drop shadow under sheet, white background
--ar 200:130 --style raw --stylize 100 --seed 12345 --v 6
```

**Dosya:** `public/sticker-cards/sheets.png`

---

## 4. Workflow — Sefa için adım adım

### Adım 1: Etiket için Midjourney plan'da kalan workflow'u takip et
Aynı süreç (`docs/MIDJOURNEY-ETIKET-CARDS.md` — Subscribe → Generate → Upscale → Seed kopyala → 10 prompt'ta aynı seed).

### Adım 2: Bu sefer 200:130 oran kullan (etiket 220:130 idi)
Sticker kartları biraz daha kare. Etiket'le aynı görsel dilde ama sticker formuna uygun.

### Adım 3: İndir + isimlendir + `public/sticker-cards/` klasörüne koy
```
public/sticker-cards/
  diecut.png
  circle.png
  rectangle.png
  square.png
  oval.png
  bumper.png
  kisscut.png
  clear.png
  holo.png
  simli.png
  sheets.png
```

### Adım 4: Bana haber ver
"Sticker Midjourney görselleri hazır" de — ben `src/app/sticker/page.tsx`'te kart `svg` field'larını `<Image>` ile değiştireyim. ~5 dk iş.

---

## 5. Kalite kontrol checklist

PNG indirmeden önce kontrol et:
- [ ] Coral kırmızı tutarlı mı? (#FF6B5B civarı)
- [ ] Beyaz background temiz mi?
- [ ] Sticker boyutu kart için uygun mu (çok büyük/küçük olmasın)?
- [ ] Aspect ratio 200:130?
- [ ] Drop shadow yumuşak mı?
- [ ] Text / logo / watermark VAR mı? Regenerate
- [ ] Holographic kart gerçekten gökkuşağı yansımalı mı?
- [ ] Glitter kart parıltılı mı (sadece dolu kırmızı değil)?
- [ ] Kiss cut'ta backing paper sticker'dan daha büyük mü (gerçek kiss-cut detayı)?
- [ ] Bumper uzun-yatay pill şeklinde mi?

---

## 6. Kart-spesifik notlar

**Holographic + Glitter — Midjourney'in zor olduğu yerler:**
Bu iki materyal Midjourney V6'da bazen sade düz renk olarak gelir. Holografik için "rainbow prismatic" + "iridescent" + "color shift" terimleri kullan. Glitter için "metallic sparkle texture" + "shimmer" + "dotted highlights" terimleri kullan.

**Kiss cut farkı:**
Standart die-cut'ta sadece sticker var; kiss-cut'ta sticker + sticker'dan daha büyük beyaz backing paper var. Prompt'ta "intact white backing paper extends beyond sticker edge" denemesi gerekli.

**Bumper:**
StickerMule'da bumper'da "bumper" yazısı var. Bizde "no text" diyoruz çünkü kart genel ürün gösterimi. Sticker boş ama uzun-yatay pill şekli yeter.

---

## 7. Sticker reform sonrası akış

Görseller hazır olduğunda code tarafı geçiş:

```typescript
// Önce (şu an inline SVG):
{
  query: "cut=diecut&shape=diecut",
  titleTr: "Özel kesim",
  ...
  svg: <DieCutIcon />,
}

// Sonra (Midjourney PNG):
{
  query: "cut=diecut&shape=diecut",
  titleTr: "Özel kesim",
  ...
  imageSrc: "/sticker-cards/diecut.png",  // ← yeni alan
}
```

`ProductCard` component'i de `<img src={card.imageSrc}>` ile render eder (etiket pattern).
