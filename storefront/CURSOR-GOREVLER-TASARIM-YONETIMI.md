# Cursor — Item Bazlı Tasarım Yönetimi İyileştirme

> Claude Code (mimari) tarafından hazırlanmıştır · 26 May 2026
> Dosya: `src/app/siparis/[id]/tasarim-yukle/page.tsx`
> Dosya: `src/app/siparis/[id]/page.tsx`
> Kullanıcı 5 ürün + 5 tasarım yükledi, 1 tanesini değiştirmek veya eksik yüklemek istiyor.

---

## MEVCUT DURUM

Tasarım yükleme sayfası (`/siparis/[id]/tasarim-yukle`) zaten item bazlı çalışıyor:
- Her item için ayrı upload slot'u var
- Multi-design desteği var (designsRequired > 1)
- "Değiştir" butonu var (satır 691-698)
- Progress bar var (uploaded / required)

## SORUNLAR

### 1. "Değiştir" butonu sadece designsComplete olduktan sonra görünüyor
Satır 683: `{isComplete && (` → Kullanıcı tamamlanmış bir item'ın tasarımını değiştirmek istiyorsa butonu görebilir. AMA:
- Hangi tasarımı değiştirdiği belli değil (multi-design'da)
- Yeni yükleme eski dosyayı `superseded` yapıyor mu yoksa ek dosya mı ekliyor?

### 2. Tamamlanmış ürünlerde "Değiştir" yetersiz
- "Değiştir"e tıklayınca dosya seçim penceresi açılıyor ama hangi design_file'ın değiştirildiği belirsiz
- Kullanıcıya hangi dosyayı değiştirdiği gösterilmiyor
- Eski dosyanın adı/önizlemesi görünmüyor

### 3. Kısmen yüklü durumda sayfaya dönüş
Kullanıcı 3/5 tasarım yükledi, tarayıcıyı kapattı, sonra geri geldi:
- Sayfa `upload-status` API'den mevcut durumu doğru alıyor mu?
- Yüklü dosyaların önizlemeleri görünüyor mu? (Sadece bu session'da yüklenenler `uploadedFiles` state'inde)
- Kalan slot'lar doğru gösteriliyor mu?

### 4. Sipariş detay sayfasından tasarım değiştirme
`/siparis/[id]` sayfasında "Tasarım dosyası" bölümünde mevcut dosyalar listeleniyor ama:
- "Yeni versiyon yükle" → `/tasarim-yukle`'ye yönlendiriyor, spesifik item değil
- Hangi item'ın tasarımını değiştirmek istediği belli değil

---

## GÖREV 1/5 — Yüklü Tasarımların Önizlemesini API'den Göster

### Sorun
`uploadedFiles` state'i sadece bu oturumdaki yüklemeleri tutuyor. Kullanıcı sayfayı yenilerse veya sonra gelirse boş. API'den gelen `upload-status`'ta dosya bilgisi var ama önizleme URL'i yok.

### Fix

`/api/orders/[id]/upload-status/route.ts`'i güncelle — her item için mevcut design_files bilgisini döndür:

```typescript
// upload-status response'a ekle:
interface ItemDesignFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string; // uploaded, analyzing, qc_passed, qc_failed, etc.
  previewUrl?: string; // signed URL (thumb)
  uploadedAt: string;
}

// Her item'a:
designFiles: ItemDesignFile[]
```

Sonra tasarım yükleme sayfasında her item'ın mevcut dosyalarını göster:

```typescript
// Item kartında, isComplete bloğundan ÖNCE:
{item.designFiles && item.designFiles.length > 0 && (
  <div className="mt-3 space-y-2">
    {item.designFiles.map((df) => (
      <div key={df.id} className="flex items-center gap-3 text-[12px]">
        {df.previewUrl && (
          <img src={df.previewUrl} className="w-10 h-10 rounded object-contain bg-gri-100" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{df.fileName}</div>
          <div className="text-gri-500">
            {(df.sizeBytes / 1024 / 1024).toFixed(1)} MB · {df.status === "qc_passed" ? "✅ Kontrol geçti" : df.status === "qc_failed" ? "❌ Sorun bulundu" : "⏳ Kontrol ediliyor"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleReplaceDesign(item, df.id)}
          className="text-[11px] font-semibold text-pim-mercan hover:underline"
        >
          Değiştir
        </button>
      </div>
    ))}
  </div>
)}
```

---

## GÖREV 2/5 — Tasarım Değiştirme (Replace) Akışı

### Sorun
Mevcut "Değiştir" butonu yeni dosya ekliyor — eski dosyayı `superseded` yapmıyor. Multi-design'da hangi slot'un değiştirildiği belirsiz.

### Fix

Yeni `handleReplaceDesign` fonksiyonu:

```typescript
async function handleReplaceDesign(item: OrderItem, oldFileId: string) {
  // Dosya seçim dialogu aç
  const input = document.createElement("input");
  input.type = "file";
  input.accept = FILE_ACCEPT;
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Mevcut handleFileSelect'i çağır ama ek parametre ile
    await handleFileSelect(item, file, oldFileId);
  };
  input.click();
}
```

`handleFileSelect`'e `replaceFileId` parametresi ekle:

```typescript
async function handleFileSelect(item: OrderItem, file: File, replaceFileId?: string) {
  // ... mevcut validasyon ...

  // upload-init'e replaceFileId gönder
  const initRes = await fetch("/api/design/upload-init", {
    method: "POST",
    body: JSON.stringify({
      orderId,
      orderItemId: item.id,
      originalName: file.name,
      sizeBytes: file.size,
      mimeType: mimeType ?? "application/pdf",
      replaceFileId, // YENİ — eski dosyayı superseded yap
    }),
  });
  // ...
}
```

`/api/design/upload-init/route.ts`'te `replaceFileId` varsa eski dosyayı `superseded` yap:

```typescript
if (replaceFileId) {
  await admin
    .from("design_files")
    .update({ status: "superseded" })
    .eq("id", replaceFileId)
    .eq("order_item_id", orderItemId);
}
```

---

## GÖREV 3/5 — Eksik Tasarım Yüklemeye Sonra Dönme

### Sorun
Kullanıcı 3/5 tasarım yükledi, çıktı, sonra geri geldi. Sayfa doğru state'i göstermeli.

### Fix
Bu zaten çoğunlukla çalışıyor (`upload-status` API mevcut durumu döndürüyor). Kontrol et:

1. `upload-status` API'de `designsUploaded` doğru hesaplanıyor mu?
2. `designsComplete` doğru mu?
3. Kalan slot'lar doğru gösteriliyor mu?
4. Yüklü dosyaların önizlemesi görünüyor mu? (GÖREV 1'de düzeltiliyor)

---

## GÖREV 4/5 — Sipariş Detay'dan Spesifik Item Tasarım Değiştirme

### Dosya
`src/app/siparis/[id]/page.tsx`

### Sorun
"Tasarım dosyası" bölümünde "Yeni versiyon yükle" linki `/tasarim-yukle`'ye gidiyor ama hangi item için olduğu belli değil. 5 item'lı siparişte kullanıcı 2. item'ı değiştirmek istiyor ama sayfa en baştan gösteriyor.

### Fix
Link'e item ID query parametresi ekle:

```typescript
// Mevcut:
href={`/siparis/${orderId}/tasarim-yukle`}

// YENİ:
href={`/siparis/${orderId}/tasarim-yukle?item=${item.id}`}
```

Tasarım yükleme sayfasında bu parametreyi oku ve o item'a scroll + highlight:

```typescript
const searchParams = useSearchParams();
const focusItemId = searchParams.get("item");

useEffect(() => {
  if (focusItemId && order) {
    const el = document.getElementById(`upload-item-${focusItemId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-pim-mercan");
      setTimeout(() => el.classList.remove("ring-2", "ring-pim-mercan"), 3000);
    }
  }
}, [focusItemId, order]);

