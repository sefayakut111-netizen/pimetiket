# Cursor AI Ek Görevler — Proof Akışı Tamamlayıcılar

> Claude Code (mimari) tarafından hazırlanmıştır.
> Bu görevler CURSOR-GOREVLER-PROOF-EDITOR.md tamamlandıktan SONRA uygulanacak.
> Akış referansı: `docs/PROOF-EDITOR-AKIS-V3.md`

---

## GÖREV 1/5 — Arka Plan Tespiti + Kaldırma (KRİTİK)

### Sorun

Müşteri şeffaf sticker sipariş ediyor ama PNG'yi beyaz arka planla yüklüyor. Sistem bunu fark etmiyor → bıçağı kare çiziyor, beyaz katmanı %100 dolduruyor → beyaz kare sticker çıkıyor.

### Akıştaki yeri

Adım 1 (AI QC) ile Adım 2 (bıçak tespiti) ARASINA girer. Yani proof pipeline'da `runProofPipeline()` içinde, QC geçtikten sonra, cutline detect'ten ÖNCE.

### Dosya: `src/lib/proof/background-detect.ts` (yeni)

```typescript
import sharp from 'sharp';
import { needsWhiteLayer } from '@/lib/design-file-types';

export interface BgDetectResult {
  hasBackground: boolean;
  bgType: 'none' | 'solid_white' | 'solid_color' | 'complex' | 'unknown';
  bgColor?: string;              // hex
  bgCoverage?: number;           // 0-100 (arka plan yüzde)
  transparentPixelRatio?: number; // 0-1 (şeffaf piksel oranı)
  needsRemoval: boolean;         // malzeme + arka plan birleşik karar
  confidence: number;            // 0-1
}

export async function detectBackground(
  fileUrl: string,
  fileName: string,
  materialKey: string,
): Promise<BgDetectResult> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));

  // JPG → her zaman arka plan var (alpha yok)
  if (ext === '.jpg' || ext === '.jpeg') {
    return {
      hasBackground: true,
      bgType: 'unknown',
      transparentPixelRatio: 0,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 1.0,
    };
  }

  // SVG / PDF / AI → vektör, arka plan tespiti farklı
  if (['.svg', '.pdf', '.ai'].includes(ext)) {
    // Vektör dosyalarda arka plan genellikle explicit bir rect
    // Bu aşamada basit: vektör → arka plan tespiti atla, POC halletsin
    return { hasBackground: false, bgType: 'none', needsRemoval: false, confidence: 0.5 };
  }

  // PNG / PSD → alpha kanalı analizi
  const res = await fetch(fileUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  const metadata = await sharp(buffer).metadata();

  if (!metadata.hasAlpha) {
    // Alpha kanalı yok → kesinlikle arka plan var
    return {
      hasBackground: true,
      bgType: 'unknown',
      transparentPixelRatio: 0,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 1.0,
    };
  }

  // Alpha var → ne kadar şeffaf?
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  let transparentPixels = 0;
  let whiteOpaquePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 10) {
      transparentPixels++;
    } else if (a > 245 && r > 240 && g > 240 && b > 240) {
      whiteOpaquePixels++;
    }
  }

  const transparentRatio = transparentPixels / totalPixels;
  const whiteRatio = whiteOpaquePixels / totalPixels;

  // Karar mantığı:
  // - %90+ şeffaf → arka plan yok, tasarım küçük (normal)
  // - %50+ beyaz opak + %5- şeffaf → beyaz arka plan var
  // - %20+ şeffaf → kısmen şeffaf, muhtemelen arka plan temiz
  // - %5- şeffaf + çok beyaz → beyaz arka plan, kaldırılmalı

  if (transparentRatio > 0.2) {
    return {
      hasBackground: false,
      bgType: 'none',
      transparentPixelRatio: transparentRatio,
      needsRemoval: false,
      confidence: 0.9,
    };
  }

  if (whiteRatio > 0.3 && transparentRatio < 0.05) {
    return {
      hasBackground: true,
      bgType: 'solid_white',
      bgColor: '#FFFFFF',
      bgCoverage: whiteRatio * 100,
      transparentPixelRatio: transparentRatio,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 0.85,
    };
  }

  return {
    hasBackground: transparentRatio < 0.1,
    bgType: transparentRatio < 0.1 ? 'complex' : 'none',
    transparentPixelRatio: transparentRatio,
    needsRemoval: transparentRatio < 0.1 && needsWhiteLayer(materialKey),
    confidence: 0.6,
  };
}
```

