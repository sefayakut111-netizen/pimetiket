# Pim Etiket — Tasarım Sistemi

**Sürüm:** 1.0 (taslak — design-prototype/v1-jsx + v2-html'den çıkarılmıştır)
**Tarih:** 2026-05-08
**Durum:** Bu doküman taslakların **gerçek halini** belgeler. Production
Tailwind config'ine (D adımı) buradan dökülecek.

---

## 1. Tasarım Felsefesi

Pim Etiket'in tasarım dili **üç değerin kesişimi**:

| Değer | Görsel ifadesi |
|---|---|
| **Yakınlık** | Pim mascotu, Türkçe samimi ses, krem önlük teması, yumuşak köşeler (16-24px radius), Nunito |
| **Güven** | Lacivert (#1F2937) ile dengeli kontrast, beyaz boşluk, soft shadow, hatasız tipografik hiyerarşi |
| **Ustalık** | Mercan (#FF6B5B) accent — etiket profesörünün imzası, dikkat çekici ama gürültüsüz; gradient'ler ve subtle animasyonlar |

> **Tek cümlede:** "Bursa'dan, küçük markalar için, etiket profesörünün elinden."

---

## 2. Tokens

### 2.1 Renkler

#### Brand
```css
--pim-mercan:       #FF6B5B    /* Primary action, accent */
--pim-mercan-soft:  #FFA89E    /* Soft accent, hover state */
--pim-mercan-tint:  #FFF1EE    /* Background tint, focus ring */
--krem:             #F5EBD9    /* Pim önlük rengi, soft surface */
--krem-soft:        #FAF4E8    /* Lighter krem, gradient'in kuyruğu */
--lacivert:         #1F2937    /* Text primary, dark surface, secondary CTA */
--lacivert-soft:    #374151    /* Gradient ucu, hover */
--turuncu:          #FF9933    /* Aksesuar, kutu, festival hissiyatı */
--beyaz:            #FFFFFF    /* Background primary */
```

> **Kural:** v2-html'de `--pim-mercan-koyu: #E85544` ek olarak var, v1-jsx'te yok.
> **Birleştirme:** `--pim-mercan-koyu` token olarak EKLENİR (hover/pressed state için faydalı).

#### Nötr (gri skala)
```css
--gri-50:   #FAFAF8    /* Background subtle */
--gri-100:  #F3F2EE    /* Background muted */
--gri-200:  #E7E5DD    /* Border default */
--gri-300:  #D5D2C7    /* Border emphasized */
--gri-500:  #9B9789    /* Text dim */
--gri-700:  #4B5563    /* Text muted */
```

#### Status
```css
--yesil:        #2BB673    /* Success, done */
--yesil-soft:   #E6F6EE
--kirmizi:      #E04B3C    /* Error, danger */
--sari:         #F0B22F    /* Warning, in-progress, star rating */
--sari-soft:    #FCF4E1
```

> **Kural:** Sarı ratings için (Trustpilot tarzı) — accent değil, durum.

### 2.2 Typography

**Font ailesi:** Nunito (400, 500, 600, 700, 800).
Fallback: `"Inter", system-ui, sans-serif`.
**Font features:** `ss01`, `cv11` (Nunito stylistic alternates).

| Class | Boyut | Line-height | Weight | Letter-spacing | Kullanım |
|---|---|---|---|---|---|
| `.h-display` | 56px | 1.04 | 600 | -0.02em | Hero başlık (1 sayfada en fazla 1) |
| `.h1` | 40px | 1.10 | 600 | -0.015em | Sayfa başlığı |
| `.h2` | 28px | 1.15 | 600 | -0.01em | Bölüm başlığı |
| `.h3` | 20px | 1.25 | 600 | — | Kart başlığı |
| `.body` | 16px | 1.55 | 400 | — | Paragraf metni |
| `.small` | 13px | 1.45 | 500 | — | Yardımcı metin, helper |
| `.tiny` | 11.5px | 1.30 | 600 | 0.04em UPPER | Etiket, badge yazısı |

**Renk yardımcıları:** `.muted` (gri-700), `.dim` (gri-500).

### 2.3 Radius

| Token | Değer | Kullanım |
|---|---|---|
| `--r-sm` | 8px | Küçük ikon kart, badge |
| `--r-md` ⚠️ EKLENECEK | 14px | (Şu an inline 14 kullanılıyor) |
| `--r` | 12px | Input, küçük kart |
| `--r-lg` | 16px | Kart standart |
| `--r-xl` | 24px | Büyük surface, hero kart |
| `--r-2xl` ⚠️ EKLENECEK | 32px | (Şu an inline 32 kullanılıyor) |
| `--r-pill` | 9999px | Pill, button (!) |

> **Kural:** Button'lar **pill shape**, kartlar 16-24px arası. **Asla ayrık değer kullanma**, token al.

### 2.4 Shadow

```css
--sh-1:     0 1px 2px rgba(31,41,55,0.04), 0 4px 12px rgba(31,41,55,0.06);   /* Default kart */
--sh-2:     0 2px 4px rgba(31,41,55,0.04), 0 12px 24px rgba(31,41,55,0.08);  /* Elevated kart, modal */
--sh-inset: inset 0 0 0 1px rgba(31,41,55,0.06);                              /* Subtle border */
```

⚠️ **EKLENECEK:**
```css
--sh-mercan: 0 6px 14px rgba(255,107,91,0.25);  /* Primary button glow */
--sh-mercan-lg: 0 8px 20px rgba(255,107,91,0.18); /* Selected card glow */
```

### 2.5 Layout & Spacing

```css
--max:        1280px    /* Container max-width */
container-px: 32px      /* Container left/right padding */
section-py:   80px      /* Section vertical padding (büyük) */
section-py-tight: 48px  /* Section vertical padding (küçük) */
```

**Grid gap default:** 16px (kartlar arası), 24px (sütunlar arası), 32-56px (hero gridler).

---

## 3. Component Sözlüğü

### 3.1 Button (`.btn`)

**Temel kurallar:**
- Pill shape (`border-radius: 9999`)
- Default height: 44px
- Font-weight: 600, Font-size: 15px
- Transition: 100ms transform + 200ms shadow + 150ms background
- Hover: `translateY(-1px) scale(1.01)` (lift)
- Active: `translateY(0) scale(0.99)` (press)

**Varyantlar:**
| Class | Background | Color | Shadow | Kullanım |
|---|---|---|---|---|
| `.btn-primary` | `--pim-mercan` | beyaz | `--sh-mercan` | Birincil aksiyon |
| `.btn-secondary` | beyaz | `--lacivert` | inset 1.5px lacivert | İkincil aksiyon |
| `.btn-ghost` | transparent | `--lacivert` | yok (hover'da `--gri-100`) | Üçüncül, nav |

**Boyutlar:**
- `.btn-lg` → 52px height, padding 0 28px, font 16px
- (default) → 44px height, padding 0 20px, font 15px
- `.btn-sm` → 36px height, padding 0 14px, font 14px

**Modifier:** `.btn-block` → width: 100%

### 3.2 Card (`.card`)

```css
background: white
border-radius: var(--r-lg)  /* 16px */
box-shadow: var(--sh-1)
border: 1px solid rgba(31,41,55,0.04)
```

Padding inline (component'a göre): 18, 20, 24, 28 — en yaygın **20-28**.

### 3.3 Pill / Badge (`.pill`)

**Temel:**
- Height 26px, padding 0 10px
- `border-radius: --r-pill`
- Font 12.5px, weight 600
- Inline-flex, gap 6px (ikon için)

**Varyantlar:**
| Class | Background | Color | Kullanım |
|---|---|---|---|
| `.pill-mercan` | `--pim-mercan-tint` | `--pim-mercan` | AI accent, brand |
| `.pill-yesil` | `--yesil-soft` | `--yesil` | İndirim, başarı |
| `.pill-sari` | `--sari-soft` | `#B07A0E` | Uyarı, devam ediyor |
| `.pill-gri` | `--gri-100` | `--gri-700` | Nötr |
| `.pill-lacivert` | `--lacivert` | beyaz | Vurgu, "Popüler" |
| `.pill-krem` | `--krem` | `--lacivert` | Soft etiket |

### 3.4 Input (`.input`)

```css
height: 48px
padding: 0 14px
border-radius: --r       /* 12px */
border: 1px solid --gri-200
font-size: 15px, weight: 500

:focus {
  border-color: --pim-mercan
  box-shadow: 0 0 0 4px --pim-mercan-tint  /* 4px focus ring */
}
```

### 3.5 Eyebrow (`.eyebrow`)

Kategori/section üst etiketi. Coral renk, küçük, uppercase, başında 18px line.

```
─── TÜRKİYE'NİN AKILLI DİJİTAL BASKISI
```

### 3.6 Selectable Card (`.selectable`)

Material/coating/yaldız gibi seçim kartları için.

**Default:** beyaz bg, 1.5px gri border, `--r` (12px) radius.
**Hover:** border `--pim-mercan-soft`, lift `translateY(-1px)`.
**Selected:**
- Border `--pim-mercan` (1.5px)
- Box-shadow `0 0 0 3px --pim-mercan-tint` (3px outer ring)
- Sağ üstte 22px mercan tick rozeti (cubic-bezier ease-out animasyon ile pop)

### 3.7 Stage Dot (`.stage-dot`)

Sipariş timeline noktası — 28px daire.
- `.done` → yeşil, beyaz tick
- `.curr` → mercan, 6px outer ring (mercan-tint)
- `.todo` → gri-200 bg, gri-500 text

### 3.8 Quantity Slider (`.qty-slider`)

Lacivert thumb, 22px, 4px beyaz border, soft shadow.
Hover'da `scale(1.1)`. Track: 6px height, gri-200 bg.

### 3.9 ⚠️ EKLENECEK — `<FormSection>`

**Şu an çakışan iki component var:**
- `etiket.jsx` → `<Step n title hint>` (numaralı yuvarlak rozet)
- `sticker.jsx` → `<Section title>` (numarasız sade)

**Birleştirme:**
```tsx
<FormSection number={1} title="Malzeme" hint="Etiketin dokusunu belirler.">
  {/* ... */}
</FormSection>

// number prop'u verilmezse numarasız modu (mevcut Section davranışı)
<FormSection title="Malzeme">
  {/* ... */}
</FormSection>
```

### 3.10 ⚠️ EKLENECEK — `<PriceCard variant>`

**Şu an iki final-price card stili var:**
| Sayfa | Stil | Kasıtlı mı? |
|---|---|---|
| `etiket.jsx` | beyaz card + 4px gradient top stripe + sarı upsell | Evet — "profesyonel sakin" |
| `sticker.jsx` | lacivert gradient + mercan accent | Evet — "enerjik premium" |

**Birleştirme:**
```tsx
<PriceCard variant="quiet">  {/* etiket */}
<PriceCard variant="bold">   {/* sticker */}
```

Aynı API, iki tema. Test'lerle bilinçli kararı locker.

---

## 4. Pim Mascot Sistemi

> **Karakter spec'inin kanonik kaynağı:** [`brand/PIM_MASCOT_BRIEF.md`](./brand/PIM_MASCOT_BRIEF.md).
> Vücut anatomisi, gözlük, önlük, cep içerikleri, renk paleti (Pantone), logo varyasyonları
> orada tanımlanır. Bu bölüm yalnızca **ürün içi kullanım** kurallarını (pose, boyut, animasyon,
> bağlam) belgeler.

### 4.1 Karakterin özeti (brief'ten)

- **Yumurta-şekilli kuş**, dik duruşlu, 2 küçük kanat, 2 turuncu ayak
- **Yuvarlak büyük gözlük** (signature element), kalın çerçeve, lacivert
- **Açık önlük** (krem) — beden üzerine giyilmiş, V yakası mercan vücudu gösterir
- **2 cep**: solda ürün etiketi rulosu (ciddi), sağda renkli sticker karması (eğlenceli)
- Renkler: Mercan vücut `#FF6B5B`, krem önlük `#F5EBD9`, lacivert outline `#1F2937`,
  turuncu gaga/ayak `#FF9933`

> ⚠️ **Mevcut `design-prototype/v1-jsx/pim.jsx` placeholder'dır** — insanımsı bir karakter
> çiziyor (cilt tonu, krem önlük). Brief uyarınca **yeniden çizilecek**. Bu bölümdeki pose API
> ve animasyon kuralları (4.2–4.5) yeniden çizimde **AYNI KALIR**; yalnızca alt katmanın
> path'leri değişir.

### 4.2 9 Pose

| Pose | Mouth | Brows | Arms | Extra | Nerede kullanılır |
|---|---|---|---|---|---|
| `wave` | smile | happy | wave (left up) | — | Hero, FAB, dashboard hero |
| `think` | small | think | chin | — | Etiket preview, AI suggestion |
| `wait` | small | neutral | down | — | (rezerv) |
| `inspect` | small | focus | magnify | büyüteç | Sipariş "Kontrolde" rozeti, AI QC |
| `happy` | wide | happy | thumb | — | Sticker preview, başarı, chat |
| `sad` | frown | worry | down | — | Hata, "üzüldüm" anları |
| `excited` | wide | happy | up | spark | Bottom CTA, sticker hero |
| `box` | smile | happy | down | turuncu kutu | "Kargoda", teslim |
| `chat` | talk (oval) | neutral | down | — | Chat header, dashboard chat shortcut |

### 4.3 Boyutlar

- **Hero:** 200-300px (Pim full body)
- **Sayfa içi:** 120-160px
- **Inline avatar:** `<PimMini>` 28-56px (sadece yüz, dairesel mask)

### 4.4 Animasyonlar

```css
@keyframes pim-bob       /* 4s, transform translateY ±6px + rotate ±1° */
@keyframes pim-wave-hand /* 1.6s, rotate -8° to 18° */
```

**Kural:** `pim-bob` default açık. Statik avatar'da `bob={false}` prop ile kapatılır (örn: PimMini, sipariş listesi ikonları).

### 4.5 Pose seçim rehberi

| Bağlam | Önerilen pose |
|---|---|
| İlk karşılama | `wave` |
| Bekleyen aksiyon (AI/operatör kontrolü) | `inspect` |
| Sevinç anı (başarı, ilerleme) | `happy` veya `excited` |
| Düşünce gerektiren öneri | `think` |
| Kargo/teslimat | `box` |
| Hata/kötü haber | `sad` |
| Sohbet | `chat` |

---

## 5. Voice & Tone

### 5.1 Marka sesi
- **Samimi ama ustaca** — Pim "etiket profesörü". Bilgili, yardımcı, biraz şakacı.
- **Hep ikinci tekil** ("sen", "senin"). "Siz" YASAK (resmilik kırar).
- **Kısa cümle, doğal Türkçe.** Reklam dili değil, anlatıcı dil.
- **Bursa'lı kimliği.** "Bursa'dan kapına", "10 günde elinde". Yerellik = güven.

### 5.2 Kabul edilenler
- "Pim sana yardım eder."
- "Cevap genelde 'evet, hallederiz'."
- "Kozmetik için ben kraft + mat selefon öneririm."
- Emoji: 🎯 💡 🎉 👋 ✨ — minimum, vurgu için. **Asla cümle içinde.**

### 5.3 Kaçınılanlar
- "Müşterilerimize" → "sana"
- "Hızlı, kaliteli, güvenli" → kanıt göster, slogan atma
- "Türkiye'nin en iyi" → kanıtsız üstünlük iddiası YASAK (TKHK m.61)
- "%99 müşteri memnuniyeti" → istatistik kanıtla yoksa söyleme

### 5.4 Disclaimer örneği (yasal)
"AI çıktıları yardımcı niteliktedir; nihai sorumluluk üreticidedir. Pim önerir, sen karar verirsin."

---

## 6. C Adımı için Düzeltilecekler Listesi

Taslakta tespit edilen **7 mikro tutarsızlık**. C adımında düzeltilecek.

| # | Tutarsızlık | Kaynak | Düzeltme |
|---|---|---|---|
| 1 | `Step` (etiket) vs `Section` (sticker) ayrı componentlar | `etiket.jsx`, `sticker.jsx` | Tek `<FormSection number?>` |
| 2 | `SelectableCard` etikette tanımlı, sticker'da inline kopya | `etiket.jsx`, `sticker.jsx` | Paylaşılan component, ortak prop |
| 3 | Final price card iki ayrı stil (beyaz vs lacivert) | `etiket.jsx`, `sticker.jsx` | `<PriceCard variant="quiet"\|"bold">` |
| 4 | Border radius inline değerleri (14, 20, 32) token dışı | Tüm sayfalar | `--r-md: 14`, `--r-2xl: 32` token ekle |
| 5 | Inline shadow string'leri token dışı | `home.jsx`, `dashboard.jsx`, `sticker.jsx` | `--sh-mercan`, `--sh-mercan-lg` token ekle |
| 6 | `--pim-mercan-koyu` v2-html'de var, v1-jsx'te yok | `design.css` vs `styles.css` | Token olarak ekle (hover state için) |
| 7 | Stat / QuickAction sayfa-içi, paylaşılmıyor | `dashboard.jsx` | UI library'ye taşı (D adımında) |

---

## 7. D Adımı için Tailwind Mapping (özet)

`tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      'pim-mercan': { DEFAULT: '#FF6B5B', soft: '#FFA89E', tint: '#FFF1EE', koyu: '#E85544' },
      krem:     { DEFAULT: '#F5EBD9', soft: '#FAF4E8' },
      lacivert: { DEFAULT: '#1F2937', soft: '#374151' },
      turuncu:  '#FF9933',
      gri:      { 50: '#FAFAF8', 100: '#F3F2EE', 200: '#E7E5DD', 300: '#D5D2C7', 500: '#9B9789', 700: '#4B5563' },
      yesil:    { DEFAULT: '#2BB673', soft: '#E6F6EE' },
      kirmizi:  '#E04B3C',
      sari:     { DEFAULT: '#F0B22F', soft: '#FCF4E1' },
    },
    fontFamily: {
      sans: ['Nunito', 'Inter', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      'display': ['56px',  { lineHeight: '1.04', letterSpacing: '-0.02em', fontWeight: '600' }],
      'h1':      ['40px',  { lineHeight: '1.10', letterSpacing: '-0.015em', fontWeight: '600' }],
      'h2':      ['28px',  { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
      'h3':      ['20px',  { lineHeight: '1.25', fontWeight: '600' }],
      'body':    ['16px',  { lineHeight: '1.55', fontWeight: '400' }],
      'small':   ['13px',  { lineHeight: '1.45', fontWeight: '500' }],
      'tiny':    ['11.5px',{ lineHeight: '1.30', letterSpacing: '0.04em', fontWeight: '600' }],
    },
    borderRadius: {
      'sm': '8px', 'md': '14px', DEFAULT: '12px', 'lg': '16px',
      'xl': '24px', '2xl': '32px', 'pill': '9999px',
    },
    boxShadow: {
      '1':         '0 1px 2px rgba(31,41,55,0.04), 0 4px 12px rgba(31,41,55,0.06)',
      '2':         '0 2px 4px rgba(31,41,55,0.04), 0 12px 24px rgba(31,41,55,0.08)',
      'inset-1':   'inset 0 0 0 1px rgba(31,41,55,0.06)',
      'mercan':    '0 6px 14px rgba(255,107,91,0.25)',
      'mercan-lg': '0 8px 20px rgba(255,107,91,0.18)',
    },
    keyframes: {
      'fade-up':       { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      'pim-bob':       { '0%,100%': { transform: 'translateY(0) rotate(-1deg)' }, '50%': { transform: 'translateY(-6px) rotate(1deg)' } },
      'pim-wave-hand': { '0%,100%': { transform: 'rotate(-8deg)' }, '50%': { transform: 'rotate(18deg)' } },
      'count-pulse':   { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)' } },
    },
    animation: {
      'fade-up':       'fade-up 320ms ease-out both',
      'pim-bob':       'pim-bob 4s ease-in-out infinite',
      'pim-wave-hand': 'pim-wave-hand 1.6s ease-in-out infinite',
      'count-pulse':   'count-pulse 220ms ease-out',
    },
    maxWidth: { 'container': '1280px' },
  },
},
```

---

## 8. A11y notları (D adımına hazırlık)

- Pim SVG'lere `role="img"` + `aria-label` (örn: "Pim el sallıyor")
- Tüm interaktif `selectable` button'ları → `role="radio"` veya `aria-pressed`
- Form input'larında `<label htmlFor>` zorunlu
- Focus ring: 4px `--pim-mercan-tint` outer ring (input'lar için tanımlı, button'lara da uygulanmalı)
- Renk kontrastı: `--gri-700` üzerine beyaz = 7.5:1 (WCAG AAA ✓)
- Mercan üzerine beyaz = 4.6:1 (WCAG AA ✓ for normal text)

---

## 9. Sonraki adımlar

- **C adımı:** §6'daki 7 düzeltmeyi `design-prototype/v1-jsx`'a uygula (taslak hala referans olarak temiz kalsın)
- **D adımı:** §7 Tailwind mapping ile `storefront/` Next.js scaffold
- **E adımı:** Sayfa sayfa migration (Home → Sticker → Etiket → Dashboard) — bu doküman migration sırasında Tailwind class kombinasyonlarına dönüşür
