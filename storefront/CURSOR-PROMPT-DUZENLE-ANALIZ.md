`src/app/onay/[orderId]/duzenle/[itemId]/page.tsx` dosyasını satır satır oku ve şu sorunları kontrol et:

1. POC iframe'e tasarım dosyası otomatik yüklenmiyor — URL'de `design_file_id` parametresi var ama POC sol panelde "Dosya yükle" diyor. `designUrl` query parametresi POC'a doğru geçiriliyor mu? Signed URL alınıyor mu? Kontrol et ve düzelt.

2. Layout tutarsızlığı — üst kısım (başlık, breadcrumb, Pim mesajı) container/padding olmadan soldan sıfır başlıyor. `bg-gri-50 min-h-[calc(100vh-64px)]` + `mx-auto max-w-[1280px] px-4 md:px-8` wrapper ekle (diğer sayfalarla tutarlı).

3. POC iframe boyutu — iframe yeterince yükseklik alıyor mu? `min-h-[600px]` veya benzeri var mı? Mobilde nasıl davranıyor?

4. Genel UX kontrol:
   - "Kaydet ve dön" butonu çalışıyor mu?
   - "Onay sayfasına dön" linki doğru mu?
   - POC postMessage iletişimi çalışıyor mu? (pim-poc-ready, pim-cutline-saved)
   - Hata durumları (dosya bulunamadı, signed URL expired) kullanıcıya gösteriliyor mu?
   - Vision fallback banner var mı?

Sorun bulduğun her şeyi düzelt. Her fix sonrası `npx tsc --noEmit` + commit yap.
