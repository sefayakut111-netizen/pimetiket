# Editör — UX/A11y + Kesim Mantığı Fix

> Claude kod-review'ından çıkan 11 bug: görünüm/erişilebilirlik (1–6) + kesim mantığı (7–8) +
> bıçak etkileşimi/düzen (9–11). Hepsi pre-order editör (canvas-workbench) panelinde. Sırayla uygula.
> Dosyalar: `src/lib/editor/offset-label.ts`, `src/components/editor/EditorShell.tsx`,
> `src/components/editor/EditorPreviewToolbar.tsx`, `src/lib/editor/alpha-contour.ts`,
> `src/components/editor/PikasoEditorCanvas.tsx`, `src/lib/editor/cutline/contour.ts`,
> `src/lib/editor/cutline/contour-worker-client.ts`, `src/lib/editor/cutline/shapes.ts`,
> `src/lib/editor/pikaso/placement-presets.ts`, `src/lib/editor/pikaso/render-cutline.ts`,
> `src/components/editor/CutColorNote.tsx`.
>
> KISITLAR: `/onay` ve `/duzenle` (sipariş-sonrası) akışına DOKUNMA. OpenCV refine yolu
> (`contour-opencv-algorithms.ts` dilate/erode) zaten doğru — DOKUNMA. Sefa kuralları geçerli
> (CLAUDE.md). `tsc --noEmit` temiz kalmalı, mevcut testler bozulmamalı.

---

## GÖREV 1/6 — 0 mm'de kesim mesafesi etiketi boş kalıyor (🔴 görünüm)

**Sorun:** Sağ panel "Kesim mesafesi" range input `min=-5 step=0.1`. Tarayıcı 0'a snap ederken
kayan-nokta artığı (ör. `-1e-16`) verebiliyor; `offsetMm === 0` tutmuyor, `-0` da oluşabiliyor →
"Sıfır kesim" etiketi gösterilmiyor, kullanıcı boş/belirsiz değer görüyor.

**Mimari (neden):** Sınır değerde label fonksiyonu daima anlamlı metin döndürmeli. Değer kaynakta
(onChange) **ve** label fonksiyonunda 1 ondalığa snap'lenmeli; `-0` → `0`'a normalize edilmeli.

**Yapılacak — `src/lib/editor/offset-label.ts`:** Dosyanın başına `snapMm` helper ekle ve iki
fonksiyonun girişini snap'le:
```ts
/** Range input'un step kayması (ör. -1e-16) sıfırı boş bırakmasın diye snap. */
function snapMm(offsetMm: number): number {
  const v = Math.round(offsetMm * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
}

export function formatOffsetLabel(offsetMm: number): string {
  const v = snapMm(offsetMm);
  if (v === 0) return "Sıfır kesim";
  if (v < 0) return `${Math.abs(v).toFixed(1)} mm içeri`;
  return `${v.toFixed(1)} mm dışarı`;
}

export function offsetNoteText(offsetMm: number): string | null {
  offsetMm = snapMm(offsetMm);
  if (offsetMm === 0) {
    // ...mevcut gövde aynen kalır...
```

**Yapılacak — `src/components/editor/EditorShell.tsx`:** Offset range `onChange`'ini yuvarla
(`id="editor-offset-right"`):
```tsx
onChange={(e) =>
  setOffsetMm(Math.round(parseFloat(e.target.value) * 10) / 10)
}
```

**Doğrulama:** Slider'ı tam 0'a çek → sağda **"Sıfır kesim"** yazar (boş kalmaz). -3 → "3.0 mm içeri",
+2 → "2.0 mm dışarı" bozulmadan çalışır.

---

## GÖREV 2/6 — "Otomatik bıçak oluştur" butonu kırpılıyor (🔴 görünüm)

**Sorun:** Sol "Bıçak" panelinde buton `min-w-0 flex-1` ile fit-buton grubunun (Ortala/Doldur/Sığdır)
yanında sıkışıyor. Button'da `whitespace-nowrap` var; `aside` `overflow-y-auto` olduğundan tarayıcı
overflow-x'i de `auto` yapıp taşan metni yatayda kırpıyor → "matik bıçak olu" görünüyor.

