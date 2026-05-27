`src/app/onay/[orderId]/duzenle/[itemId]/page.tsx` ve `public/poc.html` dosyalarını oku ve aşağıdaki düzeltmeleri yap:

## Sorun 1: POC sol panel gereksiz gösteriliyor
POC iframe'e tasarım `pim-load-design` postMessage ile gönderiliyor. Ama POC hala "Dosya yükle veya sürükle" alanını gösteriyor. POC'a yeni URL parametresi ekle: `hideUpload=1`. Bu parametre varsa:
- "DOSYA" bölümünü (dosya yükleme alanı) tamamen gizle
- "AI ile arka planı kaldır" butonunu gizle
- Tasarım otomatik geldiği için kullanıcının manuel yüklemesine gerek yok

## Sorun 2: Malzeme tipi seçimi kilitli olmalı
POC'ta "MALZEME TİPİ" seçimi var ama kullanıcı konfigüratörde zaten seçmiş. POC'a `lockMaterial=1` parametresi ekle. Bu parametre varsa:
- Malzeme butonlarını disabled/readonly yap (tıklanamaz)
- Aktif malzeme `material` URL parametresinden gelsin (zaten geliyor)
- Görsel olarak seçili ama gri/kilitli görünsün

## Sorun 3: DPI slider gereksiz
POC'ta "GÖRÜNTÜ ÇÖZÜNÜRLÜĞÜ" slider'ı var. Kullanıcının bunu değiştirmesine gerek yok — dosyanın gerçek DPI'ı neyse o kullanılmalı. `hideDpi=1` parametresi ekle, bu varsa DPI bölümünü gizle.

## Sorun 4: Çift scroll sorunu
Sayfa scroll'u + iframe kendi scroll'u = kötü UX. iframe'i tam viewport yüksekliğinde yap:
- `duzenle/[itemId]/page.tsx`'te iframe class'ını değiştir:
  - ESKİ: `h-[min(calc(100vh-280px),900px)] min-h-[480px]`
  - YENİ: `h-[calc(100vh-200px)] min-h-[600px]`
- Üst header + Pim mesajını kompakt yap (daha az yer kaplasın)
- `overflow-hidden` ekleyerek sayfa seviyesi scroll'u minimize et

## Sorun 5: "Kaydet ve dön" butonu sayfa seviyesinde olmalı
POC içindeki kaydet butonu küçük ve fark edilmiyor. iframe'in altına büyük bir "Kaydet ve dön" butonu ekle:
```tsx
<div className="mt-4 flex justify-end gap-3">
  <Button variant="ghost" size="md" href={`/onay/${orderId}`}>
    İptal — onay sayfasına dön
  </Button>
  <Button
    variant="primary"
    size="md"
    onClick={() => {
      // POC'a export tetikle
      iframeRef.current?.contentWindow?.postMessage({ type: "pim-request-export" }, "*");
    }}
    disabled={saving}
  >
    {saving ? "Kaydediliyor..." : "Kaydet ve dön"}
  </Button>
</div>
```

## Sorun 6: "Ekibimizden yardım iste" butonu eksik
Bu sayfada yardım isteme seçeneği yok. Alt buton grubuna ekle:
```tsx
<Button variant="secondary" size="sm" onClick={() => router.push(`/onay/${orderId}`)}>
  Ekibimizden yardım iste
</Button>
```
Veya doğrudan help modal aç (onay sayfasındaki gibi).

## Sorun 7: buildPocIframeSrc'ye yeni parametreler ekle
`src/lib/proof/build-poc-iframe-src.ts` dosyasında URL builder'a yeni parametreleri ekle:
```typescript
// Mevcut parametrelere ekle:
params.set("hideUpload", "1");    // Dosya yükleme alanını gizle
params.set("lockMaterial", "1");  // Malzeme seçimini kilitle
params.set("hideDpi", "1");       // DPI slider'ı gizle
```

## POC HTML Değişiklikleri
`public/poc.html` dosyasında URL parametrelerini oku ve ilgili bölümleri gizle:
```javascript
const params = new URLSearchParams(window.location.search);
const hideUpload = params.get("hideUpload") === "1";
const lockMaterial = params.get("lockMaterial") === "1";
const hideDpi = params.get("hideDpi") === "1";

// DOM ready sonrası:
if (hideUpload) {
  document.querySelector(".dosya-section")?.style.display = "none";
  // veya ilgili section'ın class/id'sine göre gizle
}
if (lockMaterial) {
  document.querySelectorAll(".material-btn").forEach(btn => {
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.5";
  });
}
if (hideDpi) {
  document.querySelector(".dpi-section")?.style.display = "none";
}
```
NOT: poc.html'deki gerçek selector'ları bul — yukarıdakiler örnek. Dosyayı oku, doğru selector'ları kullan.

Her fix sonrası `npx tsc --noEmit` + commit yap.