### Arka plan kaldırma: `src/lib/proof/background-remove.ts` (yeni)

```typescript
export interface BgRemoveResult {
  success: boolean;
  outputUrl?: string;       // arka planı kaldırılmış PNG URL
  method: 'sharp_threshold' | 'rembg_api' | 'skipped';
}

export async function removeBackground(
  fileUrl: string,
  bgDetect: BgDetectResult,
): Promise<BgRemoveResult> {

  // Solid beyaz arka plan → sharp ile basit threshold kaldırma
  if (bgDetect.bgType === 'solid_white' && bgDetect.confidence > 0.8) {
    return await removeWhiteBgWithSharp(fileUrl);
  }

  // Karmaşık arka plan → rembg API (Replicate veya self-hosted)
  if (bgDetect.bgType === 'complex') {
    return await removeWithRembg(fileUrl);
  }

  return { success: false, method: 'skipped' };
}

async function removeWhiteBgWithSharp(fileUrl: string): Promise<BgRemoveResult> {
  // sharp ile:
  // 1. Tüm pikselleri tara
  // 2. R>240 && G>240 && B>240 → alpha = 0 yap
  // 3. Kenar yumuşatma (anti-alias koruması): komşu piksellere bakarak gradual alpha
  // 4. PNG olarak kaydet → Supabase Storage upload
  // 5. URL döndür

  // Bu yöntem %90+ beyaz arka planlar için yeterli
  // Karmaşık arka planlar (gradient, fotoğraf) için rembg lazım

  return { success: true, outputUrl: '...', method: 'sharp_threshold' };
}

async function removeWithRembg(fileUrl: string): Promise<BgRemoveResult> {
  // Replicate API: rembg model
  // POST https://api.replicate.com/v1/predictions
  // model: "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
  // input: { image: fileUrl }
  // ~$0.01/çağrı, 2-5 saniye
  //
  // Alternatif: BRIA RMBG 2.0 (daha iyi kalite)
  // model: "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900f7aecd"

  // NOT: Replicate API key Vercel env'de olmalı: REPLICATE_API_TOKEN
  // Yoksa fallback: sharp threshold yöntemi

  return { success: true, outputUrl: '...', method: 'rembg_api' };
}
```

### Müşteri UX: Arka plan kaldırma önerisi

Proof pipeline'da arka plan tespit edilirse, müşteriye otomatik kaldırma yerine SORMAK daha güvenli:

```
/onay/[orderId] sayfasında:

┌────────────────────────────────────────────────────┐
│ ⚠️ Beyaz arka plan tespit ettik                     │
│                                                     │
│ Şeffaf sticker sipariş ettin ama tasarımında beyaz  │
│ arka plan var. Bu durumda sticker beyaz kare olur.  │
│                                                     │
│ ┌──────────────┐  ┌──────────────────┐              │
│ │ ÖNCESİ       │  │ SONRASI          │              │
│ │ [beyaz arka  │  │ [şeffaf arka     │              │
│ │  planlı logo]│  │  planlı logo]    │              │
│ └──────────────┘  └──────────────────┘              │
│                                                     │
│ [✅ Arka planı kaldır]  [⏭️ Bu şekilde devam et]    │
└────────────────────────────────────────────────────┘
```

"Arka planı kaldır" → `removeBackground()` çağır → yeni PNG ile proof yeniden üret.
"Bu şekilde devam et" → mevcut haliyle devam (müşteri bilinçli karar veriyor).

### Orkestratöre entegrasyon

`src/lib/proof/orchestrator.ts` içinde, cutline detect'ten ÖNCE:

```typescript
// QC geçti, cutline detect'e girmeden önce:
if (fileCategory === 'processable') {
  const bgResult = await detectBackground(designFileUrl, fileName, materialKey);

  if (bgResult.needsRemoval) {
    // Müşteriye sor — proof_pending status'unda BgRemovalPrompt göster
    // Müşteri "kaldır" derse → removeBackground() → yeni URL ile devam
    // Müşteri "devam et" derse → orijinal URL ile devam
    await saveProofFlag(orderId, itemId, 'bg_removal_suggested', bgResult);
  }
}
```