**Mimari (neden):** Dar (240–300px) panelde tek satıra hem 3 fit buton hem geniş birincil buton
sığmaz. Dikey istif + tam genişlik buton kırpılmayı tamamen kaldırır.

**Yapılacak — `src/components/editor/EditorShell.tsx`:** Sol paneldeki fit butonları + "Otomatik bıçak
oluştur" sarmalayan `<div className="mt-3 flex flex-wrap items-center gap-2">` bloğunu şununla değiştir:
```tsx
<div className="mt-3 space-y-2">
  {design ? (
    <div className="flex gap-1" role="group" aria-label="Görsel yerleştirme">
      <button
        type="button"
        title="Ortala"
        onClick={handleFitCenter}
        className="h-8 flex-1 px-2 rounded-lg border border-gri-200 text-[11px] font-semibold whitespace-nowrap hover:bg-gri-50"
      >
        Ortala
      </button>
      <button
        type="button"
        title="Doldur"
        onClick={handleFitCover}
        className="h-8 flex-1 px-2 rounded-lg border border-gri-200 text-[11px] font-semibold whitespace-nowrap hover:bg-gri-50"
      >
        Doldur
      </button>
      <button
        type="button"
        title="Sığdır"
        onClick={handleFitContain}
        className="h-8 flex-1 px-2 rounded-lg border border-gri-200 text-[11px] font-semibold whitespace-nowrap hover:bg-gri-50"
      >
        Sığdır
      </button>
    </div>
  ) : null}
  <Button type="button" variant="primary" block onClick={openAutoBlade}>
    Otomatik bıçak oluştur
  </Button>
</div>
```

**Doğrulama:** Görsel yüklüyken sol panelde buton metni tam görünür ("Otomatik bıçak oluştur"),
hiçbir genişlikte kırpılmaz. Fit butonları satırı eşit 3 sütuna bölünür.

---

## GÖREV 3/6 — "Sığdır" glyph kırpılması ("Sığ ır") (🟠 görünüm)

**Sorun:** Fit butonlarında `whitespace-nowrap` yoktu; dar/sıkışık alanda metin satır kırma veya
glyph kesilmesi yaşıyordu ("d" kayboluyor). Üst toolbar'daki "Sığdır" da aynı riske açık.

**Yapılacak:**
- GÖREV 2'deki fit butonlarına `whitespace-nowrap` zaten eklendi (eşit `flex-1` genişlikle birlikte
  sıkışma kalkar) — başka iş yok.
- `src/components/editor/EditorPreviewToolbar.tsx` → `EditorZoomControls` içindeki "Sığdır"
  butonunun className'ine `whitespace-nowrap` ekle:
```tsx
className="h-8 px-2.5 rounded-lg border border-gri-200 text-[11px] font-semibold whitespace-nowrap hover:bg-gri-50"
```

**Doğrulama:** Hem üst toolbar hem sol panel "Sığdır" tam ve tek satır render olur.

---

## GÖREV 4/6 — Katman aç/kapa durum belirsizliği (🟠 UX)

**Sorun:** "Bıçak / Bleed / Safe / Beyaz" `role="switch"` ama açık/kapalı görsel ayrımı zayıf
(sadece hafif tint). Kullanıcı hangisinin aktif olduğunu anlamıyor.

**Yapılacak — `src/components/editor/EditorPreviewToolbar.tsx`** → `EditorLayerToggles` içindeki
`<button>`'u durum noktası + net kontrast + `title` ile güncelle:
```tsx
<button
  key={id}
  type="button"
  role="switch"
  aria-checked={on}
  aria-label={`${label} katmanı`}
  title={on ? `${label} açık` : `${label} kapalı`}
  onClick={() => onToggleLayer(id, !on)}
  className={cn(
    "inline-flex h-8 items-center gap-1.5 px-3 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors",
    on
      ? "bg-pim-mercan-tint text-pim-mercan ring-1 ring-pim-mercan"
      : "bg-white text-gri-500 ring-1 ring-gri-200"
  )}
>
  <span
    aria-hidden
    className={cn(
      "inline-block h-2 w-2 rounded-full",
      on ? "bg-pim-mercan" : "bg-gri-300"
    )}
  />
  {label}
</button>
```

