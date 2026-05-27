Tum sistemin mobil ve tablet uyumluligunu analiz et. Her sayfa icin responsive sorunlari bul ve duzelt. Emoji kullanma.

---

## YONTEM

Her sayfa icin su kontrolleri yap:
1. `className` icerisinde responsive prefix'leri kontrol et (sm:, md:, lg:, xl:)
2. Sabit genislik/yukseklik (w-[400px], h-[600px] gibi) mobilde tasmaya sebep olur mu?
3. Grid layout'lar mobilde tek kolona dusuyor mu?
4. Tablo/liste mobilde yatay scroll gerektiriyor mu?
5. Butonlar ve tiklanabilir alanlar mobilde yeterince buyuk mu (min 44x44px)?
6. Metin boyutlari mobilde okunabiliyor mu?
7. Modal/popup'lar mobilde ekrani kaplayacak sekilde mi?
8. Sticky/fixed elementler mobilde ust uste biniyor mu?
9. Hamburger menu veya alt nav var mi?
10. Touch-friendly mi (hover-only etkileisimler var mi)?

---

## BASLIK 1: MUSTERI SAYFALARI

Dosyalar:
- `src/app/sticker/yapilandir/page.tsx` — konfigurator (cok karisik layout)
- `src/app/etiket/yapilandir/page.tsx`
- `src/app/sepet/page.tsx`
- `src/app/odeme/page.tsx`
- `src/app/siparis/[id]/page.tsx`
- `src/app/siparis/[id]/tasarim-yukle/page.tsx`
- `src/app/onay/[orderId]/page.tsx` — sol panel + sag panel
- `src/app/onay/[orderId]/duzenle/[itemId]/page.tsx` — POC iframe
- `src/app/panelim/page.tsx`
- `src/app/siparislerim/page.tsx`
- `src/app/tasarimlarim/page.tsx`

Ozel dikkat:
- Konfigurator: adimlar sidebar (sag) + form (sol) + onizleme (sol ust) — mobilde nasil?
- Onay sayfasi: sol item listesi + sag onizleme — mobilde ust uste mi?
- POC editor: iframe yuksekligi mobilde yeterli mi?
- Sepet: 2 kolonlu layout (urunler + ozet) — mobilde?
- Odeme: form + sag sidebar ozet — mobilde?

---

## BASLIK 2: ADMIN PANEL

Dosyalar:
- `src/components/layout/AdminShell.tsx` — sidebar + main area
- `src/app/admin/page.tsx` — dashboard (cok kartli)
- `src/app/admin/siparisler/page.tsx` — tablo + chip'ler
- `src/app/admin/fason/[partnerId]/page.tsx` — 2 kolonlu layout
- `src/app/admin/fiyatlar/page.tsx` — hesaplayici (sol + sag panel)
- `src/app/admin/prova/page.tsx`
- `src/app/admin/kargo/page.tsx`
- `src/app/admin/musteriler/page.tsx`

Ozel dikkat:
- Admin sidebar mobilde hamburger menu mi? Calisiyormu?
- Dashboard kartlari mobilde stackleniyor mu yoksa tasiyormu?
- Siparis tablosu mobilde yatay scroll mu kart gorunumu mu?
- Fason partner detay 2 kolon → mobilde tek kolon?
- Hesaplayici sol+sag panel → mobilde?
- Chip filtreleri mobilde sarma (wrap) yapiyor mu?

---

## BASLIK 3: PARTNER PANELI

Dosyalar:
- `src/app/partner/layout.tsx` — sidebar/alt nav
- `src/app/partner/page.tsx` — dashboard
- `src/app/partner/siparisler/page.tsx`
- `src/app/partner/siparisler/[id]/page.tsx`
- `src/app/partner/ayarlar/page.tsx`

Ozel dikkat:
- Partner sidebar mobilde alt nav'a mi donusuyor?
- Siparis kartlari mobilde dogru mu?
- Indirme butonlari (Goruntu/Bicak) mobilde tiklanabilir mi?

---

## BASLIK 4: ORTAK BILESENLER

Dosyalar:
- `src/components/pim/PimChat.tsx` — sag alt kosse widget
- `src/components/ui/Toast.tsx` — bildirimler
- `src/components/cart/DesignThumbnailGroup.tsx`
- `src/components/sticker/MultiDesignUploader.tsx`
- Header + footer blesenleri

Ozel dikkat:
- Pim chat balonu mobilde tiklanabilir mi, panel acilinca ekrani kapliyor mu?
- Toast bildirimleri mobilde gorunuyor mu?
- Multi-design uploader mobilde dosya secimi calisior mu?

---

## DUZELTME KURALLARI

Sorun buldugun her yerde:
- Sabit genislik → `max-w-full` veya responsive prefix ekle
- 2+ kolonlu grid → `grid-cols-1 md:grid-cols-2` veya `lg:grid-cols-2`
- Tablo → mobilde kart gorunumune gec veya `overflow-x-auto` ekle
- Buton boyutu → `min-h-[44px] min-w-[44px]`
- Metin → mobilde `text-sm` veya `text-base`
- Modal → mobilde `max-w-full mx-4` veya `inset-0`
- Sidebar → mobilde `hidden lg:block` + hamburger toggle

---

## CIKTI

Her baslik icin:
```
BASLIK X: Y sorun bulundu, Z duzeltildi
- Sorun 1: [dosya:satir] aciklama → fix
- Sorun 2: ...
```

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(responsive):` prefix)
