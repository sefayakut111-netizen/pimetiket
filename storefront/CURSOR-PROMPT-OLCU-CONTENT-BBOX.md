# Ölçü Algılama Fix — Kağıt Değil, İçindeki Tasarım Boyutu

## SORUN
`src/lib/design-dimensions.ts` dosyanın **dış sınırını** (kağıt/sayfa/canvas) algılıyor, içindeki gerçek tasarımı değil.

Örnek: 100×150mm kağıda 60×80mm etiket konmuş → sistem yanlış olarak "100×150" diyor. Doğrusu "60×80" (gerçek etiket/baskı alanı).

## HEDEF
Her formatta **içerik bounding box'ı** (gerçek tasarımın sınırı) algılansın:
- **PDF:** TrimBox (matbaa kesim alanı) → yoksa ArtBox → yoksa BleedBox → en son MediaBox
- **PNG:** Alpha kanalına göre şeffaf boşluğu kırp, içeriğin bbox'ı
- **JPG:** Beyaz/açık arka planı kırp (riskli — "yaklaşık" işaretle)
- **SVG:** `getBBox()` ile gerçek path sınırı (viewBox değil)

---

## GÖREV 1 — PDF: TrimBox Önceliği

`detectFromPdf` güncelle. pdf-lib'de `page.getTrimBox()`, `getArtBox()`, `getBleedBox()`, `getMediaBox()` mevcut.

```typescript
async function detectFromPdf(file: File): Promise<DetectedDimensions> {
  const { PDFDocument } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error("no pages");

  // Öncelik: TrimBox (kesim = gerçek ürün) > ArtBox > BleedBox > MediaBox (sayfa)
  // pdf-lib getTrimBox vb. tanımlı değilse MediaBox'a düşer; bunu yakala
  let box = page.getMediaBox();
  let boxSource: DetectedDimensions["source"] = "pdf_page";

  const trim = safeBox(() => page.getTrimBox());
  const art = safeBox(() => page.getArtBox());
  const bleed = safeBox(() => page.getBleedBox());
  const media = page.getMediaBox();

  // TrimBox/ArtBox MediaBox'tan KÜÇÜKSE anlamlıdır (gerçek tasarım sayfadan küçük)
  const pick = pickContentBox({ trim, art, bleed, media });
  box = pick.box;
  boxSource = pick.source;

  return {
    widthMm: Math.round(box.width * PT_TO_MM),
    heightMm: Math.round(box.height * PT_TO_MM),
    source: boxSource,        // "pdf_trimbox" | "pdf_artbox" | "pdf_page"
    confidence: boxSource === "pdf_page" ? "estimated" : "exact",
    pageWidthMm: Math.round(media.width * PT_TO_MM),    // referans: tam sayfa
    pageHeightMm: Math.round(media.height * PT_TO_MM),
  };
}

function safeBox(fn: () => { width: number; height: number }) {
  try { const b = fn(); return b && b.width > 0 ? b : null; } catch { return null; }
}

function pickContentBox({ trim, art, bleed, media }: ...) {
  // TrimBox varsa ve media'dan <= ise → gerçek ürün
  if (trim && trim.width <= media.width + 1 && trim.width > 0)
    return { box: trim, source: "pdf_trimbox" as const };
  if (art && art.width <= media.width + 1 && art.width > 0)
    return { box: art, source: "pdf_artbox" as const };
  // Bleed genelde trim'den büyük; sadece media yoksa kullan
  return { box: media, source: "pdf_page" as const };
}
```

**NOT:** Çoğu profesyonel baskı PDF'inde TrimBox tanımlıdır = doğru cevap. Tanımsızsa MediaBox'a düşer (eski davranış, "estimated").

---

## GÖREV 2 — Raster: İçerik Bounding Box (Canvas)

`detectFromRaster` güncelle. Görseli canvas'a çiz, piksel tara, içeriğin min/max x-y'sini bul.

```typescript
async function detectFromRaster(file: File, ext: string): Promise<DetectedDimensions> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;

    const bbox = computeContentBBox(img, ext);  // {x,y,w,h} | null

    const isPng = ext === ".png";
    // İçerik bbox bulunduysa ve anlamlıysa (tam canvas'tan küçük) onu kullan
    const useBox = bbox && (bbox.w < fullW * 0.98 || bbox.h < fullH * 0.98);
    const w = useBox ? bbox!.w : fullW;
    const h = useBox ? bbox!.h : fullH;

    return {
      widthMm: Math.round(w * PX_AT_300DPI_TO_MM),
      heightMm: Math.round(h * PX_AT_300DPI_TO_MM),
      source: isPng ? "png_content" : "jpg_content",
      dpi: 300,
      confidence: "estimated",   // raster her zaman DPI varsayımı
      pageWidthMm: Math.round(fullW * PX_AT_300DPI_TO_MM),
      pageHeightMm: Math.round(fullH * PX_AT_300DPI_TO_MM),
      trimmed: useBox,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function computeContentBBox(img: HTMLImageElement, ext: string): BBox | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const isPng = ext === ".png";
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

      let isContent: boolean;
      if (isPng) {
        // PNG: alpha > eşik = içerik (şeffaf boşluğu kırp)
        isContent = a > 16;
      } else {
        // JPG: alpha yok → beyaza yakın olmayan = içerik (riskli)
        isContent = !(r > 245 && g > 245 && b > 245);
      }
      if (isContent) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;   // tamamen boş/şeffaf
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
```