### Doğrulama
- Beyaz arka planlı PNG + transparan malzeme → "arka plan tespit edildi" flag
- Şeffaf arka planlı PNG → flag yok, normal akış
- JPG → flag (ama JPG akışı zaten ayrı)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/5 — RGB → CMYK Renk Simülasyonu

### Sorun

Müşteri RGB dosya yükledi. Ekranda canlı görünen renkler baskıda soluk çıkacak ama müşteri bunu bilmiyor → "renkler farklı" şikayeti.

### Akıştaki yeri

Adım 5 (müşteri kontrol sayfası) — ek katman toggle olarak.

### Dosya: `src/lib/proof/cmyk-simulate.ts` (yeni)

```typescript
import sharp from 'sharp';

export interface CmykSimResult {
  simulatedPngUrl: string;   // CMYK simülasyonu uygulanmış PNG
  colorShift: 'none' | 'minor' | 'noticeable' | 'significant';
  affectedAreas: string;     // "canlı yeşil ve mavi tonlarda fark olabilir"
}

export async function generateCmykSimulation(
  fileUrl: string,
  orderId: string,
  itemId: string,
): Promise<CmykSimResult> {
  const res = await fetch(fileUrl);
  const buffer = Buffer.from(await res.arrayBuffer());

  // RGB → CMYK simülasyonu (tam ICC profil dönüşümü değil, yaklaşık)
  // Sharp ile:
  // 1. Canlı renkler (gamut dışı) belirlenir
  //    - Saf yeşil (#00FF00) → CMYK'da soluk
  //    - Neon tonlar → CMYK'da karşılığı yok
  //    - Parlak mavi (#0000FF) → CMYK'da mor kayma
  // 2. Bu piksellerin saturation'ını %15-25 düşür
  // 3. Brightness'ı %5-10 düşür
  // 4. Simülasyon PNG'si oluştur

  // Basit yaklaşım (ICC profile olmadan):
  const simulated = await sharp(buffer)
    .modulate({ saturation: 0.82, brightness: 0.95 })
    .toBuffer();

  // Supabase Storage'a kaydet
  // URL döndür

  // Renk kayması tespiti: orijinal vs simülasyon piksel farkı
  // deltaE > 5 → noticeable, > 10 → significant

  return {
    simulatedPngUrl: '...',
    colorShift: 'noticeable',
    affectedAreas: 'Canlı yeşil ve mavi tonlarda fark olabilir',
  };
}
```

### Müşteri UX

`/onay/[orderId]` sayfasında katman toggle'larına ekle:

```
Mevcut:
  [🎨 Tasarım] [✂️ Bıçak] [⬜ Beyaz] [🏁 Zemin]

Yeni:
  [🎨 Tasarım] [✂️ Bıçak] [⬜ Beyaz] [🏁 Zemin] [🎨 CMYK Önizleme]
```

"CMYK Önizleme" toggle açıldığında:
- Orijinal yerine CMYK simülasyonu gösterilir
- Altında bilgi notu: "Baskıda renkler yaklaşık bu şekilde görünecek. Ekran renkleri ile baskı renkleri arasında doğal fark olabilir."
- `colorShift === 'significant'` ise sarı uyarı: "Tasarımındaki canlı renkler baskıda soluk görünebilir"

### API endpoint

```
GET /api/orders/[id]/proof/[itemId]/cmyk-preview
→ Eğer daha önce üretilmişse cache'den döner
→ İlk çağrıda generateCmykSimulation() çalıştırır
→ { simulatedPngUrl, colorShift, affectedAreas }
```

### Doğrulama
- RGB PNG → CMYK simülasyon PNG üretildi
- /onay sayfasında "CMYK Önizleme" toggle çalışıyor
- `colorShift` bilgisi UI'da gösteriliyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/5 — Çoklu Tasarım Tutarlılık Kontrolü

### Sorun

Sipariş 5 farklı tasarım içeriyor. Biri 300 DPI, biri 72 DPI. Biri CMYK, diğerleri RGB. Kalite farkı kontrol edilmiyor.

### Akıştaki yeri

Adım 1 (AI QC) tüm dosyalar için tamamlandıktan SONRA — aggregate kontrol.

### Dosya: `src/lib/proof/multi-design-check.ts` (yeni)

