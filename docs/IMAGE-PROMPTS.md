# Pim Etiket — Görsel Prompt Kitabı

Bu doküman, sitenin ihtiyaç duyduğu **35+ görseli AI image üreticilerinde**
(Midjourney, Imagen 3, DALL-E 3, Adobe Firefly, Nano Banana, Stable
Diffusion) üretmek için **kullanıma hazır prompt'lar** içerir.

Her prompt için:
- **Nereye gidiyor** (sitenin hangi sayfası/component'i)
- **Slot ID** (admin/site-images altında upload edilecek slot adı)
- **Pixel boyut** + aspect ratio
- **Türkçe brief** (ne istiyoruz tek cümle)
- **İngilizce ana prompt** (AI'lar İngilizce daha iyi anlar)
- **Stil + mood notları**
- **Negative prompt** (ne YOK)
- **Önerilen AI aracı** + parametreler
- **Brand uyumu** (Pim Etiket renkleriyle entegrasyon)

---

## 🎨 Brand kimliği — her prompt'a referans

**Marka adı:** Pim Etiket
**Slogan:** "Markanın etiketi, fikrinin sticker'ı"
**Tema:** AI destekli dijital baskı atölyesi, küçük markalar + bağımsız üreticiler için

**Renk paleti (HEX):**
- Pim Mercan: `#ff6b5b` (coral/salmon — ana vurgu)
- Lacivert: `#1F2A4D` (derin navy — text + güven)
- Krem: `#FFF5EE` (sıcak fildişi — arka plan)
- Yeşil: `#2bb673` (başarı, organik)
- Sarı koyu: `#7a560a` (uyarı, dikkat)

**Ton:**
- Sıcak, samimi, profesyonel — soğuk kurumsal değil
- "Sana özel emek" hissi — fabrika değil, atölye
- Modern + zanaatkârlık dengesi
- AI ile hızlı ama insan dokunuşu var

**Maskot:** "Pim" — yuvarlak, sevimli, etiket rulosu kafalı küçük karakter (mevcut SVG var, AI'da yeniden üretmiyoruz)

---

## 📐 Genel prompt eklemeleri (her hero/lifestyle görsele ekle)

Aşağıdaki blok hemen hemen her görselin sonuna eklenebilir:

```
soft natural lighting, warm cream and coral color palette (#FFF5EE background,
hints of #ff6b5b coral accents), photorealistic, 8k detail, magazine quality
photography, Turkish small-brand aesthetic, artisan craft feel,
minimal composition, plenty of negative space, no text on labels yet
```

**Negative prompt (genel):**
```
no people faces, no corporate stock photo cliche, no cold blue tones,
no harsh shadows, no fluorescent lighting, no overly saturated,
no Asian-style packaging, no cheap mockup, no cartoon style,
no busy background, no lens flare, no fake plastic shine
```

---

# 🥇 P0 — LANSMAN İÇİN ŞART (15 görsel)

---

## 1. HOME HERO

### Nerede
- `/` ana sayfa üst kısım
- Component: `<Hero>` veya `<HomeHero>` (storefront/src/app/page.tsx)
- Slot ID: `home_hero`

### Spec
- **Boyut:** 1920×1080 (16:9) — desktop full-bleed
- **Mobil crop:** orta-merkez kompozisyon (ekranın orta %60'ı önemli içerik)
- **Format:** WebP veya JPEG, 80-90 kalite
- **Max dosya:** 350 KB

### Brief
Pim Etiket atölyesinin "yaratıcı, sıcak, premium" hissini veren bir ürün/atmosfer kompozisyonu. Bir kreatif çalışma masası üzerinde farklı malzeme/şekilde etiket ve sticker örnekleri, sanki bir küçük marka sahibi yeni dosyalarını seçiyor gibi.

### Prompt (İngilizce ana)
```
A warm overhead flat-lay photograph of a creative artisan workspace,
featuring an assortment of premium printed labels and stickers spread on
a cream linen surface (#FFF5EE), including: a round white matte label
with subtle texture, a transparent foil-stamped sticker catching soft
light, a kraft brown rectangular product label, a holographic round
sticker reflecting subtle rainbow, and a small roll of die-cut stickers
in coral accent color (#ff6b5b). Include a designer's hand from the
top-right corner reaching toward one label, wearing a simple linen
sleeve. Soft morning window light from the upper left, warm shadows.
Style: editorial product photography, Kinfolk magazine aesthetic,
shallow depth of field, slightly desaturated film tone.
Photorealistic, 8k, sharp focus on labels, dreamy bokeh background.
```

### Negative
```
no harsh studio lighting, no logos or readable text on labels,
no Asian fonts, no cheap glossy plastic, no neon colors,
no faces or full bodies, no Adobe Stock cliche
```

### AI önerisi
- **Midjourney v6+**: `--ar 16:9 --style raw --stylize 250`
- **Imagen 3**: aspect_ratio=16:9, safety filter normal
- **Nano Banana**: high detail mode

### Brand uyumu
- Coral (#ff6b5b) **sadece bir-iki sticker'da accent** — dominant olmasın
- Cream background dominant — sayfanın krem temasına otururnur
- Lacivert tonlar yok — sıcak palette

---

## 2. OG DEFAULT (Open Graph paylaşım kartı)

### Nerede
- Sosyal medya link önizleme (WhatsApp, Twitter, LinkedIn, Slack, Discord)
- Slot ID: `og_default`
- Tüm sayfalar default kart (specifik OG yoksa)

### Spec
- **Boyut:** 1200×630 (1.91:1) — Open Graph standardı
- **Format:** PNG veya JPEG, 80 kalite
- **Max dosya:** 300 KB
- **Text safe area:** orta %60 (sosyal medya bazı yerlerde kenarları kırpar)

### Brief
Marka kartı — sol tarafta "Pim Etiket" logo + slogan, sağda bir ürün görseli (etiket rulosu veya sticker yığını). Cream arka plan, coral vurgu, minimalist.

### Prompt (İngilizce ana)
```
A horizontal social media share card composition, 1200x630, split layout.
LEFT half (40%): clean cream background (#FFF5EE) with empty space for
logo placement at top-left corner. CENTER-RIGHT (60%): a photorealistic
close-up of three premium printed labels — one round white matte with
embossed texture, one rectangular kraft brown, one transparent with
gold foil accent — arranged in a fan/cascade. Coral (#ff6b5b) thread
or ribbon weaving through them subtly. Soft top-left lighting, warm
shadows. Empty negative space on left for text overlay.
Magazine-quality product photography, minimal, elegant.
```

### Negative
```
no rendered text or letters on the image itself, no logos, no faces,
no busy background, no full bleed images (need text room),
no people, no models
```

### Post-processing (Figma/Canva ile sonra)
1. AI'dan üretilen görseli al
2. Figma/Canva'da aç → sol boşluğa:
   - "Pim Etiket" logo (mevcut SVG, 240×80)
   - Altına slogan: "Markanın etiketi, fikrinin sticker'ı" (Nunito 24px, lacivert)
3. Export PNG 1200×630

### AI önerisi
- **Midjourney**: `--ar 1200:630 --style raw`
- **Imagen 3** veya **Adobe Firefly** — text overlay için boşluk net

---

## 3. AUTH HERO (login/signup sayfası)

### Nerede
- `/auth` sayfası — sol/sağ kompozit kart
- Component: `AuthCard` (storefront/src/app/auth/page.tsx)
- Slot ID: `auth_hero`

### Spec
- **Boyut:** 800×900 (8:9, neredeyse kare ama hafif portre)
- **Mobil:** gizlenir (sadece form gösterilir)
- **Format:** WebP/JPEG, 75 kalite

### Brief
Sıcak, davetkar bir atölye köşesi. Bir kişi etiket dosyasına bakıyor (yarım profil, marka tanımlanmasın). Pencere ışığı yumuşak, masa üzerinde dosyalar + tablet/laptop, kahve fincanı, fokus küçük bir markanın paketleme anı.

### Prompt (İngilizce ana)
```
A warm intimate workspace scene, vertical composition (8:9 ratio).
A close-up over-the-shoulder view of a designer's hands holding a
printed label sample sheet, with a tablet showing label design software
in the background (blurred), a cream ceramic coffee cup, a coral-colored
fabric swatch on the wooden desk. Morning window light streaming from
the left, warm beige and coral tones dominant. Background slightly
out of focus, plants visible. Mood: peaceful, focused, craft-driven.
Style: warm film photography, Kinfolk/Cereal magazine aesthetic,
shallow depth of field f/2.0.
```

### Negative
```
no faces visible, no full bodies, no readable screen content,
no corporate office, no fluorescent lights, no cluttered desk,
no stock photo feel
```

### AI önerisi
- **Midjourney v6**: `--ar 8:9 --style raw --stylize 200`
- **Imagen 3**: kompozisyon kontrolü iyi

---

## 4. DEMO HERO (demo videosu thumbnail)

### Nerede
- `/demo` sayfası — videosu yoksa fallback görsel
- Component: `DemoHero` veya admin video player thumbnail
- Slot ID: `demo_hero`

### Spec
- **Boyut:** 1280×720 (16:9 — video standard)
- **Format:** JPEG, 85 kalite
- **Max dosya:** 250 KB

### Brief
Cesur ama davetkar — sanki video bir tıklamayla başlayacak. Pim maskotu (büyük, animasyon hissi) + ardında etiket atölyesi. Üst tarafta "▶ Demo izle" hissini destekleyen kompozisyon (text sonradan eklenir).

### Prompt (İngilizce ana)
```
A vibrant studio scene, 16:9 cinematic composition. Foreground: a small
rolling label dispenser machine actively printing a stack of colorful
labels in coral, cream, and gold. Mid-ground: a clean tablet screen
showing a label design (blurred). Background: out-of-focus shelving
with colorful sticker rolls. Soft directional lighting from top-right,
warm golden hour feel. The scene suggests motion and creativity.
Cinematic, film-grain texture, magazine product photography.
Negative space in the center for video play button overlay.
```

### Negative
```
no static lab, no industrial factory feel, no cold lighting,
no actual readable label designs (keep blurred), no people in frame
```

### AI önerisi
- **Imagen 3** veya **Midjourney v6**: `--ar 16:9 --style cinematic`

---

## 5. 404 / 500 ERROR PAGES

### Nerede
- `/404` ve `/500` Next.js error pages
- Component: `not-found.tsx`, `error.tsx`
- Slot ID: `error_image` (tek görsel iki sayfada kullanılır)

### Spec
- **Boyut:** 600×400 (3:2)
- **Format:** PNG (transparent background)
- **Max dosya:** 150 KB

### Brief
Hafifçe karışmış/üzgün bir etiket rulosu — yere düşmüş, hafif buruşuk. Pim maskotu (mevcut SVG kullan, ek üretme gerekli değil) yanında "Olur böyle şeyler" hissi veriyor.

### Prompt (İngilizce ana)
```
A whimsical illustration in flat vector style, transparent background,
showing a small label roll tipped over on its side, a few labels
loosely scattered around it, in cream and coral colors (#FFF5EE,
#ff6b5b). Soft minimalist line work, friendly cartoon style but not
childish. No background. Style: illustrated vector, similar to
Storyset.com aesthetics, warm and forgiving mood.
```

### Negative
```
no photo-realism, no dramatic broken/torn elements, no negative emotions,
no faces, no characters (we add Pim mascot SVG separately)
```

### AI önerisi
- **Adobe Firefly** (vector mode) veya **Midjourney** + Photoshop temizle
- **Alternatif:** unDraw.co'dan "broken" veya "error" araması — ücretsiz, brand rengiyle özelleştirilebilir

---

# 🛍️ ÜRÜN GALLERY MOCKUP'LARI (5 görsel)

> **Önemli not:** Bu görseller için **Placeit.net** ($15/ay) en pratik
> seçenek — kendi etiket dosyanı yükle, gerçek ürün üzerine otomatik bind
> eder. AI ile yapmak daha zor (etiket içeriği bir şişeye fotorealistik
> sarılması zor). Aşağıdaki prompt'lar AI yolunu kullanmak istersen.

---

## 6. ŞARAP ŞİŞESİ ETİKETİ MOCKUP

### Nerede
- `/etiket` ürün sayfası — örnekler galerisi
- `/galeri` use case showcase
- Admin/galeri'den `gallery_items` tablosuna upload

### Spec
- **Boyut:** 1200×1200 (1:1) — kare grid friendly
- **Format:** JPEG, 85 kalite

### Brief
Premium şarap şişesi (yeşil cam, bordo etiket — vintage hissi). Etiket boyutu yaklaşık 80×100mm, oval veya dikdörtgen. Etiket üzerine "MOCKUP" placeholder text (ileride kendi tasarımları yüklenir).

### Prompt (İngilizce ana)
```
Photorealistic close-up product photography, square composition 1:1.
A dark green wine bottle (Bordeaux style, no neck label, no foil cap)
standing upright on a rustic oak wooden surface, against a warm cream
linen draped background (#FFF5EE). The bottle features a premium oval
label, cream/ivory colored paper with subtle texture, with elegant
serif typography reading "VINEYARD ESTATE" (placeholder text), small
coral red accent (#ff6b5b) ornament. Soft side lighting from left,
warm shadows. Slight reflection on bottle glass.
Style: editorial wine magazine photography, premium artisan craft feel.
```

### Negative
```
no full readable wine brand names, no cliche wine labels,
no champagne, no harsh studio lights, no glossy plastic look,
no Asian-style packaging
```

### AI önerisi
- **Midjourney v6** `--ar 1:1 --style raw --stylize 300`
- Veya **Placeit** "wine bottle mockup" template (kendi placeholder etiketini yükle)

---

## 7. BAL KAVANOZU MOCKUP

### Nerede
- `/etiket` örnekler
- Gallery item: kategori "Gıda — Bal"

### Spec
- **Boyut:** 1200×1200 (1:1)
- **Format:** JPEG, 85 kalite

### Brief
Cam bal kavanozu (klasik altıgen veya yuvarlak), kraft kahverengi etiket + altın metalik accent. Doğal, organik, küçük üretici hissi.

### Prompt (İngilizce ana)
```
Photorealistic product photo, square format. A hexagonal glass honey
jar filled with rich amber honey, sitting on a rustic linen napkin
on a wooden farmhouse table. The jar has a round kraft brown paper
label (artisan-style) wrapped around the front, with subtle gold foil
ornaments and the placeholder text "PURE HONEY 250g". Beside the jar,
a wooden honey dipper resting on a small ceramic dish, a few wild
flowers (chamomile, lavender) softly out of focus. Warm afternoon
golden light, shallow depth of field.
Style: artisan food photography, slow-living aesthetic, similar to
Kinfolk magazine.
```

### Negative
```
no plastic squeeze bottle, no synthetic look, no factory aesthetic,
no bright white walls, no chrome surfaces, no readable specific brand
```

---

## 8. KOZMETİK KREM ŞİŞESİ MOCKUP

### Nerede
- `/etiket` örnekler
- Gallery item: "Kozmetik — Yüz bakım"

### Spec
- **Boyut:** 1200×1200 (1:1)

### Brief
Beyaz minimal pompalı şişe (50ml veya 100ml), mat etiket — küçük doğal kozmetik markası hissi. Ferah ama lüks.

### Prompt (İngilizce ana)
```
Photorealistic minimalist product photography, square 1:1 composition.
A frosted white glass cosmetic pump bottle (100ml, slim cylindrical
shape) standing on a smooth marble surface in soft pastel tones
(cream marble with subtle gray veins). The bottle features a
clean rectangular matte white paper label with minimalist
typography in lacivert navy (#1F2A4D), placeholder text:
"FACE SERUM 30ml". Tiny coral accent dot (#ff6b5b) on the label.
A single dried botanical sprig (eucalyptus) resting beside the bottle.
Bright airy daylight from upper right, soft natural shadows.
Style: premium clean beauty brand photography, Aesop/Glossier aesthetic.
```

### Negative
```
no bright neon colors, no busy floral patterns, no plastic bottle,
no medical/clinical sterile feel, no chrome metallic, no models
```

---

## 9. KAHVE PAKETİ STICKER MOCKUP

### Nerede
- `/sticker` örnekler
- Gallery item: "Specialty Coffee"

### Spec
- **Boyut:** 1200×1200 (1:1)

### Brief
Stand-up pouch kahve paketi (kraft kahverengi veya siyah mat), önünde yuvarlak büyük sticker — third-wave coffee tarzı.

### Prompt (İngilizce ana)
```
Photorealistic product photography, 1:1 square format. A matte black
stand-up pouch coffee bag (250g size) standing on a dark wooden
coffee shop counter. On the front of the pouch, a large round 80mm
sticker in cream color with a minimal coffee bean illustration and
placeholder text "SINGLE ORIGIN — ETHIOPIA". The sticker has a subtle
coral red border (#ff6b5b). Beside the bag, a few raw green coffee
beans scattered, a small ceramic espresso cup with steam, slight
out-of-focus. Warm directional lighting from window-left side,
moody coffee-shop atmosphere.
Style: specialty coffee brand photography, third-wave coffee aesthetic.
```

### Negative
```
no commercial coffee chain branding, no fluorescent lights,
no harsh white background, no cartoon coffee art
```

---

## 10. LAPTOP STICKER LIFESTYLE

### Nerede
- `/sticker` örnekler
- Gallery item: "Marka ürünü — Laptop sticker"

### Spec
- **Boyut:** 1200×800 (3:2) — landscape lifestyle

### Brief
Bir MacBook'un üst yüzeyinde 2-3 farklı şekilde marka sticker'ları (yuvarlak, die-cut özel şekil, küçük yıldız). Genç, kreatif, "freelancer / küçük marka" hissi.

### Prompt (İngilizce ana)
```
Photorealistic lifestyle photography, 3:2 horizontal composition.
A silver MacBook Pro (top cover view, slightly closed angle showing
the lid surface) sitting on a wooden cafe table. On the laptop lid,
3 small custom-cut stickers arranged playfully: a round coral
(#ff6b5b) sticker with cream center, a die-cut crescent moon sticker
in lacivert (#1F2A4D), and a small star-shaped holographic sticker
reflecting subtle rainbow light. Around the laptop: a half-empty
ceramic mug of latte (with latte art), a small green plant in a
terracotta pot, an open notebook with a pen. Warm afternoon natural
light from a window, soft shadows. Mood: creative freelancer cafe
working session.
Style: Apple lifestyle photography meets indie craft brand aesthetic.
```

### Negative
```
no obvious Apple logo (avoid trademark), no Windows laptop,
no full faces, no busy cafe background, no stock photo poses,
no oversaturated colors
```

---

# 🎨 MALZEME ÖRNEKLERİ (5 detay görseli)

> Bu görseller `/etiket` ve `/sticker` ürün sayfalarındaki malzeme
> seçiciye, ayrıca AdminPanel/site-images altında malzeme galerisine
> yerleşecek. Her biri belirli bir malzemenin **yakın çekim doku**
> görseli olmalı — kullanıcı dokunabilir hissi vermeli.

---

## 11. BEYAZ MAT ETİKET (paper matte)

### Nerede
- `/etiket` configurator → malzeme: "Mat Kağıt"
- Slot: `material_paper_matte`

### Spec
- **Boyut:** 800×800 (1:1)
- **Format:** JPEG, 85 kalite

### Prompt (İngilizce ana)
```
Extreme macro photography close-up of a premium uncoated matte paper
label, 800x800 square crop. The label is plain cream-white
(#FFF5EE-ish), slightly textured paper grain visible at high
resolution, with a soft gradient shadow on one corner suggesting
the label is lifted from a surface. Subtle paper fiber texture
visible. No print on the label — just the raw material. Soft top
lighting reveals texture depth without harsh shadows.
Style: material catalog photography, premium paper sample.
```

### Negative
```
no printed designs, no logos, no glossy finish, no reflections,
no fingerprints, no folds or wrinkles
```

---

## 12. ŞEFFAF ETİKET (transparent)

### Nerede
- `/etiket` configurator → "Şeffaf"
- Slot: `material_transparent`

### Spec
- **Boyut:** 800×800

### Prompt (İngilizce ana)
```
Macro product photography of a transparent vinyl label peeled
halfway off a clear glass surface, 1:1 composition. The label is
fully transparent (you can see through it to the glass beneath),
catching subtle highlights from soft side lighting that reveal its
edges and surface. Behind the glass: a soft blurred coral-cream
gradient background (#FFF5EE to #ff6b5b mist). The label appears
to "float" — clear, premium, no-label look. Edge detail visible.
Style: industrial materials catalog, premium quality showcase.
```

### Negative
```
no opaque labels, no white labels, no printed designs,
no fingerprints, no scratches, no chunky thick plastic feel
```

---

## 13. METALİZE GÜMÜŞ / ALTIN

### Nerede
- `/etiket` configurator → "Metalize Gümüş" ve "Metalize Altın" (iki ayrı görsel)
- Slot: `material_metallic_silver`, `material_metallic_gold`

### Spec
- **Boyut:** 800×800 (her biri ayrı)

### Prompt (İngilizce — gümüş)
```
Macro photography of a premium metallic silver foil label, 1:1 crop.
The label has a smooth mirror-like silver surface that reflects
warm cream light (#FFF5EE) softly, creating a subtle gradient from
bright silver to soft pewter. Slight ripple or fold on one edge
adds dimension. No printed design — pure foil material. Soft
diffused studio lighting reveals the metallic reflection without
harsh glare.
Style: luxury packaging materials catalog.
```

### Prompt (İngilizce — altın)
```
Macro photography of a premium metallic gold foil label, 1:1 crop.
The label has a smooth champagne-gold metallic surface reflecting
warm light, gradient from rich amber gold to pale champagne. Subtle
fold on one corner. No printed design. Soft warm directional lighting
to reveal metallic reflectivity.
Style: luxury cosmetic / premium foodbrand packaging reference.
```

### Negative
```
no rainbow holographic, no rough textures, no scratches,
no plastic look (must look like real metalized foil)
```

---

## 14. KRAFT KAHVERENGİ

### Nerede
- `/etiket` configurator → "Kraft"
- Slot: `material_kraft`

### Spec
- **Boyut:** 800×800

### Prompt (İngilizce)
```
Macro photography of a kraft brown paper label, 1:1 close-up.
Natural unbleached brown kraft paper with visible fiber texture,
slight irregularities in color creating organic warmth. The label
sits on a darker wood grain surface, edges slightly curled.
Warm side lighting reveals paper texture. No printed design,
pure material. Style: artisan craft brand photography, sustainability-
focused, eco-aesthetic.
```

### Negative
```
no glossy finish, no perfect smooth surface, no bright orange tone,
no fake-looking kraft (must look natural fiber)
```

---

## 15. HOLOGRAFİK STICKER

### Nerede
- `/sticker` configurator → "Holografik"
- Slot: `material_holographic`

### Spec
- **Boyut:** 800×800

### Prompt (İngilizce)
```
Macro photography of a holographic round sticker, 1:1 close-up.
The sticker has a shifting rainbow iridescent surface that catches
light to reveal subtle color play — soft pinks, purples, blues,
greens shifting across the surface. The sticker is placed on a
matte black surface for contrast. Soft directional light from
top reveals the holographic shift. No printed design on top,
pure holographic material. Edge slightly raised.
Style: premium product material catalog, music album cover
sticker aesthetic.
```

### Negative
```
no harsh neon, no glitter (different effect), no flat rainbow gradient,
no plastic toy look, no childish design
```

---

# 🟡 P1 — UX İYİLEŞTİREN (10 görsel)

---

## 16-19. EMPTY STATES (4 illüstrasyon)

### Nerede
- `/sepet` boş sepet
- `/siparislerim` boş siparişler
- `/iadelerim` boş iadeler
- `/bildirimler` boş bildirimler

### Spec (her biri)
- **Boyut:** 500×400 (5:4)
- **Format:** SVG (vector) veya PNG transparent
- **Stil:** Birbirine uyumlu set — aynı çizim tarzında 4 farklı sahne

### Genel stil prompt (tüm 4 için)
```
Flat vector illustration, friendly minimal line work, warm
two-color palette: coral (#ff6b5b) primary, cream (#FFF5EE)
secondary, lacivert (#1F2A4D) outline accents. Hand-drawn feel
but clean. Style similar to Storyset.com or unDraw.co, but
warmer and slightly more crafty. Transparent background.
```

### 16. Boş sepet
```
[Genel stil + ] A minimal illustration of an empty paper shopping
bag standing upright, slightly tilted, with a single coral
heart icon floating above suggesting "add something here".
No text. Subtle motion lines suggesting it's waiting.
```

### 17. Boş siparişler
```
[Genel stil + ] A minimal illustration of a small empty wooden
package box with its flaps open, a single coral ribbon laid
nearby. Suggests "your first order goes here".
```

### 18. Boş iadeler
```
[Genel stil + ] A minimal illustration of a checkmark inside
a cream circle, with confetti-like coral dots scattered around.
Suggests "you have no returns — all good!".
```

### 19. Boş bildirimler
```
[Genel stil + ] A minimal illustration of a small bell icon
with a "z-z-z" sleep motif (or quiet wave lines), in coral
and cream colors. Suggests peaceful silence.
```

### AI önerisi
- **Adobe Firefly** (vector mode)
- **Recraft.ai** (vector specialty)
- **Alternatif:** unDraw.co'dan "empty" araması yap, brand rengini #ff6b5b yap, ücretsiz indir

---

## 20. HAKKIMIZDA — SEFA PORTRESİ

### Nerede
- `/hakkimizda` sayfası kurucu bölümü
- Slot: `about_founder`

### Spec
- **Boyut:** 600×800 (3:4 portre)
- **Format:** JPEG, 85 kalite

### Brief
**AI üretmiyoruz** — Sefa'nın **gerçek fotoğrafı** lazım. Yüksek kaliteli, sıcak ışıkta, atölye/ofis ortamında.

### Çekim talimatı (Sefa için)
- Doğal pencere ışığı (sabah veya öğleden sonra geç saatler)
- Arka plan sade — duvar, raf, atölye köşesi (kreatif bir alan)
- Sefa pozu: kameraya doğrudan değil, hafif yan dönmüş, samimi gülüş ya da düşünceli/odaklı bakış
- Üst: smart-casual (gömlek + jean, tişört + ceket OK — takım YASAK)
- Eller: etiket rulosu tutuyor olabilir, ya da dosyalara bakıyor
- Renk tonu: sıcak, krem ışık (çok mavi/soğuk değil)

### Alternatif: profesyonel foto stüdyosu (200-500 ₺ tek seans)
- Ankara/Çankaya'da: "Brand portrait" arayan portföy fotoğrafçıları
- Atölyede on-site çekim 1-1.5 saat yeterli, 5-10 farklı çekim al

### Post-processing (Lightroom/Snapseed)
- Highlights -10, shadows +15, warmth +5 (sıcak ton)
- Saturation 100% kalın — fazla cool olmasın
- 600×800'e crop (yüz üst %40'ta merkezleme)

---

## 21. AI DOSYA KONTROL İLLÜSTRASYONU

### Nerede
- `/sticker` ve `/etiket` ürün sayfası — "AI dosya kontrol" özelliği bölümü
- Slot: `feature_ai_check`

### Spec
- **Boyut:** 800×600 (4:3)
- **Format:** PNG transparent veya WebP

### Brief
"AI dosyanı kontrol ediyor" hissini veren bir illüstrasyon. Bir dosya/PDF + dijital scanner ışını + onay tikleri (DPI ✓, CMYK ✓, Bleed ✓ gibi).

### Prompt (İngilizce)
```
Flat vector illustration, 4:3 composition. Center: a stylized
PDF document icon (cream colored, lacivert outline) with a soft
coral scanning beam passing over it. Around the document: 3 small
floating checkmark badges in green (#2bb673) labeled with abstract
symbols (DPI, color, bleed — but as icons, not text). Background:
clean cream (#FFF5EE) with subtle dot grid. Mood: tech meets
craft, friendly AI helper aesthetic.
Style: similar to Linear.app or Stripe illustration aesthetic,
modern flat vector, no gradients except subtle.
```

### Negative
```
no realistic photography, no robotic/cold tech feel, no harsh blues,
no faces, no terminal/code screens
```

### AI önerisi
- **Adobe Firefly** vector mode
- **Figma + manuel ikon kombine** (Lucide icons + Figma vector)

---

## 22. FASON ÜRETİM AKIŞ DİYAGRAMI

### Nerede
- "/nasil-calisir" sayfası — 4 aşama infografik
- Slot: `process_diagram`

### Spec
- **Boyut:** 1200×400 (3:1 horizontal infografik)
- **Format:** SVG veya PNG

### Brief
4 aşamayı yatay gösteren minimal infografik:
1. **Tasarımı yükle** — dosya yükleme ikonu
2. **AI kontrol** — büyüteç + check
3. **Atölye üretir** — matbaa makinesi
4. **Kapına gelir** — kargo kutusu + ev

Aşamalar arasında ok veya çizgi bağlantı.

### Prompt (İngilizce)
```
A horizontal infographic illustration, 3:1 aspect ratio, showing
4 stages in a print production flow. Stage 1 (left): a stylized
file upload icon with a coral upward arrow. Stage 2: a magnifying
glass with a checkmark inside (representing AI quality check).
Stage 3: a small printer/press machine with paper coming out.
Stage 4 (right): a delivery box with a house icon. Each stage
connected by a thin coral curved arrow line. Background: cream
(#FFF5EE) with subtle texture. Color palette: lacivert outlines,
coral accents, cream background, green checkmarks.
Style: minimalist flat vector infographic, Stripe/Linear aesthetic.
```

---

## 23. KARGO & TESLİMAT İLLÜSTRASYONU

### Nerede
- `/etiket` ve `/sticker` ürün sayfası — "5-7 iş günü" sektörü
- `/iade-degisim-politikasi` üst hero
- Slot: `feature_shipping`

### Spec
- **Boyut:** 600×400

### Prompt (İngilizce)
```
Flat vector illustration, 3:2 composition. A cute brown cardboard
package box with a kraft label on top (showing "Pim Etiket"
placeholder — generic delivery sticker), being carried by a small
abstract delivery courier figure (stylized, no specific face) in
coral uniform. Background: cream with subtle road dashes and a
clock icon in upper corner suggesting time. Mood: friendly,
on-time, reliable. Style: warm illustrated branding,
unDraw.co aesthetic.
```

---

## 24. BLOG DEFAULT KAPAK

### Nerede
- Blog yazısı görseli olmayanlar için fallback
- Slot: `blog_default_cover`

### Spec
- **Boyut:** 1200×630 (Open Graph + blog kapak)

### Prompt (İngilizce)
```
A minimalist editorial header image, 1200x630 composition. A flat
overhead view of an open paper notebook with a fountain pen lying
beside it, a coffee cup ring stain on the corner, a small coral
post-it note with handwritten doodles. Cream linen background.
Warm sunlight from upper-left. No readable text on the notebook.
Style: editorial blog header, Medium.com style, magazine feel.
```

---

## 25. GALERİ BAŞLIK KAPAĞI

### Nerede
- `/galeri` sayfası top hero
- Slot: `gallery_header`

### Spec
- **Boyut:** 1920×600 (wide horizontal banner)

### Prompt (İngilizce)
```
A wide horizontal hero banner, 32:10 aspect ratio. A photographic
grid arrangement of 9-12 different printed labels and stickers
laid out on a soft cream linen background. Each label is different:
some round, some rectangular, some die-cut shapes. Color variety:
cream, coral, kraft brown, gold foil, holographic, transparent.
Slightly tilted top-down view. Warm natural lighting. Composition
gives sense of variety and craftsmanship.
Style: editorial product flat-lay, Architectural Digest aesthetic.
```

---

# 🔵 P2 — SOSYAL MEDYA & İÇERİK (Sonraki faz)

## 26. INSTAGRAM PROFIL FOTOSU

### Spec
- **Boyut:** 320×320 (1:1)
- Marka logo veya maskot kapak versiyonu — Canva'da yapılır, AI değil

---

## 27-31. INSTAGRAM POST TEMPLATE'LERİ (5)

### Spec
- **Boyut:** 1080×1080 (1:1)
- **Üretim:** Canva Pro brand kit + AI hero görselleri kombine

### Konu önerileri
1. "Bu hafta öne çıkan etiket" — ürün showcase
2. "Müşteri hikayesi" — küçük marka projesi
3. "Şablon paylaşımı" — ücretsiz şablon
4. "Etiket bilgi kartı" — eğitim (TGK m.5, beslenme tablosu)
5. "Atölyeden" — behind the scenes

---

## 32-34. INSTAGRAM STORY TEMPLATE'LERİ

### Spec
- **Boyut:** 1080×1920 (9:16)
- **Üretim:** Canva Pro template'leri kullan

---

## 35. LINKEDIN ŞİRKET SAYFASI KAPAK

### Spec
- **Boyut:** 1128×191 (5.9:1)
- **Brief:** kurumsal ama sıcak — bir kreatif atölye uzun banner

### Prompt (İngilizce)
```
A wide cinematic banner, 5.9:1 aspect ratio. A panoramic view of a
modern artisan label printing studio: long wooden desk with
multiple label samples spread out, a designer's workspace with
tablet and pencils, soft natural light from large windows, plants,
warm cream and coral palette dominating. Wide aspect emphasizes
horizontal flow. No people visible.
Style: corporate/branding hero banner, Linear.app feel meets
artisan craft.
```

---

# 🛠️ ÜRETİM AKIŞI ÖNERİSİ

## Önce yap (Hafta 1 — 3-5 saat)

### Hızlı kazanım: 4 mockup + 5 malzeme (9 görsel)

**Adım 1 — Placeit hesabı aç (15 dk)**
- placeit.net → $15/ay (1 ay yeter)
- 4 mockup template seç: wine bottle, honey jar, cosmetic bottle, coffee bag
- Her birinde placeholder etiket dosyasını yükle (Sefa A4'te taslak etiket çizebilir)
- 4 görsel JPEG indir (1200×1200)

**Adım 2 — Sefa kendisi telefonla 5 malzeme detayı çek (1 saat)**
- Matbaa ortağına git, her malzemeden 5×5cm örnek al
- A4 beyaz fon kağıdı üzerine yumuşak yan ışıkta çek
- Snapseed (ücretsiz) ile: crop 1:1, exposure +5, warmth +3
- 5 JPEG export (800×800)

**Adım 3 — AI hero (2-3 görsel)**
- Midjourney trial ($10) veya Imagen free tier
- Yukarıdaki prompt'larla home_hero, og_default, auth_hero üret
- Her biri için 4 varyasyon iste, en iyiyi seç

**Adım 4 — Empty states (4 görsel)**
- unDraw.co → "empty cart", "empty box", "checkmark", "bell"
- Brand color: `#ff6b5b` → ücretsiz SVG indir
- veya Storyset.com'dan benzer set

**Toplam Hafta 1: 14 görsel, ~3-5 saat aktif çalışma**

## Sonra yap (Hafta 2 — UX seti)

- Sefa portresi (fotoğraf stüdyo veya iyi öz-çekim)
- 4-5 illüstrasyon (AI dosya kontrol, fason akışı, kargo)
- Blog default kapak
- Galeri başlık kapağı

## Sürekli (devamı — Hafta 3+)

- Sosyal medya post template'leri Canva Pro brand kit ile
- Her sektörde yeni use case mockup eklendikçe galeri büyür
- Blog yazısı kapakları her makale için ayrı (Midjourney ile)

---

# 📋 SİTE ENTEGRASYONu — admin panelden upload

Tüm bu görseller hazır olduğunda **admin/site-images** sayfasından
slot bazlı upload edilir. Her görsel için:

1. `/admin/site-images` sayfasına git
2. Slot'u bul (örn: `home_hero`)
3. Görseli sürükle bırak
4. Alt text gir (SEO + accessibility)
5. Save
6. Site otomatik 60 saniyede yansıtır

`gallery_items` use case mockup'ları için:
1. `/admin/galeri` sayfası
2. Yeni öğe → kategori seç (gıda/kozmetik/sticker/etiket)
3. Görseli yükle + başlık + açıklama
4. Yayınla

---

# 🎨 BRAND TUTARLILIK CHECKLIST

Her görsel için son kontrol:

- [ ] Renk paleti uyumlu mu? (mercan + krem + lacivert + yeşil)
- [ ] Mood sıcak mı? (krem ışık, kurumsal değil)
- [ ] Çözünürlük yeterli mi? (retina için 2× boyut)
- [ ] Dosya boyutu optimize mi? (TinyPNG, Squoosh.app ile)
- [ ] Alt text yazıldı mı? (SEO + a11y)
- [ ] Mobil önizleme test edildi mi?
- [ ] Brand kit'e eklendi mi? (Canva/Figma brand library)

---

# 💡 BONUS — ileride lazım olabilecek diğer görseller

- **Blog yazıları için kapaklar** (her makale için ayrı)
- **Şablon paketi thumbnail'leri** (60+ şablon, her birine 1 mini görsel)
- **Sosyal medya story serisi** (eğitim içeriği — TGK, KVKK, mevzuat)
- **Mail template header görselleri** (Resend mail'lerinde üst banner)
- **Pop-up banner görselleri** (cookie consent, KVKK welcome)
- **Mobil splash screen** (PWA için 1242×2688 iOS, 1080×1920 Android)
- **Apple touch icon set** (180×180, 152×152, vb — 6 boyut)
- **Favicon set** (16, 32, 48, 192, 512px — generator kullan)

---

# 🤖 AI ARAÇLARI KARŞILAŞTIRMA TABLOSU

| Araç | Fiyat | En iyi olduğu | Zayıf yön |
|------|-------|---------------|-----------|
| **Midjourney v6** | $10/ay | Hero, lifestyle, artistic | Text rendering kötü, ürün doğruluğu orta |
| **Imagen 3** | Free tier + paid | Photorealism, ürün doğruluğu | Aspect ratio kısıtlı, prompt kısa olmalı |
| **DALL-E 3** | ChatGPT Plus $20/ay | Geniş anlama, fast iteration | Tutarlılık zayıf, brand consistency yok |
| **Adobe Firefly** | Free + Creative Cloud | Vector, illustrasyon, commercial-safe | Photo kalitesi orta |
| **Nano Banana** | Free + paid | Yeni jen, gerçekçi | Hâlâ beta |
| **Placeit** | $15/ay | Mockup (gerçek ürün üzerine etiket) | AI değil, template-based |
| **Stable Diffusion** | Free (local) | Maximum control, free | Kurulum zor, GPU gerekli |
| **Recraft.ai** | $12/ay | Vector + stil tutarlılığı | Photorealism orta |
| **unDraw / Storyset** | Free | Illüstrasyon, empty state | Stil kısıtlı |
| **Canva Pro** | $13/ay | Sosyal medya, template-based | AI bütünleşik ama orta kalite |

---

# 📝 PROMPT İYİLEŞTİRME TÜYOLARI

1. **Aspect ratio her zaman belirt** — `--ar 16:9`, `--ar 1:1` (Midjourney) veya `aspect_ratio: 16:9` (Imagen)
2. **"Photorealistic" vs "Illustration" net ayır** — karışırsa fotoğraf değil çizim çıkar
3. **Lighting cümlesi ekle** — "soft natural lighting", "golden hour", "studio softbox"
4. **Brand renk hex'i prompt'ta yaz** — `coral accent (#ff6b5b)` AI direkt anlar
5. **Negative prompt mutlaka kullan** — istenmeyen şeyleri yaz, kaliteyi 2x artırır
6. **4 varyasyon iste, sonra upscale** — Midjourney'de `U2` `U3` ile en iyiyi büyüt
7. **Brand consistency için "seed" tekrar kullan** — aynı atmosfer yakalanır
8. **Çıktıyı `tinypng.com` ile sıkıştır** — 350 KB altına indir
9. **WebP'e çevir** — `squoosh.app` ile JPEG → WebP, %30 daha hafif

---

*Bu doküman güncelleneceği zaman commit at: `docs: image-prompts.md güncellendi (Hero görseli optimize)`*
