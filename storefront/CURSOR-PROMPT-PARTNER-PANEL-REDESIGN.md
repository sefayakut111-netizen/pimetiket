Partner paneli (`/partner`) tamamen yeniden tasarlanacak. Bu session'da sadece Cursor kod yazıyor — Claude dokunmuyor.

Mevcut dosyalar:
- `src/app/partner/layout.tsx` — layout + alt nav
- `src/app/partner/page.tsx` — özet/dashboard
- `src/app/partner/siparisler/page.tsx` — sipariş listesi
- `src/app/partner/siparisler/[id]/page.tsx` — sipariş detay
- `src/app/partner/giris/page.tsx` — OTP login
- `src/components/partner/` — paylaşılan bileşenler

---

## FIX 1 — Site header'ı partner modunda gizle, partner header ekle

Partner modundayken (`/partner/*` path'leri) site header'ı (Anasayfa, Etiket, Sticker, Blog, Panelim) tamamen GİZLENSİN.

Yerine partner-specific header:
```
┌──────────────────────────────────────────────────────┐
│ [Logo] Pim Etiket · Partner Paneli     [Ad] [Çıkış] │
└──────────────────────────────────────────────────────┘
```

Bunu `src/app/partner/layout.tsx`'te yap. Site header'ı gizlemek için:
- Ana layout'ta (`src/app/layout.tsx` veya header bileşeninde) pathname `/partner` ile başlıyorsa header render etme
- VEYA partner layout'ta kendi header'ını render et ve site header'ı CSS ile gizle

Admin preview modundayken sarı/turuncu banner KALSIN (mevcut davranış).

---

## FIX 2 — Sol sidebar navigasyon ekle

Mevcut üst tab'ları (Özet, Siparişlerim) kaldır. Yerine sol sidebar:

```tsx
// Sol sidebar menü items:
const PARTNER_NAV = [
  { href: "/partner", label: "Özet", icon: "Dashboard", exact: true },
  { href: "/partner/siparisler", label: "İşlerim", icon: "Package" },
  { href: "/partner/ayarlar", label: "Ayarlar", icon: "Settings" },
];
```

Sidebar stili admin paneldeki gibi olsun (koyu arka plan, beyaz yazı, aktif item vurgulu). Mobilde hamburger menü veya alt nav olabilir.

Layout yapısı:
```tsx
<div className="flex min-h-screen">
  <aside className="w-56 bg-lacivert-koyu text-white shrink-0 hidden lg:block">
    {/* Logo + Partner Paneli */}
    {/* Nav items */}
    {/* Alt: Yardım + Çıkış */}
  </aside>
  <main className="flex-1 bg-gri-50">
    {/* Admin preview banner (varsa) */}
    {children}
  </main>
</div>
```

---

## FIX 3 — Özet sayfası yeniden tasarla

`src/app/partner/page.tsx` — landing page:

**Üst kısım:**
```
Hoş geldin, [Partner Adı]
Son 30 günlük üretim performansın
```

**Stat kartları (4'lü grid):**
```
BEKLEYEN     ÜRETİMDE     TAMAMLANAN     ORT. SÜRE
    2            3            15           2.4 gün
```

**Acil Sıradakiler bölümü:**
Bir sipariş acil sayılır eğer:
1. Admin tarafından acil işaretlendi (`order_assignments.priority = 'urgent'`)
2. VEYA üretim SLA süresi son 48 saate düştü

Her acil kart:
- Sipariş ID + ürün bilgisi (Sticker 50×50, 250 ad)
- Acil sebebi: "Admin acil işaretledi" veya "Son 48 saat"
- Countdown timer
- İndirme butonları (Görüntü / Bıçak / Görüntü+Bıçak)
- Aksiyon butonu (Başla / Üretime al / Kargoya ver)

**Son Aktivite bölümü:**
Son 5 durum değişikliği — "#PE-2026-ABC kargoya verildi — 2 saat önce" gibi.

---

## FIX 4 — İşlerim sayfası iyileştir

`src/app/partner/siparisler/page.tsx`:

- Acil olanlar HER ZAMAN üstte, kırmızı sol border
- Normal sıra: oluşturulma tarihine göre (FIFO)
- Her kartta countdown timer (kalan süre)
- Filtreler: Acil | Bekleyen | Üretimde | Tamamlanan | Tümü

---

## FIX 5 — Ayarlar sayfası oluştur (YENİ)

Yeni dosya: `src/app/partner/ayarlar/page.tsx`

Partner kendi bilgilerini görebilsin (çoğu readonly):

**Firma Bilgileri (readonly):**
- Firma adı, vergi no, adres, il/ilçe
- "Değiştirmek için info@pimetiket.com'a yazın" notu

**İletişim (düzenlenebilir):**
- Yetkili kişi adı
- Telefon
- E-posta

**Malzeme Kapasitesi (readonly):**
- Hangi ürün grupları (Sticker, Rulo, Tabaka)
- Hangi malzemeler
- "Admin tarafından yönetilir" notu

**Bildirim Tercihleri (düzenlenebilir):**
- Yeni iş atandığında e-posta: açık/kapalı
- Acil iş atandığında SMS: açık/kapalı

API: mevcut partner profil endpoint'ini kullan veya yeni `GET/PATCH /api/partner/settings` oluştur.

---

## FIX 6 — Acil sıra mantığı (API güncelleme)

`src/app/api/partner/orders/route.ts` (veya dashboard API):

Acil siparişleri belirle:
```typescript
// 1. Admin tarafından acil işaretlenen
const urgentByAdmin = assignments.filter(a => a.priority === 'urgent');

// 2. SLA süresi 48 saatten az kalan
const urgentBySLA = assignments.filter(a => {
  if (!a.sla_deadline) return false;
  const remaining = new Date(a.sla_deadline).getTime() - Date.now();
  return remaining > 0 && remaining < 48 * 60 * 60 * 1000;
});
```

NOT: `order_assignments` tablosunda `priority` kolonu yoksa ekle (migration gerekebilir). Veya mevcut `is_urgent` boolean kullan.

---

## KONTROL

Her fix sonrası: `npx tsc --noEmit` + commit (`feat(partner):` prefix)

Test:
1. `/partner` → sol sidebar var, site nav yok
2. Özet sayfası: stat kartları, acil sıra, son aktivite
3. İşlerim: acil üstte, filtreler çalışıyor
4. Ayarlar: bilgiler gösteriliyor, iletişim düzenlenebiliyor
5. Mobilde: sidebar gizli, hamburger veya alt nav
6. Admin preview: sarı banner kalıyor
7. `/partner/giris`: sidebar gizli, sadece login form
