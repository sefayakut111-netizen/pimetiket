# Cursor Proof Editor & AI Validation Sistemi

> Claude Code (mimari) tarafından hazırlanmıştır.
> Akış referansı: `docs/PROOF-EDITOR-AKIS-V3.md`
> 8 görev, sırayla uygulanacak.
> Her görev bağımsız commit edilebilir.

---

## ÖN BİLGİ

### Desteklenen dosya tipleri (bıçak + beyaz katman)
- PNG, AI, PSD, PDF, SVG → bıçak + beyaz üretilebilir
- JPG → sadece QC + hazır şekil seçimi (bıçak/beyaz üretilmez)
- **EPS desteklenmez** — upload'da engellenecek

### Beyaz katman gereken malzemeler
- transparan, seffaf, ultra, ultraclear → ✅ beyaz şart
- metalik, metalize → ✅ beyaz şart
- holo, holografik → ✅ beyaz şart
- simli → ✅ beyaz şart
- kuse, kraft, beyaz, opakpp, opak → ❌ beyaz gereksiz

### Yeni status
- `proof_validating` — müşteri düzenleme sonrası AI tekrar kontrol (3-10sn)

---

## GÖREV 1/8 — EPS Engeli + Dosya Tipi Util

### Dosya: `src/lib/design-file-types.ts` (yeni)

```typescript
export const PROCESSABLE_TYPES = ['image/png', 'application/pdf', 'image/svg+xml'] as const;
export const PROCESSABLE_EXTENSIONS = ['.png', '.ai', '.psd', '.pdf', '.svg'] as const;

export const QC_ONLY_TYPES = ['image/jpeg'] as const;
export const QC_ONLY_EXTENSIONS = ['.jpg', '.jpeg'] as const;

export const BLOCKED_EXTENSIONS = ['.eps'] as const;

export type DesignFileCategory = 'processable' | 'qc_only' | 'blocked';

export function categorizeFile(fileName: string, mimeType?: string): DesignFileCategory {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) return 'blocked';
  if ((QC_ONLY_EXTENSIONS as readonly string[]).includes(ext)) return 'qc_only';
  if ((PROCESSABLE_EXTENSIONS as readonly string[]).includes(ext)) return 'processable';
  // AI ve PSD'nin MIME'ı güvenilmez, extension'a bak
  if (ext === '.ai' || ext === '.psd') return 'processable';
  return 'blocked'; // bilinmeyen → engelle
}

export function canGenerateCutline(category: DesignFileCategory): boolean {
  return category === 'processable';
}

export function canGenerateWhiteLayer(category: DesignFileCategory): boolean {
  return category === 'processable';
}

export const WHITE_LAYER_MATERIALS = [
  'transparan', 'seffaf', 'ultra', 'ultraclear',
  'metalik', 'metalize', 'holo', 'holografik', 'simli',
] as const;

export function needsWhiteLayer(materialKey: string): boolean {
  return (WHITE_LAYER_MATERIALS as readonly string[]).includes(materialKey.toLowerCase());
}
```

### Upload validation güncelle

`src/app/api/design/upload-init/route.ts` ve `src/app/api/design/upload-complete/route.ts` dosyalarında:

```typescript
import { categorizeFile } from '@/lib/design-file-types';

// upload-init'te:
const category = categorizeFile(fileName, mimeType);
if (category === 'blocked') {
  return Response.json({ 
    error: 'Bu dosya formatı desteklenmiyor. PNG, AI, PSD, PDF, SVG veya JPG yükleyin.' 
  }, { status: 400 });
}
```

Mevcut kabul listesinden EPS'yi çıkar. Dosya: `src/lib/storage/buckets.ts` veya upload validation'ın olduğu yer — `allowedMimeTypes` veya `ALLOWED_EXTENSIONS` array'inden `.eps` ve `application/postscript` kaldır.

### Doğrulama
- EPS dosya yüklemeye çalış → 400 hatası
- PNG/AI/PSD/PDF/SVG/JPG hâlâ yüklenebilir
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/8 — Yeni Status: `proof_validating` 

### Migration: `supabase/migrations/099_proof_validating_status.sql`

```sql
-- Müşteri düzenleme sonrası AI tekrar kontrol durumu (3-10sn)
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'proof_validating' AFTER 'proof_pending';
```

