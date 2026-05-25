# Cursor Anasayfa İyileştirmeleri — `/` (pimetiket.com)

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/page.tsx` (279 satır)
> 10 görev: 4 düzeltme + 6 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/10 — Trust Strip (Güven Sinyali) (P1)

#### Sorun
Güven strip'i kaldırılmış (Sefa 17 May) — yeni müşteri "güvenilir mi" diye düşünür.

#### Değişiklik

Hero ile "Nasıl çalışır" arasına minimal trust strip ekle:

```typescript
{/* ============================== TRUST STRIP ============================== */}
<section className="py-6 border-b border-gri-100">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8">
    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
      {[
        { icon: '🔒', text: locale === 'en' ? '3D Secure payments' : '3D Secure ödeme' },
        { icon: '🤖', text: locale === 'en' ? 'AI design check' : 'AI dosya kontrolü' },
        { icon: '📦', text: locale === 'en' ? 'Free shipping over ₺500' : '500₺ üzeri ücretsiz kargo' },
        { icon: '🛡️', text: locale === 'en' ? 'KVKK compliant' : 'KVKK uyumlu' },
      ].map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-[13px] text-gri-700">
          <span className="text-lg">{item.icon}</span>
          <span className="font-medium">{item.text}</span>
        </div>
      ))}
    </div>
  </div>
</section>
```

Basit, 1 satır, 4 ikon+metin. Footer'daki PaymentBadges ile duplicate değil — bu genel güven, footer ödeme spesifik.

---

### GÖREV 2/10 — Başlangıç Fiyat Kartları (P1)

#### Sorun
Müşteri fiyat görmeden konfigüratöre girmiyor — bounce rate yüksek.

#### Değişiklik

Trust strip'in altına, "Nasıl çalışır"ın ÜSTÜNE fiyat önizleme bölümü ekle:

```typescript
{/* ============================== PRICE PREVIEW ============================== */}
<section className="py-16">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8">
    <div className="text-center mb-10">
      <Eyebrow>{locale === 'en' ? 'Pricing' : 'Fiyatlar'}</Eyebrow>
      <h2 className="mt-4 text-[28px] md:text-[36px] font-semibold tracking-tight">
        {locale === 'en' ? 'Transparent pricing, no surprises' : 'Şeffaf fiyatlandırma, sürpriz yok'}
      </h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[
        {
          title: locale === 'en' ? 'Stickers' : 'Sticker',
          desc: locale === 'en' ? 'From 25 pieces, die-cut' : '25 adetten, özel kesim',
          from: '30',
          unit: locale === 'en' ? 'starting from' : 'başlangıç',
          href: '/sticker',
          emoji: '🏷️',
          bg: 'bg-pim-mercan-tint/30',
        },
        {
          title: locale === 'en' ? 'Roll Labels' : 'Rulo Etiket',
          desc: locale === 'en' ? 'From 1,000 pieces' : '1.000 adetten',
          from: '850',
          unit: locale === 'en' ? 'starting from' : 'başlangıç',
          href: '/etiket',
          emoji: '📋',
          bg: 'bg-krem/50',
        },
        {
          title: locale === 'en' ? 'Sheet Labels' : 'Tabaka Etiket',
          desc: locale === 'en' ? 'From 250 pieces' : '250 adetten',
          from: '120',
          unit: locale === 'en' ? 'starting from' : 'başlangıç',
          href: '/etiket?scope=tabaka',
          emoji: '📄',
          bg: 'bg-yesil-soft/20',
        },
      ].map((card, i) => (
        <Link
          key={i}
          href={card.href}
          className={cn(
            "group rounded-2xl p-6 ring-1 ring-gri-200 hover:ring-pim-mercan hover:shadow-lg transition-all",
            card.bg
          )}
        >
          <span className="text-3xl">{card.emoji}</span>
          <h3 className="mt-3 text-xl font-semibold">{card.title}</h3>
          <p className="text-[13px] text-gri-700 mt-1">{card.desc}</p>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-[28px] font-bold text-lacivert tabular-nums">
              {card.from} ₺
            </span>
            <span className="text-[12px] text-gri-500">{card.unit}</span>
          </div>
          <div className="mt-3 text-[13px] font-semibold text-pim-mercan group-hover:underline">
            {locale === 'en' ? 'Configure →' : 'Konfigüre et →'}
          </div>
        </Link>
      ))}
    </div>
    <p className="text-center text-[12px] text-gri-500 mt-4">
      {locale === 'en'
        ? 'All prices include 20% VAT. Exact price calculated in configurator.'
        : 'Tüm fiyatlar %20 KDV dahildir. Tam fiyat konfigüratörde hesaplanır.'}
    </p>
  </div>