**JPG uyarısı:** Beyaz zeminli etiket beyaz arka plana karışır → kırpma yanlış olabilir. JPG'de bbox tam canvas'a çok yakınsa (içerik kenara dayalı) trim'i uygulama, tam boyutu kullan. PNG güvenli (alpha kesin).

**Performans:** Büyük görsellerde (>4000px) piksel taraması yavaş. Önce downscale et (örn. max 1500px'e), bbox oranını orijinale ölçekle.

---

## GÖREV 3 — SVG: getBBox

`detectFromSvg` güncelle. viewBox yerine gerçek içerik sınırı.

```typescript
async function detectFromSvg(file: File): Promise<DetectedDimensions> {
  const text = await file.text();
  // Geçici olarak DOM'a ekle, getBBox al
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;left:-99999px;width:0;height:0;overflow:hidden";
  wrapper.innerHTML = text;
  document.body.appendChild(wrapper);
  try {
    const svg = wrapper.querySelector("svg");
    if (!svg) throw new Error("no svg root");

    // viewBox referansı (tam tuval)
    const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const widthAttr = svg.getAttribute("width") || "";
    const isMm = widthAttr.includes("mm");

    let contentBox: { width: number; height: number } | null = null;
    try {
      const bb = (svg as unknown as SVGGraphicsElement).getBBox();
      if (bb && bb.width > 0) contentBox = { width: bb.width, height: bb.height };
    } catch { /* getBBox başarısız → viewBox fallback */ }

    const vbW = vb && vb.length === 4 ? vb[2] : parseFloat(widthAttr || "0");
    const vbH = vb && vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute("height") || "0");

    // İçerik bbox tuvalden küçükse onu kullan
    const useContent = contentBox && (contentBox.width < vbW * 0.98 || contentBox.height < vbH * 0.98);
    const w = useContent ? contentBox!.width : vbW;
    const h = useContent ? contentBox!.height : vbH;
    const toMm = (v: number) => isMm ? Math.round(v) : Math.round(v * PX_AT_300DPI_TO_MM);

    return {
      widthMm: toMm(w),
      heightMm: toMm(h),
      source: useContent ? "svg_content" : "svg_viewbox",
      confidence: isMm ? "exact" : "estimated",
      pageWidthMm: toMm(vbW),
      pageHeightMm: toMm(vbH),
      trimmed: !!useContent,
    };
  } finally {
    document.body.removeChild(wrapper);
  }
}
```

---

## GÖREV 4 — Interface + UI Güncellemesi

### Interface
```typescript
export interface DetectedDimensions {
  widthMm: number;        // İÇERİK (tasarım) boyutu — ana değer
  heightMm: number;
  source: "png_content" | "jpg_content" | "svg_content" | "svg_viewbox"
        | "pdf_trimbox" | "pdf_artbox" | "pdf_page" | "unsupported";
  dpi?: number;
  confidence: "exact" | "estimated";
  pageWidthMm?: number;   // YENİ: tam sayfa/kağıt boyutu (referans)
  pageHeightMm?: number;
  trimmed?: boolean;      // YENİ: içerik kırpıldı mı (sayfadan küçük mü)
}
```

### Banner UI (etiket + sticker yapilandir)
Ölçü prompt banner'ında, içerik sayfadan küçükse her ikisini göster:

```
Tasarımının ölçüsünü tespit ettim: 60×80mm
(kağıt 100×150mm — içindeki tasarım baz alındı)
Boyut alanına yazmamı ister misin?  [Evet, kullan] [Hayır]
```

`trimmed === true` ise alt satır gösterilsin; değilse sadece ana ölçü.

---

## TEST PLANI

| Dosya | Beklenen |
|-------|----------|
| TrimBox'lı PDF (100×150 sayfa, 60×80 trim) | **60×80**, source=pdf_trimbox, page=100×150 |
| TrimBox'sız PDF | Sayfa boyutu, source=pdf_page (eski davranış) |
| Şeffaf PNG (kenarda boşluk) | İçerik bbox, trimmed=true |
| Tam dolu PNG | Tam boyut, trimmed=false |
| Beyaz zeminli JPG | Kenar kontrolü — kırpma riskliyse tam boyut |
| getBBox'lı SVG | İçerik sınırı, source=svg_content |

---

## UYGULAMA SIRASI
1. Görev 4 interface (5 dk)
2. Görev 1 PDF TrimBox (20 dk)
3. Görev 2 Raster bbox + downscale (30 dk)
4. Görev 3 SVG getBBox (15 dk)
5. Banner UI (15 dk)

**Toplam: ~85 dk.** `npx tsc --noEmit` + commit. Önek: `fix(configurator):`

## NOTLAR
- **Ana mantık:** içerik sayfadan küçükse içeriği baz al, değilse tam boyut (eski davranış). `*0.98` toleransı kenar payı için.
- PDF TrimBox = en güvenilir (matbaa standardı, exact).
- Raster trim PNG'de güvenli, JPG'de temkinli (beyaz karışma riski).
- `pageWidthMm` her zaman dön — banner'da "kağıt X, tasarım Y" gösterimi için.
- Test verisi/canvas okuma client-side — server gerekmez.