**ÖNEMLİ:** `ALTER TYPE ... ADD VALUE` transaction içinde çalışmaz — bu migration tek başına, başka SQL ile birleştirilmeden çalıştırılmalı.

### `src/lib/order.ts` güncelle

Status listesine `proof_validating` ekle. Mevcut status flow tanımına:

```typescript
// proof_validating: müşteri düzenleme yaptı, AI tekrar doğruluyor (kısa ömürlü 3-10sn)
```

Status transition kurallarına ekle:
- `proof_pending` → `proof_validating` (müşteri düzenleme kaydetti)
- `proof_validating` → `proof_pending` (AI kontrol tamamlandı)

### Müşteri tarafı status gösterimi

`/siparis/[id]` ve `/onay/[orderId]` sayfalarında `proof_validating` için:
- Pim animasyonu (pose: "think" + loading spinner)
- Mesaj: "Düzenlemenizi kontrol ediyoruz... Birkaç saniye."
- Otomatik poll (2sn interval) — status `proof_pending`'e dönünce sayfa yenilenir

### Doğrulama
- Migration apply → `proof_validating` enum'da var
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/8 — JPG Akışı: Hazır Şekil Seçici

### Sorun
JPG'de alpha kanalı yok → bıçak/beyaz üretilemez. Müşteriye 3 seçenek sunulmalı.

### Dosya: `src/components/proof/JpgShapeSelector.tsx` (yeni)

```typescript
// JPG yüklendiğinde /onay sayfasında bu component gösterilir
// 3 seçenek:
// 1. "Şeffaf PNG yükle" → dosya yükleme alanı aç
// 2. "Hazır şekil seç" → kare/daire/oval/dikdörtgen grid
// 3. "Operatör desteği iste" → help request oluştur

interface JpgShapeSelectorProps {
  orderId: string;
  itemId: string;
  designWidth: number;   // mm
  designHeight: number;  // mm
  material: string;
  onShapeSelected: (shape: GeoShape) => void;
  onUploadPng: () => void;
  onRequestHelp: () => void;
}

type GeoShape = 'square' | 'circle' | 'oval' | 'rounded_rect';

// Şekil seçildiğinde geometrik bıçak SVG üret:
function generateGeoSvgPath(
  shape: GeoShape, 
  width: number, 
  height: number, 
  offset: number,    // mm (varsayılan 1.5)
  cornerRadius: number  // mm (varsayılan 2, sadece rounded_rect)
): string {
  const w = width + offset * 2;
  const h = height + offset * 2;
  
  switch (shape) {
    case 'square':
      return `M 0 0 H ${w} V ${h} H 0 Z`;
    case 'circle': {
      const r = Math.max(w, h) / 2;
      const cx = w / 2, cy = h / 2;
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    }
    case 'oval':
      // SVG ellipse as path
      const rx = w / 2, ry = h / 2;
      return `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${rx} ${h} A ${rx} ${ry} 0 1 1 ${rx} 0 Z`;
    case 'rounded_rect':
      const cr = Math.min(cornerRadius, w / 4, h / 4);
      return `M ${cr} 0 H ${w - cr} Q ${w} 0 ${w} ${cr} V ${h - cr} Q ${w} ${h} ${w - cr} ${h} H ${cr} Q 0 ${h} 0 ${h - cr} V ${cr} Q 0 0 ${cr} 0 Z`;
  }
}
```

