# Otomatik Ölçü Algılama + Boyut UX İyileştirmeleri

## AMAÇ
Kullanıcı tasarımını yüklediğinde sistem **otomatik ölçüsünü algılasın**, "Boyut olarak kullanmak ister misiniz?" diye sorsun. Onaylanırsa ebat alanına otomatik girilsin. Ayrıca **genişlik ↔ yükseklik ters çevirme butonu** eklensin.

## SORUN
1. Şu anda tasarım upload (Step 7), boyut input'undan (Step 6) **sonra** geliyor → otomatik ölçüyü referans veremiyor
2. Upload edilen dosyanın boyutu hiç okunmuyor (`naturalWidth`, PDF page size, SVG viewBox vb.)
3. Ebat alanında W↔H ters çevirme butonu yok — müşteri elle silip yeniden yazıyor

## ÇÖZÜM — 4 GÖREV

İki dosya **paralel** değişecek (aynı görevleri her ikisinde de uygula):
- `src/app/etiket/yapilandir/page.tsx`
- `src/app/sticker/yapilandir/page.tsx`

Ortak component:
- `src/components/sticker/MultiDesignUploader.tsx`

---

### GÖREV 1/4 — Boyut Algılama Helper'ı

#### Dosya: `src/lib/design-dimensions.ts` (YENİ)

```typescript
export interface DetectedDimensions {
  widthMm: number;
  heightMm: number;
  source: 'png_pixel' | 'jpg_pixel' | 'svg_viewbox' | 'pdf_page' | 'unsupported';
  dpi?: number;          // pixel dosyalar için varsayım (default 300)
  confidence: 'exact' | 'estimated';  // PDF/SVG = exact, raster = estimated
}

const PT_TO_MM = 25.4 / 72;       // PDF point → mm
const PX_AT_300DPI_TO_MM = 25.4 / 300;

export async function detectFileDimensions(file: File): Promise<DetectedDimensions | null> {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));

  try {
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      return detectFromRaster(file, ext);
    }
    if (ext === '.svg') {
      return detectFromSvg(file);
    }
    if (ext === '.pdf') {
      return detectFromPdf(file);
    }
    // AI/PSD: client-side parse ağır → şimdilik 'unsupported'
    return { widthMm: 0, heightMm: 0, source: 'unsupported', confidence: 'exact' };
  } catch {
    return null;
  }
}

async function detectFromRaster(file: File, ext: string): Promise<DetectedDimensions> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    return {
      widthMm: Math.round(img.naturalWidth * PX_AT_300DPI_TO_MM),
      heightMm: Math.round(img.naturalHeight * PX_AT_300DPI_TO_MM),
      source: ext === '.png' ? 'png_pixel' : 'jpg_pixel',
      dpi: 300,
      confidence: 'estimated',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function detectFromSvg(file: File): Promise<DetectedDimensions> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('no svg root');
  
  // viewBox öncelikli
  const vb = svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  let w = 0, h = 0;
  if (vb && vb.length === 4) {
    w = vb[2]; h = vb[3];
  } else {
    w = parseFloat(svg.getAttribute('width') || '0');
    h = parseFloat(svg.getAttribute('height') || '0');
  }
  
  // SVG birimleri çoğunlukla px veya unitless — mm varsayımı
  // Eğer width="50mm" gibi yazıyorsa mm olarak al
  const widthAttr = svg.getAttribute('width') || '';
  const isMm = widthAttr.includes('mm');
  
  return {
    widthMm: isMm ? Math.round(w) : Math.round(w * PX_AT_300DPI_TO_MM),
    heightMm: isMm ? Math.round(h) : Math.round(h * PX_AT_300DPI_TO_MM),
    source: 'svg_viewbox',
    confidence: isMm ? 'exact' : 'estimated',
  };
}

async function detectFromPdf(file: File): Promise<DetectedDimensions> {
  // pdf-lib client-side parse
  const { PDFDocument } = await import('pdf-lib');
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error('no pages');
  const { width, height } = page.getSize();  // point cinsinden
  return {
    widthMm: Math.round(width * PT_TO_MM),
    heightMm: Math.round(height * PT_TO_MM),
    source: 'pdf_page',
    confidence: 'exact',
  };
}
```

**Doğrulama:**
- 600×900px PNG yükle → `widthMm: 51, heightMm: 76` (300 DPI varsayımı)
- 200×100mm PDF yükle → `widthMm: 200, heightMm: 100` (exact)
- viewBox="0 0 100 50" SVG → estimated

