# Cursor Tasarım Yükleme Sayfası UX İyileştirmeleri

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/siparis/[id]/tasarim-yukle/page.tsx` (630 satır)
> 10 görev — sadece UX/UI, iş mantığına dokunma
> **ÖNCELİK:** CURSOR-GOREVLER-TASARIM-YUKLE-FIX.md (donma fix) ÖNCE yapılmalı

---

## GÖREV 1/10 — Upload Progress Göstergesi (P1)

### Sorun
Dosya yüklenirken "Yükleniyor..." yazıyor, hiçbir ilerleme yok. 15MB PNG'de müşteri dondu sanıyor.

### Değişiklik

Upload state'e progress ekle:

```typescript
const [uploadProgress, setUploadProgress] = useState(0);
```

`handleFileSelect` fonksiyonunda (satır ~163-253), Supabase Storage PUT yerine XMLHttpRequest veya fetch progress kullan:

```typescript
// Adım 2: PUT signed URL — progress tracking ile
// Supabase SDK progress desteklemiyor, XHR kullan:

const uploadWithProgress = (url: string, file: File, token: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
};
```

NOT: Supabase `uploadToSignedUrl` yerine direkt XHR kullanmak gerekiyor çünkü SDK progress callback desteklemiyor. Alternatif: `supabase.storage.from().upload()` ile `x-upsert` header — ama bu da progress yok. XHR en güvenli yol.

Eğer XHR karmaşık gelirse basit yaklaşım: **sahte progress bar** (indeterminate):

```typescript
// Basit yaklaşım — gerçek progress yerine animasyonlu bar:
<div className="mt-2 h-1.5 w-full rounded-full bg-gri-100 overflow-hidden">
  <div className="h-full bg-pim-mercan rounded-full animate-progress-indeterminate" />