### UI tasarımı

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ JPG dosyanda arka plan bilgisi yok                │
│ Bıçak çizimi için aşağıdaki seçeneklerden birini seç │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [🔄 Şeffaf PNG yükle]        ← birincil CTA        │
│  "En iyi sonuç için önerilen"                         │
│                                                       │
│  ── veya hazır şekil seç ──                           │
│                                                       │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ □    │  │ ○    │  │ ⬭    │  │ ▢    │             │
│  │ Kare │  │Daire │  │ Oval │  │Yuvar.│             │
│  └──────┘  └──────┘  └──────┘  └──────┘             │
│                                                       │
│  [🆘 Operatör desteği iste]   ← secondary link      │
│  "Özel kontur gerekiyorsa"                            │
└──────────────────────────────────────────────────────┘
```

### Entegrasyon

`/onay/[orderId]` sayfasında, item'ın tasarım dosyası JPG ise ve bıçak yoksa bu component'i göster. Şekil seçildiğinde:

1. `generateGeoSvgPath()` ile SVG üret
2. `POST /api/orders/[id]/proof/[itemId]/save-edit` ile kaydet
3. Beyaz katman gerekiyorsa (malzeme kontrolü) → geometrik mask ile beyaz üret
4. → AI doğrulama (Adım 4) akışına gir

### Doğrulama
- JPG yüklü sipariş → /onay sayfası → JpgShapeSelector görünüyor
- Daire seç → geometrik bıçak oluşuyor → proof preview'da görünüyor
- PNG yükle seçeneği → dosya yükleme alanı açılıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/8 — Bıçak Tespit Modülü

### Dosya: `src/lib/proof/cutline-detect.ts` (yeni)

```typescript
// Dosya tipine göre bıçak tespiti
// Bu modül POC v2 iframe'inden ÖNCE çalışır
// Dosyada zaten bıçak varsa parse eder, yoksa POC'a bırakır

export interface CutlineDetectResult {
  found: boolean;
  source: 'file_embedded' | 'auto_generated' | 'geo_shape' | 'operator' | 'none';
  svgPath?: string;        // bıçak SVG path data
  partCount?: number;       // kaç parça kontur
  valid?: boolean;          // kapalı + temiz mi
  issues?: string[];        // sorunlar
}

export async function detectCutlineInFile(
  fileUrl: string,        // signed URL
  fileName: string,
  mimeType: string,
): Promise<CutlineDetectResult> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  
  switch (ext) {
    case '.svg':
      return detectCutlineFromSvg(fileUrl);
    case '.pdf':
      return detectCutlineFromPdf(fileUrl);
    case '.ai':
      return detectCutlineFromAi(fileUrl);
    case '.psd':
      return detectCutlineFromPsd(fileUrl);
    case '.png':
      return detectCutlineFromPng(fileUrl);
    case '.jpg':
    case '.jpeg':
      return { found: false, source: 'none' };
    default:
      return { found: false, source: 'none' };
  }
}
```

Her dosya tipi için tespit fonksiyonu:

**SVG:** DOM parse → `<clipPath>`, `<path id="*cut*">`, veya en dış `<path>` elementi ara.

**PDF:** `pdf-lib` ile aç → annotation veya spot color layer "CutContour" / "Thru-cut" adında ara. Yoksa → en dış vektör path'i al.

**AI:** Adobe Illustrator dosyaları pratikte PDF container. `pdf-lib` ile aynı şekilde dene. Başarısızsa → `found: false` (POC üretecek).

**PSD:** `@webtoon/psd` veya benzeri parser ile katman adlarını tara: "die", "cut", "knife", "bicak", "cutline", "contour". Bulursa → path data extract. Yoksa → `found: false`.

**PNG:** Alpha kanalı kontrol — tamamen opak ise (alpha hep 255) → `found: false`. Şeffaf alanlar varsa → alpha edge detection ile implicit cutline. Bu kısım server-side `sharp` library ile yapılabilir:

```typescript
import sharp from 'sharp';

async function detectCutlineFromPng(url: string): Promise<CutlineDetectResult> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { channels, hasAlpha } = await sharp(buffer).metadata();
  
  if (!hasAlpha) {
    return { found: false, source: 'none' };
  }
  
  // Alpha kanalını çıkar → edge detection → SVG path
  // Bu kısım POC v2'nin headless moduna bırakılabilir
  // Burada sadece "alpha var" tespiti yeterli
  return { 
    found: true, 
    source: 'file_embedded',
    // svgPath POC tarafından üretilecek
  };
}
```

### Bıçak validasyon

```typescript
export function validateCutlineSvg(svgPath: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Kapalı path mi? (Z veya z ile bitiyor mu)
  if (!svgPath.trim().match(/[Zz]\s*$/)) {
    issues.push('Bıçak konturu kapalı değil — açık path');
  }
  
  // Node sayısı
  const nodeCount = (svgPath.match(/[MLHVCSQTA]/gi) || []).length;
  if (nodeCount > 500) {
    issues.push(`Kontur çok karmaşık (${nodeCount} node) — sadeleştirme gerekebilir`);
  }
  
  // Self-intersection (basit kontrol — bounding box overlap)
  // Detaylı kontrol POC editörde yapılır
  
  return { valid: issues.length === 0, issues };
}
```

### Doğrulama
- SVG dosyasında clipPath var → bıçak tespit edildi
- PNG'de alpha var → "file_embedded" dönüyor
- JPG → "none" dönüyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 5/8 — Beyaz Katman Üretim Modülü

### Dosya: `src/lib/proof/white-layer.ts` (yeni)

```typescript
import { needsWhiteLayer } from '@/lib/design-file-types';