**Doğrulama:** Açık katman = mercan tint + tam opak ring + dolu mercan nokta. Kapalı = beyaz zemin +
gri çerçeve + soluk gri nokta. Aktif/pasif bir bakışta ayırt edilir.

---

## GÖREV 5/6 — Range slider erişilebilir isimleri (🟡 a11y)

**Sorun:** "Kesim mesafesi" ve "Yumuşatma" range input'larının programatik adı zayıf; ekran okuyucu
ham sayı okuyor.

**Yapılacak — `src/components/editor/EditorShell.tsx`:**
- Offset range'e (`id="editor-offset-right"`):
  ```tsx
  aria-label="Kesim mesafesi"
  aria-valuetext={formatOffsetLabel(offsetMm)}
  ```
- Smoothness range'e (`id="editor-smoothness"`):
  ```tsx
  aria-label="Bıçak yumuşatma"
  aria-valuetext={`${smoothness}%`}
  ```

**Doğrulama:** Ekran okuyucu "Kesim mesafesi, 2.0 mm dışarı" / "Bıçak yumuşatma, %40" şeklinde
anlamlı isim+değer okur.

---

## GÖREV 6/6 — Büyük boş turuncu çerçeve / küçük figür (🟠 görünüm + mimari)

**Sorun (kullanıcı raporu):** Yüklenen görselde turuncu kesikli baskı çerçevesi figürden çok daha
büyük; figür üst-ortada küçük kalıyor, altında geniş boş bej alan var.

**Kök neden (teşhis edildi):**
- Turuncu kesikli dikdörtgen = baskı/etiket alanı çerçevesi (`renderLabelWorkspace`,
  `src/lib/editor/pikaso/render-label-workspace.ts`), boyutu `widthMm × heightMm`.
- `widthMm/heightMm` yükleme anında **görselin TÜM piksel boyutundan** öneriliyor
  (`onDesignLoaded?.({ widthPx: natW, heightPx: natH })` → `suggestMmFromPixels`,
  `PikasoEditorCanvas.tsx` ≈L656).
- Görsel de etiket alanına **tüm bitmap (şeffaf kenarlar dahil)** "contain" ile yerleştiriliyor
  (`PikasoEditorCanvas.tsx` ≈L629-650).
- PNG'nin etrafında geniş **şeffaf boşluk** olduğunda: çerçeve bitmap'i doğru sarıyor ama görünür
  figür (opak içerik) bitmap'in küçük bir kısmı → büyük boş çerçeve izlenimi.

**Mimari (neden böyle çözülmeli):** Hem boyut önerisi hem yerleşim, bitmap yerine **opak içerik
sınır kutusuna (alpha-trim bbox)** dayanmalı. İkisi de aynı bbox'ı kullanınca: etiket aspect =
figür aspect = yerleşim aspect → figür çerçeveyi doldurur, çerçeve figüre oturur. Kontur kesim
(opak piksel izleme + `placementMm`) zaten yeni transform'la tutarlı kalır, bozulmaz.

**Yapılacak (a) — `src/lib/editor/alpha-contour.ts`:** Sona yeni util ekle:
```ts
export interface OpaqueBoundsPx {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Görselin opak (alpha>eşik) içerik sınır kutusu — doğal piksel uzayında.
 *  Şeffaf kenar boşluklarını kırpmak için. Alpha yok / CORS-tainted / tamamen
 *  şeffaf ise tüm görseli (kırpmasız) döndürür. */
export function getOpaqueBoundsPx(
  image: HTMLImageElement,
  alphaThreshold = 10,
  maxDim = 1024
): OpaqueBoundsPx {
  const nw = image.naturalWidth || image.width;
  const nh = image.naturalHeight || image.height;
  const full: OpaqueBoundsPx = { x: 0, y: 0, w: nw, h: nh };
  if (nw < 1 || nh < 1) return full;
  const scale = Math.min(1, maxDim / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return full;
  ctx.drawImage(image, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return full; // CORS-tainted → kırpma yapma
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return full; // tamamen şeffaf → kırpma yok
  const inv = 1 / scale;
  return {
    x: Math.max(0, Math.floor(minX * inv)),
    y: Math.max(0, Math.floor(minY * inv)),
    w: Math.min(nw, Math.ceil((maxX - minX + 1) * inv)),
    h: Math.min(nh, Math.ceil((maxY - minY + 1) * inv)),
  };
}
```

