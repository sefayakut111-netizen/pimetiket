Fiyat yönetimi hesaplayıcı (`/admin/fiyatlar?tab=calculator&scope=sticker`) yeniden tasarlandı. Canlıda çalışıyor. Şimdi kapsamlı analiz yap:

## 1. Fonksiyonel Kontrol

Sticker hesaplayıcıda (`src/components/admin/pricing/StickerCalculator.tsx`):
- Her malzeme seçildiğinde fiyat doğru hesaplanıyor mu? (Vinil, Transparan, Holografik, Simli)
- Her finiş seçildiğinde yüzde doğru uygulanıyor mu? (Yok, Parlak, Mat)
- Kesim tipi (Tabaka / Die Cut) değiştiğinde geometri doğru mu?
- Boyut değiştiğinde m² ve tabaka sayısı doğru mu?
- Her tier (25/50/100/250/500/1000) için çarpan doğru mu?
- Fason rate değiştiğinde simülasyon maliyet doğru mu?
- Site fiyatı (sağ panel) müşteri konfigüratöründeki fiyatla aynı mı?
- KDV hesaplaması doğru mu?
- NaN, undefined, Infinity hiçbir yerde yok mu?
- Rulo plan SVG doğru render ediliyor mu?

## 2. Müşteri Konfigüratörü ile Karşılaştırma

`/sticker/yapilandir` sayfasını aç (veya kodunu oku: `src/app/sticker/yapilandir/page.tsx`).
Aynı parametrelerle (Vinil + Parlak + 50×50mm + 250 adet) her iki tarafta fiyat hesapla.
AYNI sonucu vermeli. Farklıysa kök sebebi bul ve düzelt.

## 3. Fiyat Yönetimi Sekmesi Kontrolü

`/admin/fiyatlar?scope=sticker` (Fiyat Yönetimi tab'ı):
- Malzeme alış/satış çift fiyat gösteriliyor mu?
- Finiş maliyet/satış çift yüzde gösteriliyor mu?
- Operasyon: setup + paketleme + komisyon (kargo ve margin YOK)
- Toggle (aktif/devre dışı) çalışıyor mu?
- Canlıya kaydet çalışıyor mu?
- Kaydet sonrası hesaplayıcıda fiyat güncelleniyor mu?

## 4. Etiket Tabaka Kontrolü

`/admin/fiyatlar?scope=etiket_tabaka`:
- Tabaka alış/satış çift fiyat var mı?
- Kaplama maliyet/satış çift yüzde var mı?
- Operasyon sticker ile aynı yapıda mı? (kargo/margin yok)
- Canlı simülasyon doğru mu?

## 5. Etiket Rulo Kontrolü

`/admin/fiyatlar?scope=etiket_rulo`:
- Bu scope'a DOKUNULMAMALI — pricebook modu ayrı çalışıyor
- Kırılmamış mı kontrol et

## 6. Geriye Uyumluluk

- Mevcut kayıtlı config'lerde `margin`, `cargo`, `m2_sell_try` olmayabilir
- Fallback'lar çalışıyor mu?
- Eski siparişlerin fiyatları bozulmamış mı?

## 7. UX/UI Kontrol

- Sayfa yükleniyor mu kasma var mı?
- Tab geçişleri düzgün mü?
- Responsive (mobil) düzgün mü?
- Rulo plan SVG yazıları okunuyor mu?
- Gereksiz teknik bilgi (DB, m2_cost_try gibi) görünmüyor mu?

Sorun bulduğun her şeyi düzelt. Her fix sonrası `npx tsc --noEmit` + commit yap. Düzeltecek bir şey kalmayınca rapor yaz.
