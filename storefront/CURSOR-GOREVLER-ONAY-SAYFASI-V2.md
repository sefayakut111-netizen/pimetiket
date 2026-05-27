# Cursor — /onay Sayfası Arıza Tespit + UX Fix (KRİTİK)

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Ekran görüntüsüne bakarak tespit edilen sorunlar + genel UX analizi.
> `src/app/onay/[orderId]/page.tsx` (1813 satır)

---

## EKRAN GÖRÜNTÜSÜNDEN TESPİT EDİLEN SORUNLAR

### 1. Bıçak önizleme alanı BOŞ — resim yüklenememiş (KRİTİK)
Bıçak tab'ı aktif ama gri alanda sadece kırık resim ikonu var:
`[Sticker · Opak Folyo + Yok (2 tasarım) bıçak önizlemesi]`
Bu, `previewUrl` (R2 signed URL) alınamadığı veya `cutline_designs.preview_png_url` boş olduğu anlamına geliyor.

**Kontrol et:**
1. Bu sipariş için `cutline_designs` tablosunda row var mı?
2. `preview_png_url` dolu mu boş mu?
3. `/api/orders/[id]/proof/[itemId]/preview-url` endpoint'i ne dönüyor?
4. Signed URL expired mı?
5. R2'de dosya gerçekten var mı?

**Fix:** Eğer cutline_designs boşsa → cutline henüz üretilmemiş demek. Bu durumda:
- "Otomatik kesim çizgisi hazırlanıyor" mesajı + spinner gösterilmeli
- Kırık resim ikonu ASLA gösterilmemeli
- Hidden iframe POC fallback tetiklenmeli

`src/app/onay/[orderId]/page.tsx` satır ~1486-1544 arasında preview render logic'i kontrol et:
```typescript
// displayUrl null ise kırık img yerine loading/empty state göster
// Şu an: displayUrl truthy ise <img> render ediyor
// Sorun: displayUrl "" (empty string) ise truthy → kırık img
```

### 2. "Sipariş detayına dön" linki kırık görünüyor
Sol üstte `← Sipariş detayına dön` ve `SİPARİŞ #260520262357` yan yana, ama kesik çizgi araya girmiş (`——`). Layout bozuk.

**Fix:** Breadcrumb'ın render'ını kontrol et. `Eyebrow` + link yan yana düzgün hizalanmalı.

### 3. Sol panel item kartında ürün ikonu yok
Sadece boş gri kare var. Sipariş özeti kartındaki gibi ürün thumbnail'ı veya sticker/etiket ikonu gösterilmeli.

**Fix:** Satır ~1203-1211'deki placeholder'ı kontrol et. Cutline preview varsa onu, yoksa ürün ikonunu göster.

### 4. Pim mesajı cutline yokken yanıltıcı
"İlk önizlemeye bak, kesim çizgisini incele" diyor ama bakılacak bir şey yok — cutline üretilmemiş.

**Fix:** CURSOR-GOREVLER-ONAY-SAYFASI.md Görev 5'te çözüm var. Cutline yokken farklı mesaj göster.

### 5. "Bu ürünü onayla" butonu aktif — ama cutline yok (KRİTİK)
Cutline önizleme boş/kırık olmasına rağmen onay butonu tıklanabilir durumda. Cutline yokken onay yapmak veri bütünlüğü riski.

**Fix:** CURSOR-GOREVLER-ONAY-SAYFASI.md Görev 1'de çözüm var. `activeCutline` null ise disabled yap.

### 6. Multi-design (2 tasarım) ama tek preview
Sipariş "2 tasarım" diyor ama preview alanında tek bıçak görünümü var. Tasarım seçici (design picker) nerede?

**Fix:** Satır ~1362-1398'deki multi-design picker kontrol et. `activeItem.designs.length > 1` koşulu sağlanıyorsa picker bar gösterilmeli.

---

## GENEL UX/UI ANALİZİ YAP

Aşağıdaki kontrolleri de yap:

### A. Responsive kontrol
- Mobilde sol panel + sağ panel nasıl davranıyor?
- Butonlar mobilde erişilebilir mi?
- Action bar (alt kısım) mobilde görünüyor mu?

### B. Loading/empty states
- Cutline yüklenirken spinner var mı?
- API hata döndüğünde kullanıcıya ne gösteriliyor?
- Preview URL fetch timeout olursa ne oluyor?

### C. Tab geçişleri
- Bıçak → Tasarım → Zemin → CMYK tab'ları arası geçiş smooth mu?
- Her tab'ın empty state'i var mı?
- CMYK tab'ında simülasyon yoksa ne gösteriyor?

### D. Onayla/Düzenle akışı
- "Bu ürünü onayla" → API çağrısı başarılı mı?
- "Bıçağı düzenle" → POC editör açılıyor mu?
- "Ekibimizden yardım iste" → modal açılıyor mu, form çalışıyor mu?

### E. Multi-item sipariş
- 2+ item'lı siparişte sol panelden item seçimi çalışıyor mu?
- Item seçince preview güncelleniyor mu?
- Tüm item'lar onaylanınca finalize çalışıyor mu?

---

## ÖNCEKİ GÖREV DOSYASI

`CURSOR-GOREVLER-ONAY-SAYFASI.md` dosyasında 12 detaylı görev zaten var. Bu dosyadaki tespitlerle birleştir:
- Görev 1 (onayla disabled) → Sorun 5 ile aynı
- Görev 2 (düzenle disabled) → ilgili
- Görev 3 (SLA state) → ilgili
- Görev 5 (Pim mesajı) → Sorun 4 ile aynı

**Önce bu dosyadaki 6 sorunu düzelt, sonra ONAY-SAYFASI.md'deki kalan görevleri uygula.**

---

## UYGULAMA

Her fix sonrası: `npx tsc --noEmit` + commit (`fix(onay):` prefix)

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