**Yapılacak (b) — `src/components/editor/PikasoEditorCanvas.tsx`** (≈L629-656, görsel insert bloğu):
`getOpaqueBoundsPx`'i import et; yerleşimi tam bitmap yerine **opak bbox** üzerinden kur ve
`onDesignLoaded`'a bbox boyutunu ver:
```ts
const bounds = getOpaqueBoundsPx(htmlImg); // opak içerik bbox (doğal px)
const contentW = bounds.w;
const contentH = bounds.h;

const marginMm = 2;
const maxWmm = widthMm - marginMm * 2;
const maxHmm = heightMm - marginMm * 2;
const aspect = contentW / contentH; // ESKİ: natW / natH
let drawWMm = maxWmm;
let drawHMm = drawWMm / aspect;
if (drawHMm > maxHmm) {
  drawHMm = maxHmm;
  drawWMm = drawHMm * aspect;
}
const scale = mmToPx(drawWMm) / contentW; // bbox'ı alana sığdıran ölçek

// Etikette ortalanmış çizim alanının sol-üst köşesi
const drawAreaX = labelX + mmToPx((widthMm - drawWMm) / 2);
const drawAreaY = labelY + mmToPx((heightMm - drawHMm) / 2);

const shape = await editor.shapes.image.insert(file, {
  // Görsel tam bitmap olarak eklenir; opak içerik (bounds) çizim alanına
  // otursun diye bbox kökeni kadar geri kaydırılır:
  x: drawAreaX - bounds.x * scale,
  y: drawAreaY - bounds.y * scale,
  width: natW,
  height: natH,
  scaleX: scale,
  scaleY: scale,
  draggable: true,
  name: USER_IMAGE_NAME,
});
imageShapeRef.current = shape;
shape.select();
syncLabelWorkspace();
syncEditorZOrder(editor);

onDesignLoaded?.({ widthPx: contentW, heightPx: contentH }); // ESKİ: natW, natH
```

**KISIT:** `width: natW, height: natH` ve `htmlImageRef = htmlImg` (tam görsel) AYNEN kalır —
kontur kesim opak pikselleri tam görsel uzayında izleyip `placementMm` ile eşler; bunu bozma.
JPG / alpha'sız / CORS-tainted görselde `getOpaqueBoundsPx` tüm görseli döndürür → davranış bugünküyle
birebir aynı (regresyon yok).

**Doğrulama:** Etrafında geniş şeffaf boşluk olan bir PNG yükle → figür baskı çerçevesini (2mm
marjla) **doldurur**, turuncu çerçeve figüre oturur, alttaki büyük boş alan kaybolur. Düz JPG yükle →
eskisi gibi tüm görsel alana sığar (değişiklik yok). "Otomatik bıçak oluştur" (kontur) → kesim hattı
figürü doğru sarar. `tsc --noEmit` temiz.

---

## GÖREV 7/8 — Kesim mesafesi merkezden ölçekliyor, offset yapmıyor (🔴 mantık)

**Sorun (kullanıcı raporu):** Kesim mesafesi slider'ı sürüklenirken bıçak, kontur **merkezinden
baz alınarak ölçekleniyor** (orantılı büyüme) — gerçek offset (her noktadan eşit dik mesafe) değil.
Merkeze uzak bölgeler daha çok genişliyor, şekil "balon" gibi şişiyor.