export interface WhiteLayerResult {
  generated: boolean;
  reason?: 'not_needed' | 'no_alpha' | 'generated' | 'error';
  whitePngUrl?: string;       // üretilen beyaz katman URL
  coverage?: number;           // %0-100
  warnings?: string[];
}

export interface WhiteLayerInput {
  designFileUrl: string;       // signed URL
  cutlineSvgPath: string;      // bıçak SVG (mask için)
  materialKey: string;         // malzeme
  designWidth: number;         // mm
  designHeight: number;        // mm
}

export async function generateWhiteLayer(input: WhiteLayerInput): Promise<WhiteLayerResult> {
  // 1. Malzeme kontrolü
  if (!needsWhiteLayer(input.materialKey)) {
    return { generated: false, reason: 'not_needed' };
  }

  // 2. Tasarım dosyasından alpha kanalı çıkar (sharp)
  // 3. Alpha threshold uygula (> 128 → beyaz)
  // 4. Bıçak SVG ile mask uygula (taşma önle)
  // 5. İnce detay kontrolleri:
  //    - 0.3mm'den ince beyaz → genişlet (morphological dilate)
  //    - İzole piksel kümesi < 4px → temizle (noise removal)
  //    - Text alanları → solid beyaz doldur (flood fill)
  // 6. PNG olarak kaydet → Supabase Storage
  // 7. Coverage hesapla: (beyaz piksel / toplam piksel) × 100

  // İşlem server-side sharp + canvas ile yapılır
  // POC v2'nin mevcut white plan logic'i referans alınabilir
  // Ama server-side olması lazım (headless, iframe değil)
}
```

### Server-side rendering notu

Mevcut POC v2 beyaz katmanı **client-side iframe** içinde üretiyor. Bu modül aynı mantığı **server-side** yapmalı:

- `sharp` library (zaten projede var) → PNG manipülasyon
- Alpha extraction → threshold → mask → cleanup → save

Eğer mevcut POC v2 beyaz katman logic'i iyi çalışıyorsa, **bu modülü şimdilik skip edip** mevcut iframe akışını koruyabiliriz. Ama `WhiteLayerResult` interface'ini ve `needsWhiteLayer()` kontrolünü yine de ekle — sonraki görevlerde lazım.

### Doğrulama
- `needsWhiteLayer('transparan')` → true
- `needsWhiteLayer('kuse')` → false
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 6/8 — Rule-Based Proof Validator (Katman 1)

### Dosya: `src/lib/proof/rule-validator.ts` (yeni)

```typescript
export interface ProofValidationInput {
  designWidth: number;
  designHeight: number;
  cutlineSvgPath: string;
  cutlinePartCount: number;
  cutlineOffset: number;        // mm
  whiteLayerExists: boolean;
  whiteCoverage: number;        // 0-100
  materialKey: string;
  fileCategory: 'processable' | 'qc_only';
}

export interface RuleIssue {
  area: 'cutline' | 'white_layer' | 'geometry';
  severity: 'error' | 'warning' | 'info';
  code: string;
  message_tr: string;
  autoFixable: boolean;
}

export interface RuleCheckResult {
  passed: boolean;
  issues: RuleIssue[];
}

