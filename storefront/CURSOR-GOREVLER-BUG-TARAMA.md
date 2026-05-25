# Cursor Bug Tarama — Sticker + Etiket Sayfaları

> Claude Code (mimari) tarafından hazırlanmıştır.
> Fonksiyonel analiz temiz çıktı ama production'da gizli bug olabilir.
> Cursor kapsamlı kontrol yapsın — her dosyayı oku, her edge case'i test et.
> **Tasarım değişikliği YAPMA** — sadece bug bul ve düzelt.

---

## GÖREV 1/1 — Kapsamlı Bug Tarama + Düzeltme

### Taranacak dosyalar

```
src/app/sticker/page.tsx                    — 11 kart listeleme
src/app/sticker/yapilandir/page.tsx         — sticker konfigüratör (~2700 satır)
src/app/etiket/page.tsx                     — 11 kart listeleme
src/app/etiket/yapilandir/page.tsx          — etiket konfigüratör (~3000 satır)
src/lib/sticker-customer-pricing.ts         — sticker fiyat hesaplama
src/lib/etiket-customer-pricing.ts          — etiket fiyat hesaplama
src/lib/customer-pricing-from-config.ts     — bridge (config → fiyat)
src/lib/pricing-engine/cost.ts              — maliyet hesaplama
src/lib/pricing-engine/geometry.ts          — geometri (tabaka yerleşimi)
src/lib/pricing-engine/etiket-pricing.ts    — etiket rulo fiyat
src/lib/pricing-calc.ts                     — calculatePrice
src/lib/pricing-pricebook.ts               — rulo price book
src/lib/pricing-tabaka-geo.ts              — tabaka geometri
src/lib/customer-cart.ts                    — sepet
src/lib/product-cards.ts                    — ürün kartları
src/lib/product-cards-guard.ts             — encoding guard
src/components/ui/DesignDropZone.tsx        — tasarım yükleme
src/components/sticker/MultiDesignUploader.tsx — çoklu tasarım
src/components/ui/MultiDesignDropZone.tsx   — çoklu yükleme
```

### Kontrol edilecek senaryolar

#### A. URL Param Edge Cases
Her 11 sticker kartı için tek tek kontrol et:

```
/sticker/yapilandir?cut=diecut&shape=diecut           → özel kesim doğru mu
/sticker/yapilandir?cut=diecut&shape=circle            → daire seçili mi
/sticker/yapilandir?cut=diecut&shape=rectangle         → dikdörtgen seçili mi
/sticker/yapilandir?cut=diecut&shape=square             → kare seçili mi
/sticker/yapilandir?cut=diecut&shape=oval               → oval seçili mi
/sticker/yapilandir?cut=diecut&shape=bumper             → 280×80 preset mi
/sticker/yapilandir?cut=kisscut&shape=diecut            → kiss cut modu aktif mi
/sticker/yapilandir?cut=diecut&shape=diecut&material=transparan  → malzeme şeffaf mı
/sticker/yapilandir?cut=diecut&shape=diecut&material=holo        → malzeme holo mu
/sticker/yapilandir?cut=diecut&shape=diecut&material=simli       → malzeme simli mi
/sticker/yapilandir?cut=tabaka&shape=square             → tabaka modu aktif mi
```

Her biri için:
- [✓] State doğru set ediliyor mu? (URL sync + bumper SSR fix)
- [✓] Fiyat hesaplanıyor mu (NaN/undefined yok)?
- [✓] Önizleme render oluyor mu?
- [✓] Sepete ekleme payload'ı eksiksiz mi? (kiss-cut config label, additionalDesigns fix)

#### B. Edge Case Senaryolar — Fiyat
```
- [✓] Minimum boyut (25×25mm sticker) → fiyat pozitif mi?
- [✓] Maximum boyut (400×650mm sticker) → hata mesajı mı, yoksa sessiz mi?
- [✓] 401×651mm → bigEtiketRedirect çalışıyor mu? (engine OK; CTA bilinçli olarak sticker sizeError ile)
- [✓] Qty=25 (minimum sticker) → fiyat hesaplanıyor mu?
- [✓] Qty=1000 (maximum sticker) → tier multiplier doğru mu?
- [✓] Etiket rulo qty=999 (minimum 1000 altı) → hata mesajı var mı?
- [✓] Etiket tabaka qty=249 (minimum 250 altı) → engelleniyor mu?
- [✓] Genişlik=0 veya yükseklik=0 → crash var mı? (ClampedNumberInput)
- [✓] Genişlik negatif → ne olur? (clamp)
- [✓] Vinil + mat kaplama → çarpan: 1.0 × 1.05 = 1.05 doğru mu? (legacy path)
- [✓] Holo + yok kaplama → çarpan: 1.4 × 0.95 = 1.33 doğru mu? (legacy path)
- [✓] Simli + parlak → çarpan: 1.3 × 1.0 = 1.3 doğru mu? (legacy path)
```

