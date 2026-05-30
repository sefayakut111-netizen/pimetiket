# Bıçak Algılama Entegrasyonu — Embedded Cutline Override Fix

## SORUN
Müşteri tasarımın **içine** bıçak çizgisi koymuş olsa bile (SVG `<clipPath>`, PDF `CutContour` annotation, PSD "die" layer, PNG alpha), sistem yine POC iframe'i ile **dış bounding box** çiziyor. Sonuç: ekranda iki bıçak görünüyor — müşterininki içeride + sistemin pembe kesik dış çizgisi.

## KÖK NEDEN
`src/lib/proof/cutline-detect.ts` zaten tespit yapıyor (`detectCutlineInFile`) ama:
- `orchestrator.ts:157` sadece `cutlineSvgPath` boşsa detect çağırıyor — diğer yollarda atlanıyor
- `generate-cutline-headless.ts:96-107` POC'a `detectedCutlineSvg` parametresi geçmiyor
- POC her zaman sıfırdan bounding-box üretiyor
- Tespit edilen embedded cutline `cutline_designs.detected_cut_contour_names` JSON'a yazılıyor ama **kullanılmıyor**

## ÇÖZÜM — 5 GÖREV

---

### GÖREV 1/5 — Magenta Spot Color Tespiti Ekle