</section>
```

NOT: "30₺", "850₺", "120₺" başlangıç fiyatları statik — gerçek pricing engine'dan çekmek yerine yaklaşık değer yeterli (müşteri zaten konfigüratöre gidecek). Sefa bu rakamları admin ayarlardan değiştirmek isterse gelecekte `site_settings`'e eklenebilir.

---

### GÖREV 3/10 — Sosyal Kanıt (Yorum Yokken) (P1)

#### Sorun
Pre-launch'ta yorum yok → HomeReviews boş state gösteriyor.

#### Değişiklik

`src/components/reviews/HomeReviews.tsx`'de boş state'i güncelle — "henüz yorum yok" yerine rakamlar + mikrokopi:

```typescript
// Mevcut boş state (satır ~62 civarı) yerine:
if (reviews !== null && reviews.length === 0) {
  return (
    <section className="py-16 bg-gri-50">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 text-center">
        <Eyebrow>Müşterilerimiz</Eyebrow>
        <h2 className="mt-4 text-[28px] md:text-[36px] font-semibold tracking-tight">
          Güvenle çalışıyoruz
        </h2>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { num: '7/24', label: 'AI destekli dosya kontrolü' },
            { num: '3D', label: 'Secure ödeme garantisi' },
            { num: '36sa', label: 'Onay verilmezse otomatik iade' },
            { num: '%100', label: 'KVKK uyumlu veri koruma' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-[32px] font-bold text-pim-mercan">{s.num}</div>
              <div className="text-[13px] text-gri-700 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[14px] text-gri-500">
          İlk siparişini ver, deneyimini paylaş — yorumun burada görünsün.
        </p>
      </div>
    </section>
  );
}
```

Gerçek yorumlar gelince otomatik bu bölüm kaybolur, normal yorum grid'i gösterilir.

---

### GÖREV 4/10 — Hero CTA Mikrokopi (P2)

#### Sorun
"Sticker bastır" tıklayan müşteri ne bekleyeceğini bilmiyor.

#### Değişiklik

Hero CTA butonlarının altına kısa akış açıklaması ekle (mevcut "ücretsiz hesap aç" satırının ÜSTÜNE):

```typescript
{/* CTA butonları altına — akış özeti */}
<div className="mt-4 flex items-center gap-4 text-[12px] text-gri-500">
  <span className="flex items-center gap-1">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center">1</span>
    {locale === 'en' ? 'Configure' : 'Ayarla'}
  </span>
  <span className="text-gri-300">→</span>
  <span className="flex items-center gap-1">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center">2</span>
    {locale === 'en' ? 'See price' : 'Fiyat gör'}
  </span>
  <span className="text-gri-300">→</span>
  <span className="flex items-center gap-1">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center">3</span>
    {locale === 'en' ? 'Order' : 'Sipariş ver'}
  </span>
</div>
```

---

## EKLEMELER (6)

### GÖREV 5/10 — Popüler Ürün Kartları (P2)

#### Değişiklik

Fiyat kartları bölümünün altına, "Nasıl çalışır"ın ÜSTÜNE:

```typescript
{/* ============================== POPULAR ============================== */}
<section className="py-16 bg-white">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8">
    <div className="text-center mb-10">
      <Eyebrow>{locale === 'en' ? 'Popular' : 'Popüler ürünler'}</Eyebrow>
      <h2 className="mt-4 text-[28px] md:text-[36px] font-semibold tracking-tight">
        {locale === 'en' ? 'Most ordered products' : 'En çok sipariş edilenler'}
      </h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[
        {
          title: locale === 'en' ? 'Round Roll Label' : 'Yuvarlak Rulo Etiket',
          desc: locale === 'en' ? 'The classic — jars, bottles, cosmetics' : 'Klasik — kavanoz, şişe, kozmetik',
          href: '/etiket/yapilandir?shape=circle',
          img: '/assets/svg/cards/rulo-circle.svg',
        },
        {
          title: locale === 'en' ? 'Die-Cut Sticker' : 'Özel Kesim Sticker',
          desc: locale === 'en' ? 'Your logo shape — laptop, packaging' : 'Logo şeklinde — laptop, ambalaj',
          href: '/sticker/yapilandir?shape=die&cut=diecut',
          img: '/assets/svg/cards/rulo-diecut.svg',
        },
        {
          title: locale === 'en' ? 'Kraft Label' : 'Kraft Etiket',
          desc: locale === 'en' ? 'Natural look — organic, artisan' : 'Doğal görünüm — organik, el yapımı',
          href: '/etiket/yapilandir?material=kraft',
          img: '/assets/svg/cards/rulo-square.svg',
        },
      ].map((card, i) => (
        <Link
          key={i}
          href={card.href}
          className="group rounded-2xl overflow-hidden ring-1 ring-gri-200 hover:ring-pim-mercan hover:shadow-lg transition-all"
        >
          <div className="h-40 bg-gri-50 flex items-center justify-center p-4">
            <img src={card.img} alt={card.title} className="h-28 object-contain" />
          </div>
          <div className="p-5">
            <h3 className="text-lg font-semibold">{card.title}</h3>
            <p className="text-[13px] text-gri-700 mt-1">{card.desc}</p>
            <div className="mt-3 text-[13px] font-semibold text-pim-mercan group-hover:underline">
              {locale === 'en' ? 'Configure →' : 'Konfigüre et →'}
            </div>
          </div>
        </Link>
      ))}
    </div>
  </div>