**Kök neden (teşhis edildi):** Canlı/hızlı önizleme yolu `expandHullFromCentroid` kullanıyor
(`src/lib/editor/alpha-contour.ts`) — centroid'den `1 + expandPx/avgR` faktörüyle radyal ölçek.
Çağrı yerleri:
- `src/lib/editor/cutline/contour.ts` ≈L35 (`computeContourPathsPxMultiFast`)
- `src/lib/editor/cutline/contour-worker-client.ts` ≈L51 (`fallbackFastPaths`)

OpenCV refine yolu (`contour-opencv-algorithms.ts`, `dilate`/`erode`, kernel `2*|off|+1`) zaten
**gerçek offset** — doğru. Yani kullanıcı, refine gelene kadarki canlı önizlemede yanlış davranışı
görüyor. İkisi tutarlı olmalı.

**Mimari (neden):** Hızlı önizleme de **paralel offset (parallel curve / miter)** kullanmalı: her
köşeyi komşu kenar normallerinin açıortayı yönünde `offsetPx` kadar taşı. Bu, dilate/erode ile aynı
"eşit dik mesafe" geometrisini verir; merkezden ölçekleme tamamen kalkar.

**Yapılacak (a) — `src/lib/editor/alpha-contour.ts`:** Sona gerçek offset util'i ekle (mevcut
`expandHullFromCentroid`'i SİLME — başka import varsa kırılmasın, sadece artık çağırmayacağız):
```ts
function unitPerp(ex: number, ey: number, sign: number): Point2 {
  // sağ-el normal (ey,-ex); sign winding düzeltmesi (CCW/CW)
  const nx = ey * sign;
  const ny = -ex * sign;
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
}

/** Gerçek paralel offset — her köşeyi açıortay normal yönünde offsetPx kadar taşır.
 *  Pozitif = dışarı, negatif = içeri. OpenCV dilate/erode ile aynı "eşit dik mesafe"
 *  mantığı; merkezden ölçekleme DEĞİL. Konkav köşede miter sınırlanır (sivri uç guard). */
export function offsetPolygonPx(ring: Point2[], offsetPx: number): Point2[] {
  const n = ring.length;
  if (n < 3 || offsetPx === 0) return ring.slice();
  let area = 0; // signed area → winding (CCW>0)
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area >= 0 ? 1 : -1;
  const out: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const n1 = unitPerp(cur.x - prev.x, cur.y - prev.y, sign);
    const n2 = unitPerp(next.x - cur.x, next.y - cur.y, sign);
    let bx = n1.x + n2.x;
    let by = n1.y + n2.y;
    const blen = Math.hypot(bx, by);
    if (blen < 1e-6) {
      bx = n1.x; // 180° dönüş guard
      by = n1.y;
    } else {
      bx /= blen;
      by /= blen;
    }
    const cosHalf = bx * n1.x + by * n1.y;
    const miter = offsetPx / Math.max(Math.abs(cosHalf), 0.25);
    out.push({ x: cur.x + bx * miter, y: cur.y + by * miter });
  }
  return out;
}
```

**Yapılacak (b) — `src/lib/editor/cutline/contour.ts`:** import'u ve çağrıyı değiştir:
```ts
import { hullFromImage, offsetPolygonPx } from "@/lib/editor/alpha-contour";
// ...
const expanded = offsetPolygonPx(baseHull, expandPx); // ESKİ: expandHullFromCentroid
```

**Yapılacak (c) — `src/lib/editor/cutline/contour-worker-client.ts`:** aynı şekilde:
```ts
import { hullFromImage, offsetPolygonPx } from "@/lib/editor/alpha-contour";
// fallbackFastPaths içinde:
const expanded = offsetPolygonPx(baseHull, expandPx); // ESKİ: expandHullFromCentroid
```

**Doğrulama:** Kontur bıçağı seç → kesim mesafesi slider'ını sürükle. Bıçak hattı, görselin
**tüm çevresinden eşit mesafede** açılıp daralmalı (merkezden orantılı şişme YOK). Pozitif değerde
dışarı, negatif değerde içeri eşit ofset. Birkaç saniye sonra OpenCV refine gelince hat aynı yerde
kalmalı (önizleme ↔ refine sıçraması olmamalı). `tsc --noEmit` temiz.