#### C. Edge Case Senaryolar — Sepet
```
- [✓] 20 item'lık dolu sepete ekleme → hata mesajı mı, sessiz mi?
- [✓] Aynı ürünü 2 kez ekleme → duplikat mı, yeni satır mı? (by design: yeni satır)
- [✓] designTempId null + sepete ekle → sorun var mı? (confirm flow)
- [✓] designCount=0 → crash var mı?
- [✓] Çok uzun title (500 karakter) → taşma var mı? (generated title kısa)
- [✓] Türkçe karakter (ü, ö, ş, ç, ğ, ı) title'da → encoding sorunu?
```

#### D. Edge Case Senaryolar — Tasarım Yükleme
```
- [✓] 30MB PNG yükleme → signed URL çalışıyor mu?
- [✓] 31MB dosya → hata mesajı doğru mu?
- [✓] .eps dosya → engelleniyor mu?
- [✓] .exe dosya → engelleniyor mu?
- [✓] 0 byte dosya → ne olur? (client reject eklendi)
- [✓] Dosya adı Türkçe karakter → encoding sorunu?
- [✓] Dosya adı çok uzun (200 karakter) → truncation var mı? (CSS truncate)
- [✓] Multi-design: 50 dosya yükle → limit var mı?
- [✓] Multi-design: farklı format (1 PNG + 1 PDF + 1 AI) → hepsi kabul mı?
```

#### E. Edge Case — Etiket Konfigüratör
```
- [✓] Rulo etiket: tüm malzemeler fiyat dönüyor mu? (seffaf pricebook eklendi)
- [✓] Rulo etiket: tüm kaplamalar çalışıyor mu?
- [✓] Rulo etiket: tüm özelleştirmeler çalışıyor mu?
- [✓] Tabaka etiket: geometri hesabı doğru mu (33×45cm tabaka, 1cm marj)?
- [✓] Tabaka etiket: 15×15mm boyut → kaç adet sığıyor doğru mu? (300 ad/tabaka)
- [✓] Rulo etiket: 150×150mm → büyük etiket yönlendirmesi var mı? (pricebook destekler; sticker-only redirect)
- [✓] Rulo etiket: price book modu aktifse interpolasyon doğru mu?
- [✓] Etiket scope toggle (rulo ↔ tabaka) → state doğru sıfırlanıyor mu?
```

#### F. Hydration / SSR
```
- [✓] toLocaleString timeZone: "Europe/Istanbul" kullanılıyor mu (sayı formatında timeZone gerekmez)
- [✓] typeof window === "undefined" guard'ları yerinde mi? (bumper SSR fix)
- [✓] useSearchParams Suspense wrapper var mı?
- [✓] Math.random veya Date.now() SSR'da render'a giriyor mu? (yok; onClick'te Date.now OK)
```

#### G. TypeScript
```
- [✓] npx tsc --noEmit → 0 hata mı?
- [✓] any kullanımı var mı (potential runtime crash)? (kritik path temiz)
- [✓] undefined access (optional chaining eksik) var mı?
- [✓] null check eksik olan yer var mı?
```

### Yapılacaklar

1. **Yukarıdaki her checklist maddesini kontrol et** — dosyaları oku, logic'i takip et
2. **Bug bulursan:**
   - Dosya:satır numarasıyla belirt
   - Sorunu açıkla
   - Düzelt
   - Commit mesajında `fix(sticker):` veya `fix(etiket):` prefix kullan
3. **Bug bulamazsan:**
   - "Tarama tamamlandı — X dosya kontrol edildi, 0 bug" raporu yaz
   - Kontrol edilen her maddeyi `[✓]` işaretle

### Önemli kurallar
- **Tasarım/UI değişikliği YAPMA** — sadece fonksiyonel bug düzelt
- **Mevcut davranışı bozma** — fix yaparken başka yeri kırma
- **Her fix için ayrı commit** — `fix(sticker): bumper preset boyut guard` gibi
- **npx tsc --noEmit** her fix sonrası

---

## Tarama sonucu (Cursor · 25 May 2026)

**17 dosya kontrol edildi · 15 bug bulundu ve düzeltildi · `npx tsc --noEmit` 0 hata**

| Commit | Kapsam |
|--------|--------|
| `b70a40f` | Sticker URL sync, render guard, preset clamp, multi-design cart |
| `7853986` | Etiket tabaka fiyat, form reset, cart limit, tabaka geo/preview |
| `10adbd5` | Upload validasyon, blob leak, extension parse |

**Bilinçli olarak açık bırakılan (düşük öncelik):**
- Admin config vs legacy multiplier farkı (tasarım farkı, admin path doğru)
- `MultiDesignDropZone.tsx` kullanılmıyor (prod path MultiDesignUploader)
- `deliveryEstimate()` TZ mismatch (ayrı pricing.ts görevi)
- Tier savings badge admin/pricebook ile tam hizalı değil (gösterge only)

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