export function runProofRuleCheck(input: ProofValidationInput): RuleCheckResult {
  const issues: RuleIssue[] = [];
  const needsWhite = needsWhiteLayer(input.materialKey);

  // ─── BIÇAK KURALLARI ───

  if (input.cutlinePartCount === 0) {
    issues.push({
      area: 'cutline', severity: 'error', code: 'NO_CONTOUR',
      message_tr: 'Bıçak çizimi bulunamadı',
      autoFixable: false,
    });
  }

  if (input.cutlinePartCount > 8) {
    issues.push({
      area: 'cutline', severity: 'warning', code: 'TOO_MANY_CONTOURS',
      message_tr: `${input.cutlinePartCount} ayrı kesim parçası — gürültü olabilir`,
      autoFixable: true,
    });
  }

  if (input.cutlineOffset < 1) {
    issues.push({
      area: 'cutline', severity: 'warning', code: 'LOW_OFFSET',
      message_tr: 'Bıçak ofseti 1mm altında — kesim kayması riski',
      autoFixable: true,
    });
  }

  // Keskin köşe kontrolü — SVG path'ten açı hesapla
  const sharpCorners = countSharpCorners(input.cutlineSvgPath, 0.5);
  if (sharpCorners > 0) {
    issues.push({
      area: 'cutline', severity: 'warning', code: 'SHARP_CORNERS',
      message_tr: `${sharpCorners} keskin köşe — die-cut makinesi zorlanabilir`,
      autoFixable: true,
    });
  }

  // ─── BEYAZ KATMAN KURALLARI ───

  if (needsWhite && !input.whiteLayerExists) {
    issues.push({
      area: 'white_layer', severity: 'error', code: 'WHITE_MISSING',
      message_tr: 'Şeffaf/metalik malzeme — beyaz katman gerekli ama üretilmedi',
      autoFixable: true,
    });
  }

  if (!needsWhite && input.whiteLayerExists && input.whiteCoverage > 5) {
    issues.push({
      area: 'white_layer', severity: 'info', code: 'WHITE_UNNECESSARY',
      message_tr: 'Opak malzemede beyaz katman gereksiz',
      autoFixable: true,
    });
  }

  if (needsWhite && input.whiteCoverage > 95) {
    issues.push({
      area: 'white_layer', severity: 'warning', code: 'WHITE_FULL_COVERAGE',
      message_tr: 'Beyaz katman %95+ — arka plan temizlenmemiş olabilir',
      autoFixable: false,
    });
  }

  if (needsWhite && input.whiteCoverage > 0 && input.whiteCoverage < 20) {
    issues.push({
      area: 'white_layer', severity: 'warning', code: 'WHITE_LOW_COVERAGE',
      message_tr: 'Beyaz katman %20 altında — ince detaylar kaybolabilir',
      autoFixable: false,
    });
  }

  // ─── GEOMETRİ KURALLARI ───

  if (input.designWidth < 15 || input.designHeight < 15) {
    issues.push({
      area: 'geometry', severity: 'warning', code: 'TOO_SMALL',
      message_tr: 'Tasarım 15mm altında — die-cut hassasiyet riski',
      autoFixable: false,
    });
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
  };
}

function countSharpCorners(svgPath: string, minRadiusMm: number): number {
  // SVG path node'larından ardışık segment açılarını hesapla
  // Açı < 90° ve radius < minRadiusMm → keskin köşe
  // Basitleştirilmiş: L (line-to) komutları arasındaki açı kontrolü
  // Detaylı implementasyon: bezier curve tangent analizi
  return 0; // placeholder — implementasyon gerekli
}
```

### Doğrulama
- 0 konturlü input → `NO_CONTOUR` error
- 12 konturlü input → `TOO_MANY_CONTOURS` warning
- Transparan malzeme + beyaz yok → `WHITE_MISSING` error
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 7/8 — AI Vision Proof Validator (Katman 2)

### Dosya: `src/lib/proof/ai-validator.ts` (yeni)

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const ProofValidationSchema = z.object({
  overall_verdict: z.enum(['pass', 'warn', 'fail']),
  cutline: z.object({
    verdict: z.enum(['pass', 'warn', 'fail']),
    edge_tracking: z.enum(['accurate', 'minor_deviation', 'major_deviation']),
    offset_adequate: z.boolean(),
    sharp_corners: z.boolean(),
    noise_contours: z.boolean(),
    complexity: z.enum(['simple', 'moderate', 'complex', 'too_complex']),
    issues_tr: z.array(z.string()),
  }),
  white_layer: z.object({
    verdict: z.enum(['pass', 'warn', 'fail', 'not_applicable']),
    within_bounds: z.boolean(),
    overflow: z.boolean(),
    missing_details: z.boolean(),
    edge_quality: z.enum(['clean', 'rough', 'jagged', 'not_applicable']),
    issues_tr: z.array(z.string()),
  }),
  auto_fix_suggestions: z.array(z.object({
    area: z.enum(['cutline', 'white_layer']),
    action: z.string(),
    description_tr: z.string(),
  })),
  pim_message: z.string(),
});

export type ProofAIResult = z.infer<typeof ProofValidationSchema>;

const SYSTEM_PROMPT = `Sen bir matbaa baskı üretim kalite kontrol uzmanısın.
Sana 3 görsel veriliyor:
1. Orijinal müşteri tasarımı
2. Üretilen bıçak (kesim) çizgisi — kırmızı overlay
3. Beyaz katman — mavi overlay (yoksa "beyaz katman yok" denilecek)