```typescript
export interface DesignQCResult {
  fileId: string;
  fileName: string;
  dpi: number;
  colorProfile: string;      // CMYK, RGB, Grayscale
  verdict: string;            // iyi, normal, kotu
  score: number;              // 0-100
  fileType: string;           // raster, vector, hybrid
}

export interface ConsistencyResult {
  consistent: boolean;
  issues: ConsistencyIssue[];
}

export interface ConsistencyIssue {
  type: 'dpi_mismatch' | 'color_mismatch' | 'quality_mismatch' | 'type_mismatch';
  severity: 'warning' | 'info';
  message_tr: string;
  affected_files: string[];   // dosya adları
}

export function checkMultiDesignConsistency(
  results: DesignQCResult[],
): ConsistencyResult {
  if (results.length <= 1) {
    return { consistent: true, issues: [] };
  }

  const issues: ConsistencyIssue[] = [];

  // DPI tutarlılığı
  const dpis = results.map(r => r.dpi).filter(d => d > 0);
  if (dpis.length > 1) {
    const minDpi = Math.min(...dpis);
    const maxDpi = Math.max(...dpis);
    if (maxDpi / minDpi > 2) {
      const lowFiles = results.filter(r => r.dpi === minDpi).map(r => r.fileName);
      issues.push({
        type: 'dpi_mismatch',
        severity: 'warning',
        message_tr: `Tasarımlar arasında DPI farkı var: ${minDpi} ile ${maxDpi} DPI. Düşük olan dosyalar baskıda daha düşük kalitede olabilir.`,
        affected_files: lowFiles,
      });
    }
  }

  // Renk profili tutarlılığı
  const profiles = [...new Set(results.map(r => r.colorProfile))];
  if (profiles.length > 1) {
    issues.push({
      type: 'color_mismatch',
      severity: 'info',
      message_tr: `Tasarımlarda farklı renk profilleri var: ${profiles.join(', ')}. Tüm dosyalar baskıda CMYK'ya dönüştürülecek.`,
      affected_files: results.filter(r => r.colorProfile === 'RGB').map(r => r.fileName),
    });
  }

  // Kalite skoru tutarlılığı
  const scores = results.map(r => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  if (maxScore - minScore > 30) {
    const lowFiles = results.filter(r => r.score === minScore).map(r => r.fileName);
    issues.push({
      type: 'quality_mismatch',
      severity: 'warning',
      message_tr: `Tasarımlar arasında kalite farkı var. Bazı dosyalar daha düşük kalitede — baskıda fark hissedilebilir.`,
      affected_files: lowFiles,
    });
  }

  return {
    consistent: issues.filter(i => i.severity === 'warning').length === 0,
    issues,
  };
}
```

### Entegrasyon

`src/lib/agents/run-order-qc.ts` dosyasında tüm dosyaların QC'si bittikten sonra:

```typescript
// Mevcut: tüm dosyalar QC'den geçti, aggregate verdict hesapla
// EKLE: multi-design tutarlılık kontrolü
if (qcResults.length > 1) {
  const consistency = checkMultiDesignConsistency(qcResults);
  if (!consistency.consistent) {
    // order_events'e kaydet → müşteriye göster
    await saveConsistencyWarning(orderId, consistency);
  }
}
```

### Müşteri UX

`/onay/[orderId]` sayfasında, item listesinin üstünde:

```
┌─────────────────────────────────────────────┐
│ ℹ️ Tasarımlar arasında kalite farkı var      │
│ "logo.png" 72 DPI — diğerleri 300 DPI.      │
│ Düşük DPI dosya baskıda piksellenebilir.    │
│ [Dosyayı değiştir] [Bu şekilde devam et]    │
└─────────────────────────────────────────────┘
```

### Doğrulama
- 3 dosya (300 DPI, 300 DPI, 72 DPI) → `dpi_mismatch` warning
- 2 dosya (aynı kalite) → `consistent: true`
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/5 — Print-Ready PDF Üretimi

### Sorun

Proof onaylandı, partner'a gidecek. Ama dosyalar ayrı ayrı: orijinal tasarım + bıçak SVG + beyaz PNG. Partner bunları birleştirmek zorunda.

### Akıştaki yeri

Adım 7 (baskıya iletim) — proof_approved → ready_to_ship geçişinde otomatik.

### Dosya: `src/lib/proof/print-ready.ts` (yeni)

```typescript
import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';

export interface PrintReadyResult {
  pdfUrl: string;           // baskıya hazır PDF URL
  pageCount: number;
  includesBleed: boolean;
  includesCutline: boolean;
  includesWhiteLayer: boolean;
  fileSizeBytes: number;
}

