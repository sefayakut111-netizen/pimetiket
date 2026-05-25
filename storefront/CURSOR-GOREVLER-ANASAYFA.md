# Cursor Anasayfa İyileştirmeleri — `/` (pimetiket.com)

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/page.tsx` (279 satır)
> 6 görev — Sefa onayladı (25 May)
> İPTAL: Görev 1 (trust strip), 2 (fiyat kartları), 3 (sosyal kanıt), 5 (popüler ürünler)

---

## GÖREV 1/6 — Hero CTA Mikrokopi (eski Görev 4)

### Ne yapılacak
Hero'daki "Sticker bastır" ve "Etiket bastır" butonlarının hemen altına 3 adımlık mini akış göster. Müşteri "tıklarsam ne olur" bilsin.

### Konum
Mevcut CTA butonları (satır ~147) ile "ücretsiz hesap aç" satırı (satır ~157) ARASINA.

### Kod

```typescript
{/* CTA butonlarının altına — akış özeti */}
<div className="mt-4 flex items-center gap-4 text-[12px] text-gri-500">
  <span className="flex items-center gap-1.5">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center text-gri-700">1</span>
    {locale === 'en' ? 'Configure' : 'Ayarla'}
  </span>
  <span className="text-gri-300">→</span>
  <span className="flex items-center gap-1.5">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center text-gri-700">2</span>
    {locale === 'en' ? 'See price' : 'Fiyat gör'}
  </span>
  <span className="text-gri-300">→</span>
  <span className="flex items-center gap-1.5">
    <span className="w-5 h-5 rounded-full bg-gri-100 text-[10px] font-bold grid place-items-center text-gri-700">3</span>
    {locale === 'en' ? 'Order' : 'Sipariş ver'}
  </span>
</div>
```

### Doğrulama
- Hero'da butonların altında "① Ayarla → ② Fiyat gör → ③ Sipariş ver" görünüyor
- Mobilde de okunabilir
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/6 — Blog Önizleme (eski Görev 6)

### Ne yapılacak
FAQ bölümünün ALTINA son 3 blog yazısı kartı. Blog boşsa bölüm tamamen gizlenir.

### Yeni component: `src/components/blog/BlogPreview.tsx`

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface BlogPost {
  slug: string;
  title_tr: string;
  excerpt_tr: string;
  category: string;
  read_minutes: number;
  cover_image_url?: string;
}

export function BlogPreview({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    // Sprint 2'de oluşturulan blog API veya mevcut getPublishedPosts
    fetch(`/api/admin/blog?status=published&limit=${limit}`)
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(d => setPosts(d.posts ?? d.coupons ?? []))
      .catch(() => {});
  }, [limit]);

  if (posts.length === 0) return null;

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
              <img
                src={post.cover_image_url}
                alt={post.title_tr}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="p-5">
            <div className="text-[11px] text-gri-500 uppercase tracking-wider">
              {post.category} · {post.read_minutes} dk
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold leading-snug line-clamp-2">
              {post.title_tr}
            </h3>
            {post.excerpt_tr && (
              <p className="mt-2 text-[13px] text-gri-700 line-clamp-2">
                {post.excerpt_tr}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

### Anasayfada kullan

`src/app/page.tsx` — FAQ section'ın kapanış `</section>` TAG'ından SONRA:

```typescript
import { BlogPreview } from "@/components/blog/BlogPreview";
import { Pim } from "@/components/Pim";  // zaten import varsa tekrar ekleme

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

NOT: Blog API yoksa (Sprint 2 henüz tamamlanmadıysa) `BlogPreview` sessizce `null` döner — sayfa kırılmaz.

### Doğrulama
- Blog yazısı varsa → 3 kart görünüyor
- Blog boşsa → bölüm tamamen gizli
- Hover: kart ring + shadow + kapak zoom
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/6 — Pim Maskot FAQ Yanında (eski Görev 7)

### Ne yapılacak
FAQ bölümünün sol kolonunda, "Tüm SSS →" butonunun altına Pim maskot ekle.

### Konum
`src/app/page.tsx` — FAQ section'daki sol kolon (satır ~246 civarı), `<Button>` kapanışından sonra:

```typescript
{/* Mevcut: */}
<Button variant="secondary" href="/sss">
  {t.home.faqAll} <Icon.ChevR size={14} />
</Button>

{/* YENİ — Pim maskot (sadece desktop) */}
<div className="mt-8 hidden md:block">
  <Pim pose="wave" size={100} />
</div>
```

`Pim` import'u zaten dosyada yoksa ekle. Kontrol et — `HomeReviews` veya boş state'lerde kullanılıyor olabilir ama `page.tsx`'de doğrudan import olmayabilir.

### Doğrulama
- Desktop: FAQ sol kolonunda Pim wave görünüyor
- Mobil: Pim gizli (yer kaplamaz)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/6 — Instagram Kartı (eski Görev 8)

### Ne yapılacak
Blog bölümü ile Footer arasına Instagram takip kartı. Minimal, merkez hizalı.

### Yeni SVG ikon gerekli

`src/components/Icon.tsx`'e Instagram ikonu ekle:

```typescript
function Instagram({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

`Icon` export objesine ekle:

```typescript
export const Icon = {
  // ... mevcut ikonlar ...
  Instagram,
};
```

### Anasayfada kullan

Blog section'dan SONRA, `</main>` öncesine:

```typescript
{/* ============================== INSTAGRAM ============================== */}
<section className="py-12">
  <div className="mx-auto max-w-[1280px] px-4 md:px-8 text-center">
    <h3 className="text-lg font-semibold mb-2">
      {locale === 'en' ? 'Follow us on Instagram' : "Bizi Instagram'da takip edin"}
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
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-[14px] transition-opacity hover:opacity-90"
      style={{
        background: 'linear-gradient(45deg, #405DE6, #5851DB, #833AB4, #C13584, #E1306C, #FD1D1D, #F56040, #F77737, #FCAF45)',
      }}
    >
      <Icon.Instagram size={18} /> @pimetiket
    </a>
  </div>
</section>
```

NOT: Instagram hesabı yoksa bu bölümü koşullu gösterebilirsin — ama şimdilik hardcoded bırak, Sefa hesap açınca zaten link çalışır.

### Doğrulama
- Instagram kartı görünüyor, gradient buton
- Tıklayınca yeni tab'da Instagram açılıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 5/6 — Mobil Sticky CTA Bar (eski Görev 9)

### Ne yapılacak
Mobilde scroll edince hero CTA kaybolur. Sayfanın altında sabit 2 butonlu bar.

### globals.css'e ekle

```css
/* iPhone notch safe area */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

### Anasayfada — `</main>` kapanışından ÖNCE (en son):

```typescript
{/* ============================== MOBILE STICKY CTA ============================== */}
<div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
  <div className="flex gap-2.5">
    <Button variant="primary" size="sm" href="/sticker" className="flex-1">
      <Icon.Sticker size={14} /> {t.home.ctaSticker}
    </Button>
    <Button variant="secondary" size="sm" href="/etiket" className="flex-1">
      <Icon.Roll size={14} /> {t.home.ctaEtiket}
    </Button>
  </div>
</div>
{/* Bottom padding — sticky bar arkasına content girmesin */}
<div className="h-16 md:hidden" aria-hidden />
```

### Doğrulama
- Mobilde: scroll edince altta sabit 2 buton
- Desktop'ta: bar gizli
- iPhone'da notch alanı doğru
- Butonlar çalışıyor (sticker→/sticker, etiket→/etiket)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 6/6 — Bölüm Sırası Düzenle (eski Görev 10)

### ÖNEMLİ: Geri alınabilir yapı

Bu görev mevcut section sırasını değiştirir. Sefa beğenmezse kolayca geri alınabilmesi için:

**Adım 1:** Mevcut sırayı yorum olarak sakla:

```typescript
{/* ============================== SECTION ORDER ==============================
  GERİ ALMA: Bu yorumdaki sıra orijinaldir. Sefa beğenmezse
  section'ları bu sıraya geri getir:
  
  ORIGINAL ORDER (25 May 2026 öncesi):
    1. Hero
    2. How it works (py-20 bg-gri-50)
    3. HomeReviews
    4. FAQ (py-12)
  
  YENİ ORDER:
    1. Hero
    2. How it works
    3. HomeReviews  
    4. FAQ + Pim (Görev 3)
    5. Blog (Görev 2)
    6. Instagram (Görev 4)
    7. Mobile sticky CTA (Görev 5)
============================== */}
```

**Adım 2:** Section'ları yeni sıraya taşı:

```
1. Hero (mevcut — değişmez)
     ↓
   CTA mikrokopi (Görev 1 — hero içinde)
     ↓
2. How it works (mevcut — değişmez)
     ↓
3. HomeReviews (mevcut — değişmez)
     ↓
4. FAQ + Pim (mevcut FAQ + Görev 3 Pim eklendi)
     ↓
5. Blog önizleme (Görev 2 — YENİ section)
     ↓
6. Instagram (Görev 4 — YENİ section)
     ↓
7. Mobil sticky CTA (Görev 5 — fixed, section değil)
     ↓
   </main>
```

**Fark:** Orijinalden tek fark → FAQ'dan SONRA 2 yeni bölüm (Blog + Instagram) eklendi. Mevcut sıra korundu. Minimal değişiklik.

**Geri alma talimatı:** Blog ve Instagram section'larını sil, Pim'i FAQ'dan kaldır, CTA mikrokopisini sil → orijinal 4 section'a dön.

### Doğrulama
- Sayfa sırası: Hero → How it works → Reviews → FAQ+Pim → Blog → Instagram
- Scroll akışı doğal
- Mobilde sticky CTA altta
- `npx tsc --noEmit` → 0 hata

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Hero CTA mikrokopi | 10 dk |
| 2 | Blog önizleme (component + section) | 25 dk |
| 3 | Pim maskot FAQ yanında | 5 dk |
| 4 | Instagram kartı (ikon + section) | 15 dk |
| 5 | Mobil sticky CTA bar | 15 dk |
| 6 | Bölüm sırası düzenle (geri alınabilir) | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
*Sefa onayı: Görev 1,2,3,5 iptal · Görev 4,6,7,8,9,10 onaylandı*