</section>
```

---

### GÖREV 6/10 — Blog Önizleme (P2)

#### Değişiklik

FAQ bölümünün ALTINA son 3 blog yazısı:

```typescript
{/* ============================== BLOG ============================== */}
<section className="py-16 bg-gri-50">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8">
    <div className="flex items-center justify-between mb-8">
      <div>
        <Eyebrow>{locale === 'en' ? 'Blog' : 'Blog'}</Eyebrow>
        <h2 className="mt-3 text-[24px] font-semibold tracking-tight">
          {locale === 'en' ? 'Tips & guides' : 'İpuçları ve rehberler'}
        </h2>
      </div>
      <Button variant="secondary" href="/blog" size="sm">
        {locale === 'en' ? 'All articles' : 'Tüm yazılar'} <Icon.ChevR size={12} />
      </Button>
    </div>
    <BlogPreview limit={3} />
  </div>
</section>
```

`BlogPreview` component'i:

```typescript
// src/components/blog/BlogPreview.tsx (yeni)
function BlogPreview({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    // Blog CMS'den (Görev SPRINT2'de eklendi) veya mevcut blog-posts.ts'den
    fetch('/api/public/blog?limit=' + limit)
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {});
  }, [limit]);

  if (posts.length === 0) return null; // Blog yazısı yoksa bölüm gizle

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {posts.map(post => (
        <Link
          key={post.slug}
          href={`/blog/${post.slug}`}
          className="group rounded-2xl bg-white ring-1 ring-gri-200 overflow-hidden hover:ring-pim-mercan hover:shadow-lg transition-all"
        >
          {post.cover_image_url && (
            <div className="h-36 overflow-hidden">
              <img src={post.cover_image_url} alt={post.title_tr} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </div>
          )}
          <div className="p-5">
            <div className="text-[11px] text-gri-500 uppercase tracking-wider">{post.category} · {post.read_minutes} dk</div>
            <h3 className="mt-1.5 text-[15px] font-semibold leading-snug">{post.title_tr}</h3>
            <p className="mt-2 text-[13px] text-gri-700 line-clamp-2">{post.excerpt_tr}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

NOT: Blog API'si (`/api/public/blog`) Sprint 2 görevlerinde oluşturuldu. Mevcut değilse basitçe `getPublishedPosts()` fonksiyonunu client component'ten çağır.

---

### GÖREV 7/10 — Pim Maskot Anasayfada (P2)

#### Değişiklik

"Nasıl çalışır" bölümünün yanına veya FAQ bölümüne Pim ekleme:

FAQ bölümünün sol kolonu'nda (mevcut başlık + açıklama + buton) altına:

```typescript
{/* FAQ sol kolonda mevcut içerik altına: */}
<div className="mt-8 hidden md:block">
  <Pim pose="wave" size={100} />
</div>
```

Sadece desktop'ta göster (mobilde yer kaplar). Pim'in "wave" pose'u ile samimi karşılama.

---

### GÖREV 8/10 — Instagram / Sosyal Medya Kartı (P3)

#### Değişiklik

Blog bölümü altına veya Footer öncesine:

```typescript
{/* ============================== SOCIAL ============================== */}
<section className="py-12">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8 text-center">
    <h3 className="text-lg font-semibold mb-3">
      {locale === 'en' ? 'Follow us on Instagram' : 'Bizi Instagram\'da takip edin'}
    </h3>
    <p className="text-[13px] text-gri-700 mb-5">
      {locale === 'en'
        ? 'Inspirations, behind the scenes, customer projects'
        : 'İlham, üretim sahne arkası, müşteri projeleri'}
    </p>
    <a
      href="https://instagram.com/pimetiket"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold text-[14px] hover:opacity-90 transition-opacity"
    >
      <Icon.Instagram size={18} /> @pimetiket
    </a>
  </div>
</section>
```

NOT: Instagram hesap URL'ini `site_settings`'ten çekmek ideal ama şimdilik hardcoded yeterli.

---

### GÖREV 9/10 — Mobil Sticky CTA Bar (P2)

#### Sorun
Mobilde scroll edince hero CTA butonları kaybolur — müşteri aksiyon alamıyor.

#### Değişiklik

Sayfa sonuna (FAQ altına, footer öncesine) mobil sticky bar ekle:

```typescript
{/* ============================== MOBILE STICKY CTA ============================== */}
<div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
  <div className="flex gap-2">
    <Button variant="primary" size="sm" href="/sticker" className="flex-1">
      <Icon.Sticker size={14} /> Sticker
    </Button>
    <Button variant="secondary" size="sm" href="/etiket" className="flex-1">
      <Icon.Roll size={14} /> Etiket
    </Button>
  </div>
</div>
{/* Bottom padding — sticky bar arkasına content girmesi için */}
<div className="h-16 md:hidden" />
```

`safe-area-bottom` class'ı (iPhone notch):
```css
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

Bu class'ı `globals.css`'e ekle (veya Tailwind plugin kullan).

Bar sadece mobilde görünür (`md:hidden`). Desktop'ta hero CTA her zaman erişilebilir.

---

### GÖREV 10/10 — Anasayfa Bölüm Sırası Düzenle (P2)

#### Mevcut sıra:
1. Hero
2. How it works
3. Reviews
4. FAQ

#### Yeni sıra (tüm görevler sonrası):
1. Hero
2. **Trust strip** (🆕 Görev 1)
3. **Başlangıç fiyat kartları** (🆕 Görev 2)
4. **Popüler ürünler** (🆕 Görev 5)
5. How it works
6. Reviews / Sosyal kanıt (🆕 Görev 3 — boşken rakam, doluyken yorum)
7. FAQ (+ Pim 🆕 Görev 7)
8. **Blog önizleme** (🆕 Görev 6)
9. **Instagram** (🆕 Görev 8)
10. Footer
11. **Mobil sticky CTA** (🆕 Görev 9)

Bu sıralama müşteri psikolojisine uygun:
```
İlgi çek (hero) → Güven ver (trust) → Fiyat göster (fiyat kartları) 
→ İlham ver (popüler) → Nasıl çalışır (akış) → Sosyal kanıt (yorum/rakam) 
→ Soruları cevapla (FAQ) → İçerik (blog) → Takip et (Instagram)
```

Görevler tamamlandıktan sonra `page.tsx`'deki section sırasını bu şekilde düzenle.

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Trust strip (güven sinyali) | 15 dk |
| 2 | Başlangıç fiyat kartları | 30 dk |
| 3 | Sosyal kanıt (yorum yokken rakam) | 20 dk |
| 4 | Hero CTA mikrokopi | 10 dk |
| 5 | Popüler ürün kartları | 25 dk |
| 6 | Blog önizleme (son 3 yazı) | 25 dk |
| 7 | Pim maskot FAQ yanında | 5 dk |
| 8 | Instagram kartı | 10 dk |
| 9 | Mobil sticky CTA bar | 15 dk |
| 10 | Bölüm sırası düzenle | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