BIÇAK KONTROLLERİ:
- Bıçak çizgisi tasarımın dış kenarını doğru takip ediyor mu?
- Offset (taşma payı) yeterli mi? (minimum 1-2mm)
- 90° altı keskin köşeler var mı? (die-cut makinesi için sorun)
- Gürültü konturları var mı? (tasarımla ilgisiz küçük parçalar)
- Karmaşıklık: kontur çok mu detaylı?

BEYAZ KATMAN KONTROLLERİ (varsa):
- Beyaz alan tasarım sınırları içinde mi?
- Dışa taşma var mı?
- İnce yazı/çizgilerde beyaz eksik mi?
- Kenarlar temiz mi yoksa pürüzlü mü?

Pim mesajı Türkçe, samimi, kısa (2 cümle max). "Sen" hitap. Dalkavukluk yasak.`;

export async function validateProofWithAI(
  designImageUrl: string,
  cutlineOverlayUrl: string,
  whiteLayerOverlayUrl: string | null,
): Promise<ProofAIResult> {
  const images = [
    { type: 'image' as const, image: new URL(designImageUrl) },
    { type: 'image' as const, image: new URL(cutlineOverlayUrl) },
  ];

  if (whiteLayerOverlayUrl) {
    images.push({ type: 'image' as const, image: new URL(whiteLayerOverlayUrl) });
  }

  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: ProofValidationSchema,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        ...images,
        { 
          type: 'text', 
          text: whiteLayerOverlayUrl 
            ? '3 görseli karşılaştır: orijinal tasarım, bıçak çizgisi (kırmızı), beyaz katman (mavi).'
            : '2 görseli karşılaştır: orijinal tasarım ve bıçak çizgisi (kırmızı). Beyaz katman yok.'
        },
      ],
    }],
    temperature: 0.3,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(45_000),
  });

  return result.object;
}
```

### Entegrasyon noktası

Bu fonksiyon **sadece** rule-check'te sorun çıktığında çağrılır. Akış:

```typescript
// proof-generating akışı içinde (run-order-proof.ts veya benzeri):
const rules = runProofRuleCheck(input);

if (rules.passed) {
  // Direkt müşteriye sun — AI çağırma
  await updateOrderStatus(orderId, 'proof_pending');
} else {
  // AI ile doğrula
  const aiResult = await validateProofWithAI(designUrl, cutlineOverlayUrl, whiteUrl);
  
  if (aiResult.overall_verdict === 'pass') {
    await updateOrderStatus(orderId, 'proof_pending');
  } else if (aiResult.overall_verdict === 'warn') {
    // Uyarı ile müşteriye sun
    await saveProofValidation(orderId, aiResult);
    await updateOrderStatus(orderId, 'proof_pending');
  } else {
    // Fail — auto-fix dene
    // ... Görev 8'de
  }
}
```

### DB: `proof_validations` tablosu

Migration: `supabase/migrations/100_proof_validations.sql`

```sql
create table if not exists public.proof_validations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  order_item_id uuid,
  design_file_id uuid,
  
  rule_check_passed boolean,
  rule_issues jsonb,
  
  ai_validated boolean default false,
  ai_verdict text check (ai_verdict in ('pass', 'warn', 'fail')),
  ai_cutline jsonb,
  ai_white_layer jsonb,
  ai_suggestions jsonb,
  ai_pim_message text,
  ai_tokens_used integer,
  ai_cost_usd numeric(8,6),
  
  auto_fixed boolean default false,
  fix_log jsonb,
  
  final_verdict text check (final_verdict in ('pass', 'warn', 'fail', 'operator')),
  created_at timestamptz default now()
);

create index proof_validations_order_idx on public.proof_validations(order_id);

alter table public.proof_validations enable row level security;

create policy "Admin reads proof validations"
  on public.proof_validations for select to authenticated
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff')
  ));

-- Müşteri kendi siparişinin validation'ını görebilir
create policy "Customer reads own proof validations"
  on public.proof_validations for select to authenticated
  using (exists (
    select 1 from public.orders where id = order_id and user_id = auth.uid()
  ));
```