</div>
```

CSS (`globals.css`):
```css
@keyframes progress-indeterminate {
  0% { width: 0%; margin-left: 0%; }
  50% { width: 40%; margin-left: 30%; }
  100% { width: 0%; margin-left: 100%; }
}
.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}
```

Buton UI (upload sırasında):

```typescript
{isUploading ? (
  <div className="w-full">
    <Button variant="primary" size="md" disabled className="w-full">
      Yükleniyor... {uploadProgress > 0 ? `%${uploadProgress}` : ''}
    </Button>
    <div className="mt-2 h-1.5 w-full rounded-full bg-gri-100 overflow-hidden">
      {uploadProgress > 0 ? (
        <div
          className="h-full bg-pim-mercan rounded-full transition-all duration-300"
          style={{ width: `${uploadProgress}%` }}
        />
      ) : (
        <div className="h-full bg-pim-mercan rounded-full animate-progress-indeterminate" />
      )}
    </div>
    <p className="mt-1 text-[11px] text-gri-500 text-center">
      {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
    </p>
  </div>
) : (
  // Mevcut buton
)}
```

---

## GÖREV 2/10 — Yüklenen Dosya Önizleme (P1)

### Sorun
"✓ Tasarım yüklendi" rozeti var ama dosyanın küçük resmi görünmüyor.

### Değişiklik

Upload başarılı olduğunda önizleme URL'ini sakla:

```typescript
// State:
const [previews, setPreviews] = useState<Record<string, { name: string; previewUrl: string; size: number }>>({}); 

// handleFileSelect başarılı olduğunda (toast.success satırından sonra):
if (file.type.startsWith('image/')) {
  const previewUrl = URL.createObjectURL(file);
  setPreviews(prev => ({
    ...prev,
    [item.id]: { name: file.name, previewUrl, size: file.size },
  }));
}
```

Item kartında "✓ Tasarım yüklendi" rozetinin yanına:

```typescript
{isComplete && previews[item.id] && (
  <div className="mt-3 flex items-center gap-3">
    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gri-100 ring-1 ring-gri-200 shrink-0">
      <img
        src={previews[item.id].previewUrl}
        alt="Yüklenen tasarım"
        className="w-full h-full object-contain"
      />
    </div>
    <div className="text-[12px] text-gri-700">
      <div className="font-medium text-lacivert truncate max-w-[200px]">
        {previews[item.id].name}
      </div>
      <div>{(previews[item.id].size / 1024 / 1024).toFixed(1)} MB</div>
    </div>
  </div>
)}

{/* PDF/AI/PSD için önizleme yok — dosya adı göster */}
{isComplete && !previews[item.id] && (
  <div className="mt-3 flex items-center gap-2 text-[12px] text-gri-700">
    <span className="w-10 h-10 rounded-lg bg-gri-100 grid place-items-center text-gri-500 shrink-0">📄</span>
    <span className="truncate max-w-[200px]">{/* dosya adı state'te saklanmalı */}</span>
  </div>
)}
```

---

## GÖREV 3/10 — Dosya Değiştirme / Silme (P1)

### Sorun
Yanlış dosya yüklediyse değiştiremez.

### Değişiklik

"✓ Tasarım yüklendi" rozetinin yanına "Değiştir" butonu ekle:

```typescript
{isComplete && (
  <div className="flex items-center gap-2 mt-2">
    <p className="inline-flex items-center gap-1 rounded-full bg-yesil-soft px-3 py-1 text-xs font-medium text-yesil">
      ✓ {isMulti ? `${required} tasarım yüklendi` : "Tasarım yüklendi"}
    </p>
    <button
      type="button"
      onClick={() => fileInputs.current[item.id]?.click()}
      disabled={isUploading}
      className="text-[11px] font-semibold text-pim-mercan hover:underline"
    >
      Değiştir
    </button>
  </div>
)}
```

Mevcut hidden file input (satır 577-589) zaten tamamlanmış item'lar için de var ama buton gösterilmiyor. Sadece "Değiştir" link'i ekliyoruz.

"Değiştir" tıklanınca → yeni dosya seçilir → eski dosyanın üzerine yazılır (veya yeni versiyon olarak eklenir). `designsComplete` geçici false olur → upload tamamlanınca tekrar true.

---

## GÖREV 4/10 — Drag & Drop Desteği (P1)

### Sorun
Sadece buton tıkla + file picker. Sürükle bırak yok.

### Değişiklik

Her item kartını drop zone yap:

```typescript
function ItemDropZone({ 
  item, 
  isUploading, 
  onDrop, 
  children 
}: { 
  item: OrderItem; 
  isUploading: boolean;
  onDrop: (file: File) => void; 
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card
      className={cn(
        "p-5 transition-all",
        dragOver && !isUploading && "ring-2 ring-pim-mercan bg-pim-mercan-tint/10",
        item.designsComplete && "bg-yesil-soft/10",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isUploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (isUploading) return;
        const file = e.dataTransfer.files[0];
        if (file) onDrop(file);
      }}
    >
      {dragOver && !isUploading && (
        <div className="absolute inset-0 rounded-xl bg-pim-mercan/5 border-2 border-dashed border-pim-mercan flex items-center justify-center z-10 pointer-events-none">
          <span className="text-pim-mercan font-semibold text-sm">
            Dosyayı buraya bırak
          </span>
        </div>
      )}
      {children}
    </Card>
  );
}
```

Mevcut `<Card>` yerine `<ItemDropZone>` kullan:

```typescript
<ItemDropZone
  item={item}
  isUploading={isUploading}
  onDrop={(file) => void handleFileSelect(item, file)}
>
  {/* Mevcut kart içeriği */}
</ItemDropZone>
```

---

## GÖREV 5/10 — Türkçe Karakter Düzeltmesi (P1)

### Sorun
Sayfadaki metinler Türkçe karakter eksik: "Tum", "tasarim", "urun", "Yukleniyor", "yuklendi" vb.

### Değişiklik

Dosyada tüm bozuk Türkçe metinleri düzelt. `Ctrl+H` ile toplu replace:

```
Tum tasarimlar → Tüm tasarımlar
tasarim yukle → tasarım yükle
tasarim yuklendi → tasarım yüklendi
Tasarim yukle → Tasarım yükle
Yukleniyor → Yükleniyor
urun → ürün
Odemeni aldik → Ödemeni aldık
tesekkurler → teşekkürler
Simdi → Şimdi
bicak cikarimi → bıçak çıkarımı
icinde → içinde
kalan → kalan (bu doğru)
yuklendi → yüklendi
baslar → başlar
olacak → olacak (doğru)
Dosyani yuklemeni → Dosyanı yüklemeni
bekliyorum → bekliyorum (doğru)
Sifir kayip → Sıfır kayıp
destekleniyor → destekleniyor (doğru)
otomatik → otomatik (doğru)
Siparis → Sipariş
urunde → üründe
```

Dosyadaki HER string'i kontrol et. Hardcoded Türkçe metinlerin tamamını düzelt.

NOT: i18n key'ler DOKUNMA — sadece hardcoded string'ler.

---

## GÖREV 6/10 — Format + Boyut Bilgisi Belirgin Göster (P2)

### Sorun
Desteklenen format ve boyut limiti sadece Pim mesajında küçük yazıyla.

### Değişiklik

Her item kartının upload butonunun ALTINA format bilgisi ekle:

```typescript
{!isComplete && (
  <div className="mt-2 text-[11px] text-gri-500 text-right">
    PNG · JPG · PDF · SVG · AI · PSD — max 30 MB
  </div>
)}
```

Veya upload butonunun altında (küçük, dikkat dağıtmayan):

```typescript
<p className="mt-1.5 text-[10.5px] text-gri-400">
  Desteklenen: PNG, JPG, PDF, SVG, AI, PSD · max 30 MB
</p>
```

---

## GÖREV 7/10 — İpucu Kutusunu Üste Taşı (P2)

### Sorun
"Her ürün için sadece 1 tasarım yeterli" ipucu sayfanın en altında — müşteri görmeden yüklemeye başlıyor.

### Değişiklik

Satır 622-626'daki ipucu kutusunu sayfanın üstüne taşı — Pim mesajı kartının ALTINA, item listesinin ÜSTÜNE:

```typescript
{/* Sıra: Pim mesajı → İpucu → Progress bar → Item listesi */}

{/* Pim mesajı (mevcut satır 342-355) */}

{/* İpucu kutusu — BURAYA TAŞI */}
<div className="mb-4 rounded-lg border border-gri-200 bg-gri-50 p-3 text-[12.5px] text-gri-700 flex items-start gap-2">
  <span className="text-base shrink-0">💡</span>
  <div>
    <strong>İpucu:</strong> Her ürün için en az 1 tasarım yükle. Birden fazla tasarım
    gerekiyorsa buton tekrar tıklanabilir. Şeffaf arka plan için PNG formatını tercih et.
  </div>
</div>

{/* Progress bar (mevcut satır 360-400) */}
{/* Item listesi (mevcut satır 402+) */}
```

Sayfanın altındaki eski ipucu kutusunu SİL (satır 622-626).

---

## GÖREV 8/10 — Tamamlanan vs Bekleyen Item Görsel Ayrımı (P2)

### Sorun
Tamamlanan ve bekleyen itemler aynı boyut/stil — farkı bulmak zor.

### Değişiklik

Tamamlanan item kartına `opacity` + küçük boyut + yeşil sol kenar:

```typescript
<ItemDropZone ...>
  <div className={cn(
    "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
    isComplete && "opacity-70",
  )}>
    {/* Sol kenar çizgisi */}
    <div className={cn(
      "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
      isComplete ? "bg-yesil" : pendingCount > 0 ? "bg-pim-mercan" : "bg-gri-200"
    )} />
    
    {/* Mevcut içerik */}
  </div>
</ItemDropZone>
```

`Card` component'e `relative overflow-hidden` ekle (sol kenar çizgisi için).

Bekleyen item'larda CTA butonunu daha belirgin yap:

```typescript
{!isComplete && (
  <Button
    variant="primary"
    size="lg"       // md → lg (daha büyük, dikkat çekici)
    onClick={...}
    disabled={isUploading}
    className="w-full sm:w-auto"
  >
    📁 {buttonLabel}
  </Button>
)}
```

---

## GÖREV 9/10 — Redistribute Sadeleştirme (P2)

### Sorun
"Bu tasarımdan vazgeç → adet aktar" açıklaması teknik — müşteri anlamıyor.

### Değişiklik

Redistribute bölümünü (satır 498-568) sadeleştir:

```typescript
// ESKİ:
// "Bu tasarımdan vazgeç → ({item.qty} adetini başka tasarımına aktar, iade yok)"

// YENİ:
<button type="button" onClick={...} className="...">
  Bu tasarımı iptal et
  <span className="font-normal text-gri-500 block text-[11px] mt-0.5">
    {item.qty} adet diğer ürünlere dağıtılır
  </span>
</button>
```

Modal açıklamasını sadeleştir:

```typescript
// ESKİ: "{item.qty} adet hangi tasarıma aktarılsın?"
// YENİ:
<div className="text-[13px] font-semibold text-lacivert mb-2">
  Hangi ürüne aktarmak istiyorsun?
</div>
<p className="text-[11.5px] text-gri-500 mb-3">
  Bu ürünün {item.qty} adeti seçtiğin ürüne eklenecek.
</p>
```

---

## GÖREV 10/10 — Mobil Düzen (P3)

### Sorun
Mobilde buton + kart düzeni sıkışık, sipariş numarası uzun.

### Değişiklik

Sipariş numarası kısalt:

```typescript
// ESKİ:
<Eyebrow>SİPARİŞ #{orderId}</Eyebrow>

// YENİ — uzunsa son 8 karakter:
<Eyebrow>
  SİPARİŞ #{orderId.length > 12 ? '...' + orderId.slice(-8) : orderId}
</Eyebrow>
```

Item kartlarında mobil düzen:

```typescript
// Mevcut: flex-col gap-3 sm:flex-row
// Mobilde buton tam genişlik olsun:

<Button ... className="w-full sm:w-auto">
  📁 {buttonLabel}
</Button>
```

Progress bar altındaki metin mobilde wrap olmasın:

```typescript
<div className="mt-1.5 flex flex-col sm:flex-row justify-between gap-1 text-[11.5px] text-gri-700">
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Upload progress göstergesi | 30 dk |
| 2 | Yüklenen dosya önizleme | 20 dk |
| 3 | Dosya değiştir butonu | 10 dk |
| 4 | Drag & drop desteği | 25 dk |
| 5 | Türkçe karakter düzeltmesi | 15 dk |
| 6 | Format + boyut bilgisi belirgin | 5 dk |
| 7 | İpucu kutusunu üste taşı | 5 dk |
| 8 | Tamamlanan vs bekleyen görsel ayrım | 15 dk |
| 9 | Redistribute sadeleştirme | 10 dk |
| 10 | Mobil düzen | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