---

### GÖREV 2/4 — MultiDesignUploader: Ölçü Tespit + Callback

#### Dosya: `src/components/sticker/MultiDesignUploader.tsx`

`PendingDesign` interface'ine ekle:
```typescript
interface PendingDesign {
  // ... mevcut alanlar ...
  detectedDimensions?: DetectedDimensions | null;
}
```

Props'a callback ekle:
```typescript
interface MultiDesignUploaderProps {
  // ... mevcut props ...
  onDimensionsDetected?: (dims: DetectedDimensions) => void;
}
```

Upload handler'da (dosya kabul edildikten sonra):
```typescript
import { detectFileDimensions } from '@/lib/design-dimensions';

// Mevcut file accept logic'inden hemen sonra:
const dims = await detectFileDimensions(file);
if (dims && dims.source !== 'unsupported' && dims.widthMm > 0) {
  // İlk yüklenen dosyanın ölçüsünü öne çıkar (çoklu yükleme'de ilk dosya)
  if (designs.length === 0 && onDimensionsDetected) {
    onDimensionsDetected(dims);
  }
  // Pending design'a kaydet
  newPending.detectedDimensions = dims;
}
```

Her design card'ının altına ölçü rozeti:
```typescript
{design.detectedDimensions && design.detectedDimensions.source !== 'unsupported' && (
  <div className="mt-1 text-[11px] text-gri-500">
    Tespit edilen ölçü: {design.detectedDimensions.widthMm}×{design.detectedDimensions.heightMm}mm
    {design.detectedDimensions.confidence === 'estimated' && (
      <span className="text-gri-400 ml-1">(yaklaşık)</span>
    )}
  </div>
)}
```

**Doğrulama:** Bir PNG yükle → kartın altında "Tespit edilen ölçü: 60×80mm (yaklaşık)" yazısı, parent'a callback çağrılıyor.

---

### GÖREV 3/4 — Step Sırası Değişikliği: Tasarım ÖNCE, Boyut SONRA

#### Dosyalar: `src/app/etiket/yapilandir/page.tsx` + `src/app/sticker/yapilandir/page.tsx`

**Mevcut sıra:** Step 6 (Boyut) → Step 7 (Tasarım) → Step 8 (Adet)
**Yeni sıra:** Step 7 (Tasarım) → Step 6 (Boyut) → Step 8 (Adet)

JSX'te `FormSection id="step-7"` bloğunu `FormSection id="step-6"`'dan ÖNCEYE taşı. **Step numaralarını DEĞİŞTİRME** — sadece render sırası değişsin (URL hash + scrollIntoView mantığı bozulmasın).

State ekle (her iki sayfada da):
```typescript
const [detectedDims, setDetectedDims] = useState<DetectedDimensions | null>(null);
const [dimsPromptShown, setDimsPromptShown] = useState(false);
const [dimsAccepted, setDimsAccepted] = useState(false);
```

MultiDesignUploader'a callback geç:
```typescript
<MultiDesignUploader
  // ... mevcut props ...
  onDimensionsDetected={(dims) => {
    setDetectedDims(dims);
    setDimsPromptShown(true);
  }}
/>
```

Step 6 (Boyut) FormSection'ın **başına** prompt banner ekle:
```typescript
{detectedDims && dimsPromptShown && !dimsAccepted && (
  <div className="mb-4 p-3 rounded-lg bg-pim-mercan-tint/30 ring-1 ring-pim-mercan/40 flex items-center justify-between gap-3">
    <div className="text-[13px] text-lacivert">
      <strong>Tasarımının ölçüsünü tespit ettim:</strong> {detectedDims.widthMm}×{detectedDims.heightMm}mm
      {detectedDims.confidence === 'estimated' && (
        <span className="text-gri-500 ml-1">(300 DPI varsayımıyla)</span>
      )}
      <div className="text-[11px] text-gri-600 mt-0.5">Boyut alanına yazmamı ister misin?</div>
    </div>
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        onClick={() => {
          setWidth(detectedDims.widthMm);
          setHeight(detectedDims.heightMm);
          markTouched(6);
          setDimsAccepted(true);
          setDimsPromptShown(false);
        }}
        className="px-3 py-1.5 bg-pim-mercan text-white text-[12px] font-semibold rounded-lg hover:bg-pim-mercan-koyu"
      >
        Evet, kullan
      </button>
      <button
        type="button"
        onClick={() => setDimsPromptShown(false)}
        className="px-3 py-1.5 bg-white text-gri-700 text-[12px] font-medium rounded-lg ring-1 ring-gri-200 hover:bg-gri-50"
      >
        Hayır, elle gireceğim
      </button>
    </div>
  </div>
)}
```