### Doğrulama
- Rule check sorun buldu → AI çağrılıyor → verdict dönüyor
- `proof_validations` tablosuna kayıt yazılıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 8/8 — Auto-Fix Engine + Orkestratör

### Dosya: `src/lib/proof/auto-fix.ts` (yeni)

```typescript
export interface AutoFixResult {
  fixed: boolean;
  fixedCutlineSvg?: string;
  fixedWhitePng?: string;
  fixLog: string[];
  needsRevalidation: boolean;
}

export async function autoFixProof(
  input: ProofValidationInput,
  aiResult: ProofAIResult,
): Promise<AutoFixResult> {
  const fixes: string[] = [];
  let cutlineSvg = input.cutlineSvgPath;

  // F1: Gürültü konturları temizle
  if (aiResult.cutline.noise_contours) {
    cutlineSvg = removeNoiseContours(cutlineSvg, 0.05); // %5 alan altı sil
    fixes.push('Gürültü konturları temizlendi');
  }

  // F2: Keskin köşeleri yuvarla
  if (aiResult.cutline.sharp_corners) {
    cutlineSvg = roundSharpCorners(cutlineSvg, 0.5); // min 0.5mm radius
    fixes.push('Keskin köşeler 0.5mm radius ile yuvarlandı');
  }

  // F3: Offset artır
  if (!aiResult.cutline.offset_adequate) {
    cutlineSvg = expandOffset(cutlineSvg, 1.5); // 1.5mm offset
    fixes.push('Bıçak ofseti 1.5mm olarak ayarlandı');
  }

  // F4: Beyaz taşma kırp (beyaz katman varsa)
  if (aiResult.white_layer.overflow) {
    // Beyaz PNG'yi bıçak SVG mask ile kırp
    fixes.push('Beyaz katman taşması kırpıldı');
  }

  // F5: Beyaz eksik doldur
  if (aiResult.white_layer.missing_details) {
    // Alpha kanalından yeniden üret, threshold düşür (96 → 64)
    fixes.push('İnce detaylardaki beyaz eksikliği dolduruldu');
  }

  return {
    fixed: fixes.length > 0,
    fixedCutlineSvg: cutlineSvg,
    fixLog: fixes,
    needsRevalidation: fixes.length > 0,
  };
}

// SVG manipülasyon helper'ları
function removeNoiseContours(svgPath: string, areaThreshold: number): string {
  // Çoklu path'leri ayır, bounding box alanı < threshold × total area olanları sil
  return svgPath; // implementasyon gerekli
}

function roundSharpCorners(svgPath: string, minRadius: number): string {
  // L komutları arasındaki keskin açılara arc ekle
  return svgPath; // implementasyon gerekli
}

function expandOffset(svgPath: string, offsetMm: number): string {
  // Path'i dışa doğru genişlet (stroke → fill dönüşümü)
  return svgPath; // implementasyon gerekli
}
```

### Orkestratör: `src/lib/proof/orchestrator.ts` (yeni)

Tüm proof akışını yöneten ana modül:

```typescript
export async function runProofPipeline(
  orderId: string,
  itemId: string,
  designFileId: string,
  designFileUrl: string,
  fileName: string,
  materialKey: string,
  designWidth: number,
  designHeight: number,
): Promise<{ status: 'proof_pending' | 'operator_review'; validationId: string }> {
  
  const fileCategory = categorizeFile(fileName);
  
  // JPG → bıçak/beyaz üretilmez, müşteri şekil seçecek
  if (fileCategory === 'qc_only') {
    return { status: 'proof_pending', validationId: '' };
    // JpgShapeSelector müşteri tarafında gösterilecek
  }

  // 1. Bıçak tespiti
  let cutline = await detectCutlineInFile(designFileUrl, fileName, '');
  
  // 2. Bıçak yoksa → POC üret (mevcut akış, değiştirme)
  // POC iframe postMessage ile cutline SVG döner
  // Bu adım mevcut proof_generating akışında zaten var
  
  // 3. Beyaz katman (gerekiyorsa)
  let whiteResult: WhiteLayerResult = { generated: false, reason: 'not_needed' };
  if (needsWhiteLayer(materialKey) && cutline.svgPath) {
    whiteResult = await generateWhiteLayer({
      designFileUrl, cutlineSvgPath: cutline.svgPath!,
      materialKey, designWidth, designHeight,
    });
  }

  // 4A. Rule check
  const rules = runProofRuleCheck({
    designWidth, designHeight,
    cutlineSvgPath: cutline.svgPath || '',
    cutlinePartCount: cutline.partCount || 0,
    cutlineOffset: 1.5, // default
    whiteLayerExists: whiteResult.generated,
    whiteCoverage: whiteResult.coverage || 0,
    materialKey,
    fileCategory,
  });

  // Sorun yoksa → direkt müşteriye
  if (rules.passed) {
    const vid = await saveValidation(orderId, itemId, { rules, ai: null, fix: null, verdict: 'pass' });
    return { status: 'proof_pending', validationId: vid };
  }

  // 4B. AI Vision doğrulama
  const aiResult = await validateProofWithAI(
    designFileUrl,
    renderCutlineOverlay(cutline.svgPath!, designWidth, designHeight),
    whiteResult.whitePngUrl || null,
  );

  if (aiResult.overall_verdict === 'pass' || aiResult.overall_verdict === 'warn') {
    const vid = await saveValidation(orderId, itemId, { rules, ai: aiResult, fix: null, verdict: aiResult.overall_verdict });
    return { status: 'proof_pending', validationId: vid };
  }

  // 4C. Auto-fix dene (max 2 deneme)
  for (let attempt = 0; attempt < 2; attempt++) {
    const fix = await autoFixProof(
      { ...rules, cutlineSvgPath: cutline.svgPath! } as any,
      aiResult,
    );

    if (!fix.fixed) break;

    // Düzeltilmiş proof ile tekrar rule check
    const recheck = runProofRuleCheck({ /* düzeltilmiş değerlerle */ } as any);
    if (recheck.passed) {
      const vid = await saveValidation(orderId, itemId, { rules: recheck, ai: aiResult, fix, verdict: 'pass' });
      return { status: 'proof_pending', validationId: vid };
    }
  }

  // Auto-fix de başarısız → operatöre
  const vid = await saveValidation(orderId, itemId, { rules, ai: aiResult, fix: null, verdict: 'operator' });
  return { status: 'operator_review', validationId: vid };
}
```

### Mevcut akışa entegrasyon

`src/lib/agents/run-order-qc.ts` dosyasında QC tamamlandıktan sonra proof pipeline çağrılır. Mevcut `proof_generating` status'una geçiş noktasında `runProofPipeline()` ekle.

### Müşteri tarafı: /onay sayfası güncellemesi

`/onay/[orderId]` sayfasında:
- `proof_validations` tablosundan validation sonucunu çek
- `ai_pim_message` varsa → Pim mesajı olarak göster
- `ai_cutline.issues_tr` veya `ai_white_layer.issues_tr` varsa → sarı uyarı banner
- `final_verdict === 'warn'` → "Kontrol ettik, küçük uyarılar var — aşağıya bak" banner

### Doğrulama
- PNG dosya yüklü sipariş → proof pipeline çalışıyor
- Rule check sorun buldu → AI çağrıldı → sonuç DB'ye yazıldı
- AI fail → auto-fix denendi → tekrar kontrol → sonuç
- /onay sayfasında AI mesajı ve uyarılar görünüyor
- `npx tsc --noEmit` → 0 hata

---

## Uygulama Sırası

1. **Görev 1** — Dosya tipi util + EPS engeli (temel, diğerleri buna bağlı)
2. **Görev 2** — proof_validating status (migration)
3. **Görev 3** — JPG hazır şekil seçici (müşteri UX)
4. **Görev 4** — Bıçak tespit modülü
5. **Görev 5** — Beyaz katman modülü
6. **Görev 6** — Rule-based validator (Katman 1)
7. **Görev 7** — AI Vision validator + DB (Katman 2)
8. **Görev 8** — Auto-fix + orkestratör (her şeyi birleştirir)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
*Akış referansı: docs/PROOF-EDITOR-AKIS-V3.md*