Matbaa standardı: tasarımcılar bıçak çizgisini **magenta (#FF00FF) spot color** olarak çizer (Adobe Illustrator'da "CutContour" swatch).

#### Dosya: `src/lib/proof/cutline-detect.ts`

`detectCutlineFromSvg` fonksiyonuna ekle: SVG'de `stroke="#FF00FF"`, `stroke="magenta"`, veya `stroke="rgb(255,0,255)"` olan path'leri öncelikli ara.

```typescript
// detectCutlineFromSvg içinde, mevcut id regex aramasından ÖNCE:
const magentaPath = svgDoc.querySelector(
  'path[stroke="#FF00FF" i], path[stroke="magenta" i], path[stroke="#ff00ff" i], path[stroke="rgb(255,0,255)"]'
);
if (magentaPath) {
  const d = magentaPath.getAttribute('d');
  if (d) {
    return {
      found: true,
      source: 'file_embedded',
      svgPath: d,
      partCount: 1,
      detectionMethod: 'magenta_spot_color',
    };
  }
}
```

`CutlineDetectResult` interface'ine `detectionMethod?: 'magenta_spot_color' | 'named_layer' | 'alpha_channel' | 'pdf_annotation' | 'psd_layer'` ekle.

PDF için `pdf-lib` ile spot color "CutContour" / "Thru-cut" arama da ekle (mevcut annotation aramasına ek olarak).

**Doğrulama:** Magenta stroke içeren bir test SVG'sini upload et → `source: 'file_embedded'` + `detectionMethod: 'magenta_spot_color'`.

---

### GÖREV 2/5 — Orchestrator: Detect Sonucunu HER YOLDA Çağır

#### Dosya: `src/lib/proof/orchestrator.ts`

**Mevcut (line 154-167):**
```typescript
let cutlinePath = input.cutlineSvgPath ?? "";
let partCount = cutlinePath ? 1 : 0;
if (!cutlinePath) {  // ← sadece boşsa
  const detected = await detectCutlineInFile(...);
  ...
}
```

**Yeni:** Detect her zaman çalışsın, embedded varsa öncelik versin:

```typescript
// HER ZAMAN detect et
const detected = await detectCutlineInFile(
  input.designFileUrl,
  input.fileName,
  ""
);

let cutlinePath: string;
let partCount: number;
let cutlineSource: 'file_embedded' | 'auto_generated' | 'prior';

if (detected.found && detected.valid !== false && detected.svgPath) {
  // Embedded varsa önceliklendir — POC'u atla
  cutlinePath = detected.svgPath;
  partCount = detected.partCount ?? 1;
  cutlineSource = 'file_embedded';
} else if (input.cutlineSvgPath) {
  // Önceki kayıt varsa kullan
  cutlinePath = input.cutlineSvgPath;
  partCount = 1;
  cutlineSource = 'prior';
} else {
  // POC bounding-box (fallback)
  cutlinePath = "";  // POC üretecek
  partCount = 0;
  cutlineSource = 'auto_generated';
}
```

`cutlineSource` değerini pipeline çıktısına ekle ve `proof_validations.cutline_source` kolonuna yaz (yeni kolon — migration 115).

**Doğrulama:** Embedded cutline'lı dosya → POC çağrılmıyor, `cutline_source = 'file_embedded'`.

---

### GÖREV 3/5 — Headless POC'a `detectedCutlineSvg` Parametresi Ekle

#### Dosya: `src/lib/agents/generate-cutline-headless.ts`

`GenerateCutlineHeadlessArgs` interface'ine ekle:
```typescript
export interface GenerateCutlineHeadlessArgs {
  // ... mevcut alanlar ...
  detectedCutlineSvg?: string;  // YENİ — varsa POC bunu kullanır, bounding-box üretmez
  detectionSource?: string;      // YENİ — 'magenta_spot_color' vb.
}
```

`URLSearchParams` bloğunda (line 96-107):
```typescript
const params = new URLSearchParams({
  embed: "1",
  designUrl: args.designUrl,
  // ... mevcut paramlar ...
});

if (args.detectedCutlineSvg) {
  params.set('embeddedCutline', args.detectedCutlineSvg);
  params.set('embeddedSource', args.detectionSource ?? 'unknown');
  params.set('mode', 'use-embedded');  // POC'a "üretme, bunu kullan" sinyali
}
```

#### Dosya: `src/lib/agents/run-order-cutline.ts`

`detectCutlineInFile` sonucunu `generateCutlineHeadless`'a geç (line 99-107 üzerinde):
```typescript
// generateCutlineHeadless çağrısından ÖNCE:
const detected = await detectCutlineInFile(
  signedData.signedUrl,
  df.original_name,
  df.mime_type ?? ""
);

const result = await generateCutlineHeadless({
  designUrl: signedData.signedUrl,
  designName: df.original_name,
  designMime: df.mime_type,
  material,
  orderId,
  itemId: item.id,
  siteUrl,
  detectedCutlineSvg: detected.found && detected.valid !== false ? detected.svgPath : undefined,
  detectionSource: detected.detectionMethod,
});
```

#### Dosya: `public/poc.html` (veya POC iframe HTML'i)

POC kodunda yeni mod handling: `mode === 'use-embedded'` ise URL params'tan `embeddedCutline`'ı oku, kendi bounding-box logic'ini **atla**, doğrudan postMessage ile bu SVG'yi döndür.

**Doğrulama:** Embedded cutline'lı upload → DevTools Network'te POC iframe URL'inde `embeddedCutline=` parametresi var, sonuç müşterinin orijinal cutline'ı.

---

### GÖREV 4/5 — DB: `cutline_source` kolonu

#### Migration: `supabase/migrations/115_cutline_source_tracking.sql`

```sql
-- Bıçak kaynağını izle (file_embedded | auto_generated | prior | geo_shape | operator)
alter table public.cutline_designs
  add column if not exists cutline_source text
  check (cutline_source in ('file_embedded', 'auto_generated', 'prior', 'geo_shape', 'operator'))
  default 'auto_generated';

alter table public.cutline_designs
  add column if not exists detection_method text;
  -- 'magenta_spot_color' | 'named_layer' | 'alpha_channel' | 'pdf_annotation' | 'psd_layer'

comment on column public.cutline_designs.cutline_source is
  'Bıçak kaynağı: file_embedded = müşteri dosyasında zaten vardı, auto_generated = POC ürettı';
```

`save-cutline-edit.ts` (lines 319-345) içine yeni kolonları yazan kısmı ekle.

**Doğrulama:** Yeni siparişler için DB'de `cutline_source` doluyor.

---

### GÖREV 5/5 — /onay UI: "Müşteri Bıçağı Kullanıldı" Rozeti

#### Dosya: `src/app/onay/[orderId]/page.tsx`

Cutline preview'un altına (mevcut Pim mesajının yanına) küçük rozet:

```typescript
{activeCutline?.cutline_source === 'file_embedded' && (
  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yesil-soft/30 text-yesil-koyu text-[11px] font-medium">
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
      <path d="M5 8L2 5l1-1 2 2 4-4 1 1z"/>
    </svg>
    Tasarımındaki bıçak çizgisi kullanıldı
  </div>
)}

{activeCutline?.cutline_source === 'auto_generated' && (
  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mavi-soft/30 text-mavi-koyu text-[11px] font-medium">
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
    Bıçak çizgisi otomatik üretildi
  </div>
)}
```

Pim mesajını da koşullu yap:
- `file_embedded`: "Tasarımının içindeki bıçak çizgisini olduğu gibi kullandım. İncele ve onayla."
- `auto_generated`: "Tasarımının dış sınırına otomatik bıçak çizgisi koydum. İstersen düzenleyebilirsin."

**Doğrulama:** Magenta stroke içeren SVG yükle → /onay'da yeşil "kullanıldı" rozeti, müşterinin orijinal cutline'ı.

---

## TEST PLANI

| Test | Beklenen Sonuç |
|---|---|
| Magenta stroke'lu SVG yükle | `source=file_embedded`, `detection=magenta_spot_color`, POC çağrılmaz |
| `<path id="cutline">` SVG yükle | `source=file_embedded`, `detection=named_layer` |
| PSD "die" layer ile yükle | `source=file_embedded`, `detection=psd_layer` |
| PDF "CutContour" annotation | `source=file_embedded`, `detection=pdf_annotation` |
| Düz PNG (alpha yok) | `source=auto_generated`, POC çalışır |
| JPG yükle | `source=auto_generated`, POC çalışır |

## UYGULAMA SIRASI

1. Görev 1 — Magenta tespiti (15 dk)
2. Görev 4 — Migration 115 (5 dk, önce DB)
3. Görev 2 — Orchestrator detect öncelik (20 dk)
4. Görev 3 — Headless POC paramı (30 dk — POC HTML değişikliği dahil)
5. Görev 5 — UI rozet (10 dk)

**Toplam: ~80 dk**

Her görev sonrası `npx tsc --noEmit` + commit. Migration 115 önce DB'ye apply.

## NOTLAR
- `CLAUDE.md` sefaRules: cüzdan/puan/üyelik indirimi YASAK (bu görevde alakası yok ama hatırlatma)
- POC HTML değişikliği (Görev 3) tarayıcıda test edilmeli — Cursor dosyayı değiştirdikten sonra `npm run dev` ile bir embedded cutline'lı dosya yükle, /onay'da sonucu gör
- Migration 115 idempotent (`add column if not exists` + `do nothing` constraint).