export interface PrintReadyInput {
  orderId: string;
  itemId: string;
  designFileUrl: string;      // orijinal tasarım
  cutlineSvgPath: string;     // onaylı bıçak SVG
  whiteLayerPngUrl?: string;  // beyaz katman (varsa)
  designWidth: number;        // mm
  designHeight: number;       // mm
  bleedMm: number;            // mm (varsayılan 2)
  materialKey: string;
}

export async function generatePrintReadyPdf(
  input: PrintReadyInput,
): Promise<PrintReadyResult> {

  // 1. PDF oluştur (pdf-lib — zaten projede var)
  const pdfDoc = await PDFDocument.create();

  // Sayfa boyutu: tasarım + bleed (her yönde)
  const widthPt = mmToPt(input.designWidth + input.bleedMm * 2);
  const heightPt = mmToPt(input.designHeight + input.bleedMm * 2);
  const page = pdfDoc.addPage([widthPt, heightPt]);

  // 2. Tasarım görselini embed et
  const designBytes = await fetch(input.designFileUrl).then(r => r.arrayBuffer());

  // PNG/JPG → PDF embed
  // AI/PSD/PDF → pdf-lib ile merge (veya rasterize + embed)
  // SVG → sharp ile PNG'ye dönüştür → embed

  const designImage = await pdfDoc.embedPng(new Uint8Array(designBytes));
  page.drawImage(designImage, {
    x: mmToPt(input.bleedMm),
    y: mmToPt(input.bleedMm),
    width: mmToPt(input.designWidth),
    height: mmToPt(input.designHeight),
  });

  // 3. Bleed mark çiz (köşe işaretleri)
  drawCropMarks(page, input.designWidth, input.designHeight, input.bleedMm);

  // 4. Bıçak çizgisini spot color olarak ekle
  // CutContour adında spot color layer
  // Partner'ın RIP sistemi bu layer'ı otomatik tanır
  drawCutlineAsSpotColor(page, input.cutlineSvgPath, input.bleedMm);

  // 5. Beyaz katmanı ayrı sayfa olarak ekle (varsa)
  if (input.whiteLayerPngUrl) {
    const whitePage = pdfDoc.addPage([widthPt, heightPt]);
    // "White" spot color layer olarak
    const whiteBytes = await fetch(input.whiteLayerPngUrl).then(r => r.arrayBuffer());
    const whiteImage = await pdfDoc.embedPng(new Uint8Array(whiteBytes));
    whitePage.drawImage(whiteImage, {
      x: mmToPt(input.bleedMm),
      y: mmToPt(input.bleedMm),
      width: mmToPt(input.designWidth),
      height: mmToPt(input.designHeight),
    });
  }

  // 6. PDF metadata
  pdfDoc.setTitle(`Pim Etiket — Sipariş ${input.orderId} — İş emri`);
  pdfDoc.setProducer('Pim Etiket Print System');
  pdfDoc.setCreationDate(new Date());

  // 7. Kaydet → Supabase Storage
  const pdfBytes = await pdfDoc.save();
  // Upload to designs bucket: print-ready/{orderId}/{itemId}.pdf
  // Return URL

  return {
    pdfUrl: '...',
    pageCount: input.whiteLayerPngUrl ? 2 : 1,
    includesBleed: true,
    includesCutline: true,
    includesWhiteLayer: !!input.whiteLayerPngUrl,
    fileSizeBytes: pdfBytes.length,
  };
}

function mmToPt(mm: number): number {
  return mm * 2.83465; // 1mm = 2.83465 points
}

function drawCropMarks(page: any, w: number, h: number, bleed: number): void {
  // 4 köşede L şeklinde ince çizgiler (0.25pt, siyah)
  // Offset: bleed alanının dışında
}

function drawCutlineAsSpotColor(page: any, svgPath: string, bleedOffset: number): void {
  // SVG path → PDF path komutlarına dönüştür
  // Spot color: "CutContour" (Magenta %100 — endüstri standardı)
  // Overprint: on
}
```

### Tetikleme

`proof_approved → ready_to_ship` geçişinde (trigger veya API):

```typescript
// Mevcut: proof_approved olunca ready_to_ship'e geç
// EKLE: print-ready PDF üret