---

## GÖREV 8/8 — "Ortala" görseli aşırı büyütüyor (🔴 mantık)

**Sorun (kullanıcı raporu):** "Ortala"ya basınca görsel bir anda aşırı büyüyor. Beklenen: görseli
**bıçağa ortalamak** (boyutunu koruyarak bıçak merkezine taşımak).

**Kök neden (teşhis edildi):** `imageAttrsForPreset` "center" dalı `scaleX: 1, scaleY: 1` döndürüyor
(`src/lib/editor/pikaso/placement-presets.ts` ≈L37-44) → görsel **doğal piksel boyutuna (1:1)** sıfırlanıyor.
Tuval 4px/mm; büyük görsel (ör. 1000px) 1:1'de ~250mm olur → devasa büyüme. "Ortala" boyutu
değiştirmemeli, sadece konumlandırmalı.

**Mimari (neden):** "Ortala" = mevcut ölçeği KORU + görselin (ölçekli) merkezini hedefe taşı. Hedef:
bıçak (cutline) varsa onun merkezi, yoksa baskı alanı (label) merkezi. "cover"/"contain" davranışı
değişmez.

**Yapılacak (a) — `src/lib/editor/cutline/shapes.ts`:** `ringBoundsMm`'in yanına merkez helper'ı ekle:
```ts
export function ringCenterMm(rings: PathRing[]): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return { x: NaN, y: NaN };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
```