Tek boyutlu şekiller (daire/kare) için: kullanıcı "Evet" derse `Math.max(w, h)` veya `Math.min(w, h)` kullan — gerçekçi olan max (kullanıcı sonra düşürür).

**Doğrulama:** 
- Sticker konfigüratör aç → önce tasarım upload, sonra boyut bölümü
- 100×50mm PDF yükle → boyut bölümünün üstünde mercan banner: "Tespit edilen ölçü 100×50mm. Boyut alanına yazmamı ister misin?"
- "Evet" → genişlik 100, yükseklik 50 doluyor
- "Hayır" → banner kayboluyor, müşteri elle girer

---

### GÖREV 4/4 — Ebat Ters Çevirme Butonu (W ↔ H)

#### Dosyalar: `src/app/etiket/yapilandir/page.tsx` + `src/app/sticker/yapilandir/page.tsx`

`isSingleDimensionShape(shape) === false` branch'inde (çift boyutlu — dikdörtgen/oval), W ve H input'ları arasındaki `×` ayıracını **swap butonu** ile değiştir:

**Mevcut:**
```jsx
<span className="text-gri-500 font-medium pb-3.5 text-lg">×</span>
```

**Yeni:**
```jsx
<button
  type="button"
  onClick={() => {
    const w = width;
    const h = height;
    setWidth(h);
    setHeight(w);
    markTouched(6);
  }}
  disabled={!width || !height}
  className="self-end mb-3 p-2 rounded-lg text-gri-500 hover:bg-pim-mercan-tint hover:text-pim-mercan transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gri-500"
  title="Genişlik ↔ Yükseklik ters çevir"
  aria-label="Boyutları ters çevir"
>
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5h10M3 5l3-3M3 5l3 3M13 11H3M13 11l-3-3M13 11l-3 3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</button>
```

Grid'in `1fr_auto_1fr` template'i değişmiyor — buton aynı yerde, sadece `×` yerine swap ikonu.

**Doğrulama:** 100×50 girilmiş → butona bas → 50×100 oluyor.

---

## TEST PLANI

| Test | Beklenen |
|---|---|
| PNG yükle (600×900px) | Banner: "60×90mm (yaklaşık)" + Evet/Hayır |
| PDF yükle (200×100mm) | Banner: "200×100mm" (yaklaşık değil — exact) |
| SVG viewBox="0 0 100 50" | Banner: "estimated" hint ile |
| AI/PSD yükle | Banner gösterilmez (unsupported) |
| Daire şekil + PNG | Tek boyut input doluyor (max(w,h)) |
| Swap butonu | W↔H takas, markTouched çağrılıyor |
| Tasarım kaldır + yeni yükle | Yeni dosyanın ölçüsü için banner tekrar görünür |
| "Hayır" sonrası yeni dosya yükle | Banner tekrar gösteriliyor |

## UYGULAMA SIRASI

1. **Görev 1** — `design-dimensions.ts` helper (20 dk)
2. **Görev 2** — MultiDesignUploader callback (15 dk)
3. **Görev 3** — Step sıralama + prompt banner (her iki sayfa, 30 dk)
4. **Görev 4** — Swap butonu (her iki sayfa, 10 dk)

**Toplam: ~75 dk**

Her görev sonrası `npx tsc --noEmit` + commit.

## NOTLAR
- `pdf-lib` zaten projede var (bıçak algılama için kullanılıyor) — yeni dependency yok
- Raster dosyalar için DPI **varsayımı 300** — UI'da "300 DPI varsayımıyla" notu göster
- AI/PSD client-side parse pahalı (ağır lib gerekir) → server-side detection v2'ye bırak, şimdilik "unsupported" dön
- Swap butonu sadece çift boyutlu şekillerde görünür (daire/kare tek input — orada gerek yok)
- `isSingleDimensionShape` fonksiyonu mevcut — değiştirme
- CLAUDE.md sefaRules bu görevde geçerli değil ama hatırlatma: cüzdan/puan/üyelik indirimi YASAK