for (const item of orderItems) {
  const printPdf = await generatePrintReadyPdf({
    orderId, itemId: item.id,
    designFileUrl: item.designUrl,
    cutlineSvgPath: item.approvedCutlineSvg,
    whiteLayerPngUrl: item.whiteLayerUrl,
    designWidth: item.width, designHeight: item.height,
    bleedMm: 2, materialKey: item.material,
  });

  // order_items'a print_ready_pdf_url kaydet
  await updateOrderItem(item.id, { print_ready_pdf_url: printPdf.pdfUrl });
}
```

### Partner manifest güncelle

Mevcut `/api/admin/print-job/[orderId]/manifest` endpoint'ine print-ready PDF URL ekle:

```typescript
// Manifest JSON'a ekle:
{
  items: [{
    // ... mevcut alanlar ...
    print_ready_pdf_url: "...",  // YENİ — tek dosya, partner RIP'e direkt
  }]
}
```

### Migration

```sql
-- order_items'a print-ready PDF URL kolonu
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS print_ready_pdf_url text;
```

### Doğrulama
- Proof onaylandı → print-ready PDF üretildi → order_items'da URL var
- PDF açıldığında: tasarım + crop marks + cutline (spot color) + beyaz (sayfa 2)
- Partner manifest'te `print_ready_pdf_url` görünüyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 5/5 — Pim Chat Proof Bağlamı

### Sorun

Müşteri proof sorununu Pim'e soruyor ama Pim siparişin proof durumunu, AI validation sonucunu bilmiyor.

### Akıştaki yeri

Pim Chat tool calling — Designer persona'ya yeni tool'lar ekle.

### Dosya güncelle: `src/lib/pim/personas.ts`

Designer persona'nın `tools` tanımına 2 yeni tool ekle:

```typescript
const proofStatusTool = tool({
  description: 'Müşterinin belirttiği siparişin prova durumunu, AI kontrol sonucunu ve bıçak/beyaz katman detaylarını getirir.',
  inputSchema: z.object({
    orderId: z.string().describe('Sipariş numarası'),
  }),
  execute: async ({ orderId }) => {
    // 1. orders tablosundan status çek
    // 2. proof_validations tablosundan AI sonuç çek
    // 3. cutline_designs tablosundan bıçak durumu çek
    // Return:
    return {
      status: 'proof_pending',
      aiVerdict: 'warn',
      cutlineIssues: ['Sağ üst köşede 0.3mm sapma'],
      whiteLayerStatus: 'generated',
      pimSuggestion: 'Düzenle butonundan offset ayarını 2mm yap',
    };
  },
});

const proofHelpTool = tool({
  description: 'Müşterinin prova sorununu operatöre iletir — yardım talebi oluşturur.',
  inputSchema: z.object({
    orderId: z.string(),
    itemId: z.string().optional(),
    issue: z.string().describe('Müşterinin tarif ettiği sorun'),
  }),
  execute: async ({ orderId, itemId, issue }) => {
    // proof_help_requests INSERT
    // Müşteriye onay mesajı döndür
    return {
      ticketCreated: true,
      message: 'Uzman ekibimize ilettim, en kısa sürede dönüş yapacaklar.',
    };
  },
});
```

### System prompt güncelleme

Designer persona system prompt'una ekle:

```
PROVA İLE İLGİLİ SORULARDA:
- Müşteri prova/bıçak/beyaz katman soruyorsa önce get_proof_status tool'unu çağır
- AI kontrol sonuçlarını basit dilde açıkla
- "Düzenle" butonunu yönlendir (konum: /onay/SIPARIS_NO)
- Çözemeyeceğin teknik sorularda create_proof_help_request tool'unu çağır
- "Bıçak" = kesim çizgisi, "beyaz katman" = şeffaf malzeme altı beyaz baskı — müşteriye basit açıkla
```

### Doğrulama
- Pim'e "siparişimin bıçağında sorun var" de → get_proof_status çağrılır → bağlamla cevap verir
- "Çözemiyorum yardım iste" → create_proof_help_request çağrılır → ticket oluşur
- `npx tsc --noEmit` → 0 hata

---

## Uygulama Sırası

1. **Görev 1** — Arka plan tespiti + kaldırma (KRİTİK — şeffaf sticker akışı)
2. **Görev 3** — Çoklu tasarım tutarlılık (QC aggregate)
3. **Görev 2** — CMYK simülasyon (müşteri UX)
4. **Görev 5** — Pim Chat proof bağlamı (tool calling)
5. **Görev 4** — Print-ready PDF (baskıya iletim)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