**Yapılacak (b) — `src/components/editor/PikasoEditorCanvas.tsx`** → `applyImagePreset`: "center"
dalını özel ele al (preset helper'a gitmeden). `ringCenterMm` ve `mmToPx`'i import et; `bundleRef`
zaten mevcut. NOT: `labelX = labelY = 0` (world-coords) olduğundan cut path'leri mm = tuval px / 4 →
`mmToPx(mm)` doğrudan tuval px verir.
```ts
const applyImagePreset = useCallback(
  (preset: PlacementPreset) => {
    const shape = imageShapeRef.current;
    const img = htmlImageRef.current;
    if (!shape || !img) return;
    const frame = labelPlacementFrame(
      labelX,
      labelY,
      widthMmRef.current,
      heightMmRef.current
    );

    if (preset === "center") {
      // Ölçeği KORU, sadece bıçak (yoksa label) merkezine taşı.
      const sx = shape.scaleX();
      const sy = shape.scaleY();
      const scaledW = img.naturalWidth * Math.abs(sx);
      const scaledH = img.naturalHeight * Math.abs(sy);
      let targetCx = frame.cx;
      let targetCy = frame.cy;
      const cut = bundleRef.current?.cut;
      if (cut && cut.length) {
        const c = ringCenterMm(cut);
        if (Number.isFinite(c.x)) {
          targetCx = mmToPx(c.x);
          targetCy = mmToPx(c.y);
        }
      }
      shape.update({
        x: targetCx - scaledW / 2,
        y: targetCy - scaledH / 2,
        // width/height/scale DEĞİŞMEZ
      });
      imageShapeRef.current?.select();
      scheduleRecomputeCutline({ fastImmediate: true });
      return;
    }

    const attrs = imageAttrsForPreset(
      preset,
      frame,
      img.naturalWidth,
      img.naturalHeight
    );
    shape.update({
      ...attrs,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    imageShapeRef.current?.select();
    scheduleRecomputeCutline({ fastImmediate: true });
  },
  [scheduleRecomputeCutline]
);
```

**KISIT:** `imageAttrsForPreset`'in "center" dalına dokunmana gerek yok ama artık çağrılmıyor;
istersen orada `scaleX/scaleY: 1` satırını silmeyip bırak (cover/contain etkilenmesin). Negatif
ölçek (flip) nadir kenar durumdur; `Math.abs` ile yaklaşık ortalanır — kabul edilebilir.

**Doğrulama:** Büyük bir görsel yükle, küçült/sürükle, sonra "Ortala"ya bas → görsel **boyutu
korunur**, bıçak merkezine oturur (aşırı büyüme YOK). "Doldur" ve "Sığdır" eskisi gibi çalışır.
`tsc --noEmit` temiz.

---

## GÖREV 9/11 — Bıçak sürüklenmiyor / "Bıçak" düzenleme modunda komutlar çalışmıyor (🔴 etkileşim)

**Sorun (kullanıcı raporu):** "Düzenleme → Bıçak" modunda bıçak sürüklenemiyor; köşeden büyütme ve
diğer komutlar da tepki vermiyor.

**Kök neden (teşhis edildi):** `src/lib/editor/pikaso/render-cutline.ts` → kesim grubu
`draggable: bladeInteractive, listening: bladeInteractive` (≈L88-92) ile sürüklenebilir yapılıyor,
**ama grubun tüm path child'ları `listening: false`** (≈L124). Konva'da grubun kendi hit alanı yoktur;
sürüklenebilmesi için **dinleyen (hit alanı olan) bir child** gerekir. Magenta çizgi `listening:false`
olduğundan tıklama grubu yakalamıyor → sürükleme imkânsız. (Transformer köşe tutamakları ayrı node
olduğu için resize teknik olarak çalışır; ama kullanıcı önce grubu kavrayamadığından her şey "ölü" hissettiriyor.)

**Mimari (neden):** `bladeInteractive` iken kesim (cut) path'i **hit alanı** kazanmalı: hem çizgiye
yakın tıklama (`hitStrokeWidth`) hem de iç bölgeyi kavrama (görünmez dolgu hit path'i). Böylece grup
sürüklenir; Görsel modunda (`bladeInteractive=false`) hiçbir şey dinlemez → görsel tıklamaları engellenmez.

**Yapılacak — `src/lib/editor/pikaso/render-cutline.ts`:** `addPath` helper'ına `interactive`
parametresi ekle; cut çağrısında `bladeInteractive` geç:
```ts
const addPath = (
  name: string,
  ringMm: PathRing,
  style: (typeof STYLES)["cut"],
  interactive = false
) => {
  const pathD = pathRingToSvgD(ringMmToPx(ringMm));
  if (!pathD) return;
  // Sürüklenebilir bıçak: iç bölgeyi kavramak için görünmez dolgu hit path'i
  if (interactive) {
    group.add(
      new Konva.Path({
        name: `${name}-hit`,
        data: pathD,
        fill: "rgba(0,0,0,0.001)", // görünmez; hit canvas'ta yakalanır
        strokeEnabled: false,
        listening: true,
      })
    );
  }
  group.add(
    new Konva.Path({
      name,
      data: pathD,
      stroke: style.stroke,
      strokeWidth: style.width,
      dash: style.dash,
      lineJoin: "round",
      lineCap: "round",
      strokeScaleEnabled: false,
      listening: interactive,
      hitStrokeWidth: interactive ? 24 : 0, // çizgiye yakın tıklama da kavrar
    })
  );
};
```
Sonra cut döngüsündeki çağrıyı `interactive` ile besle (bleed/safe DEĞİŞMEZ — pasif kalır):
```ts
if (layers.cut) {
  for (let i = 0; i < displayBundle.cut.length; i++) {
    addPath(`${OVERLAY_PREFIX}cut-${i}`, displayBundle.cut[i]!, STYLES.cut, bladeInteractive);
  }
}
```

**KISIT:** Grubun `draggable/listening: bladeInteractive` satırlarına dokunma — zaten doğru. Sadece
hit alanı eksikti. `bladeInteractive=false` iken cut path `listening:false` kalır (görsel tıklanabilir).
Eğer Konva `fill:"rgba(0,0,0,0.001)"` ile iç hit alınamazsa, alternatif: dolgu path'ine
`fill:"#000", opacity:0.001` ver — görsel olarak görünmez kalır.

**Doğrulama:** Otomatik kontur bıçağı seç → "Düzenleme → Bıçak" → magenta çizginin üstüne/içine tıklayıp
**sürükle**: bıçak hareket eder. Köşe tutamaklarından büyüt/küçült çalışır. "Görsel"e geri dön → görsel
seçilip taşınır, bıçak artık tıklamayı engellemez. `tsc --noEmit` temiz.

---

## GÖREV 10/11 — "Kesim çizgisi renkleri" notunda yazı düzensiz (🟠 görünüm)

**Sorun (kullanıcı raporu):** CutColorNote açılır notunda başlık satırı düzensiz; "(spot: …)" ifadesi
satır kayınca garip yerleşiyor.

**Kök neden:** `src/components/editor/CutColorNote.tsx` (≈L21) başlık `div`'i `flex items-center gap-1.5`.
Renk noktası + uzun etiket + "(spot: …)" hepsi flex item; metin sarınca flex satırı bozuluyor, hizalar kayıyor.

**Mimari (neden):** Çok satıra sarabilen metin flex-row değil **normal inline akış** olmalı; renk
noktası `inline-block` + `align-middle` ile metnin başına gömülmeli.

**Yapılacak — `src/components/editor/CutColorNote.tsx`:** Başlık satırını flex'ten inline akışa çevir:
```tsx
<div className="font-semibold text-lacivert">
  <span
    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
    style={{ backgroundColor: meta.color }}
    aria-hidden
  />
  {isKiss ? "Magenta çizgi" : "Mavi çizgi"} — {meta.label}{" "}
  <span className="font-normal text-gri-600">(spot: {meta.spot})</span>
</div>
```
(Sadece dıştaki `flex items-center gap-1.5` kaldırıldı; nokta `inline-block align-middle mr-1.5` oldu.
Alttaki `pl-4` açıklama paragrafları aynı kalır.)

**Doğrulama:** Not açıldığında "Magenta çizgi — kisscut (yarım kesim) (spot: CutContour)" tek/çok satır
düzgün akar, "(spot: …)" metnin doğal devamında kalır, hizalama bozulmaz.

---

## GÖREV 11/11 — Çift "Sığdır" butonu (🟡 tekrar)

**Sorun (kullanıcı raporu):** Üst zoom toolbar'ında "Sığdır" var; sol Bıçak panelinde de aynı "Sığdır"
(Ortala/Doldur/Sığdır grubu) var. Üsttekini kaldır.

**Kök neden:** İkisi de `handleFitContain` (`canvasRef.current?.fitContain()`) çağırıyor — birebir tekrar.

**Yapılacak — `src/components/editor/EditorShell.tsx`:** Üst toolbar'daki `EditorZoomControls`
kullanımından `onFitContain` prop'unu KALDIR (sol paneldeki Sığdır kalır):
```tsx
<EditorZoomControls
  zoom={viewZoom}
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  onZoomReset={() => setViewZoom(1)}
/>
```
**Opsiyonel temizlik — `src/components/editor/EditorPreviewToolbar.tsx`:** `onFitContain` artık
geçilmediğinden buton render olmaz (`{onFitContain ? … : null}`). İstersen `EditorZoomControlsProps`'tan
`onFitContain` alanını ve ilgili buton bloğunu tamamen sil (dead code). Silersen `onFitContain` parametresini
de imzadan çıkar.

**Doğrulama:** Üst toolbar'da artık "− 100% + Sıfırla" kalır (Sığdır yok). Sol Bıçak panelinde
Ortala/Doldur/**Sığdır** çalışmaya devam eder.

---

## DOKUNULMAYANLAR (karar Sefa'da — bu görevde değil)

- **"Müşteri görünümü aktif" barı:** Impersonation önizleme barı; yalnız admin/partner oturumunda
  render olur, son kullanıcıya görünmez. Beklenen davranış, değişiklik yok.

---

> NOT: GÖREV 1–5 Claude tarafından çalışan dosyalara zaten uygulandı; bu dosyadaki kod aynı sonucu
> verir (referans/doğrulama için). GÖREV 6–11 yeni — asıl uygulanacak olanlar bunlar. Kontur/canvas
> görevleri (6, 7, 9) uygulandıktan sonra tarayıcıda görsel doğrulama şart.
