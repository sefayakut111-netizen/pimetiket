`src/app/admin/fiyatlar/page.tsx` ve `src/components/admin/pricing/StickerCalculator.tsx` dosyalarını oku ve gereksiz alanları kaldır:

## 1. Fiyat Yönetimi sayfası üst kısım sadeleştirme

`src/app/admin/fiyatlar/page.tsx` dosyasında şu alanları KALDIR:
- "YÖNETİM" eyebrow etiketi
- "Fiyat Yönetimi" büyük başlık (h1)
- Altındaki açıklama paragrafı ("Birim maliyetgir (sticker/rulo → m²...")
- "Vinil / Opak / Şeffaf / Holografik / Metalik · Finiş seçimi" alttext

Breadcrumb (Dashboard > Fiyat yönetimi) KALSIN.
Scope tab'ları (Sticker / Rulo Etiket / Tabaka Etiket) KALSIN.
Fiyat Yönetimi / Hesaplayıcı tab'ları KALSIN.

Sayfa doğrudan breadcrumb → scope tab → mod tab ile başlasın.

## 2. Hesaplayıcıdan sepet sistemini kaldır

`src/components/admin/pricing/StickerCalculator.tsx` dosyasında:
- "Sepete Ekle" butonu KALDIR (üst toolbar'daki)
- `CartPanel` bileşeni render'ını KALDIR
- `addToCart`, `CartItem`, `CartPanel` import'larını KALDIR
- `cart` ile ilgili tüm state'leri KALDIR
- `reconstructGeometryFromCart`, `reconstructCostFromCart` import'larını KALDIR

Bu hesaplayıcı sadece fiyat simülasyonu için — sipariş vermek için kullanılmıyor.

NOT: "Lot", "İstatistik", "JSON kopyala", "Sıfırla", "İş Emri PDF" butonları KALSIN — bunlar operatör için faydalı.

## 3. Operatör simülasyon kartında KDV dahil fiyat büyük gösterilsin

`src/components/admin/pricing/StickerCalculator.tsx` — `OperatorCostHero` fonksiyonunda (satır ~1130):

Şu an büyük fiyat `cost.baseCost` (KDV hariç) gösteriyor. Bunun yanına veya altına KDV dahil fiyat da ekle:

```tsx
// Mevcut büyük fiyat satırının altına:
<div className="text-[36px] font-bold tabular-nums text-lacivert leading-none">
  {fmt(Math.round(cost.baseCost))} <span className="text-[20px] text-gri-500">₺</span>
  <span className="text-[16px] text-gri-400 ml-2">
    + KDV = {fmt(Math.round(cost.total))} ₺
  </span>
</div>
```

Veya daha temiz: büyük fiyatı KDV dahil göster, altında KDV hariç küçük yazısın:
```tsx
<div className="text-[36px] font-bold tabular-nums text-lacivert leading-none">
  {fmt(Math.round(cost.total))} <span className="text-[20px] text-gri-500">₺</span>
</div>
<p className="text-[12px] text-gri-500 mt-0.5">KDV dahil · KDV hariç {fmt(Math.round(cost.baseCost))} ₺</p>
```

Her fix sonrası `npx tsc --noEmit` + commit yap.