// Her item kartına id ekle:
<ItemDropZone id={`upload-item-${item.id}`} ...>
```

---

## GÖREV 5/5 — QC Başarısız Olmuş Tasarımı Düzeltme UX

### Sorun
AI QC bir tasarımı reddettiğinde (`qc_failed`) kullanıcıya ne olduğu ve ne yapması gerektiği net gösterilmiyor.

### Fix
Item kartında QC failed durumunu göster:

```typescript
// GÖREV 1'deki designFiles render'ında:
{df.status === "qc_failed" && df.qcMessage && (
  <div className="mt-1 p-2 rounded bg-kirmizi-soft/30 text-[11px] text-kirmizi">
    <strong>AI uyarısı:</strong> {df.qcMessage}
    <button
      onClick={() => handleReplaceDesign(item, df.id)}
      className="ml-2 font-semibold underline"
    >
      Düzelt ve tekrar yükle
    </button>
  </div>
)}
```

`upload-status` API'de QC mesajını da döndür:

```typescript
// qc_failed dosyalar için:
qcMessage: df.ai_check?.flags?.[0]?.message ?? "Kalite kontrolden geçemedi"
```

---

## UYGULAMA SIRASI

| # | Görev | Dosya | Süre |
|---|-------|-------|------|
| 1 | Yüklü dosya önizleme | upload-status API + tasarim-yukle | 20 dk |
| 2 | Tasarım değiştirme (replace) | tasarim-yukle + upload-init API | 15 dk |
| 3 | Eksik tasarım dönüş | upload-status kontrol | 5 dk |
| 4 | Detay'dan item bazlı yönlendirme | siparis/[id] + tasarim-yukle | 10 dk |
| 5 | QC failed UX | upload-status + tasarim-yukle | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit (`feat(design-mgmt):` prefix)

---

## TEST

```
Senaryo A — 5 ürün, 3 tasarım yüklü, 2 eksik:
1. Sipariş ver (5 ürün) → ödeme yap
2. /tasarim-yukle → 3 tasarım yükle → 3/5 progress
3. Tarayıcıyı kapat, sonra aç
4. /tasarim-yukle → 3 yüklü dosya önizlemeli görünmeli ✅
5. Kalan 2 slot "Tasarım yükle" butonu olmalı ✅

Senaryo B — 1 tasarımı değiştirme:
1. 5/5 tasarım yüklü sipariş
2. /tasarim-yukle → 2. item'da "Değiştir" tıkla
3. Yeni dosya seç → eski superseded, yeni analyzing olmalı ✅
4. QC tekrar çalışmalı ✅

Senaryo C — QC failed düzeltme:
1. Tasarım yükle → AI QC reddetti
2. /tasarim-yukle → kırmızı uyarı mesajı + "Düzelt" butonu ✅
3. Yeni dosya yükle → QC tekrar ✅

Senaryo D — Detay'dan item bazlı yönlendirme:
1. /siparis/[id] → 3. item'da "Tasarım değiştir" tıkla
2. /tasarim-yukle?item=XXXXX → 3. item'a scroll + highlight ✅
```

---

*Hazırlayan: Claude Code (mimari) · 26 May 2026*
