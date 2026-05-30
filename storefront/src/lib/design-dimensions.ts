/**
 * Tasarım dosyasından ölçü algılama (client-side).
 * Ana değer: içerik (etiket) boyutu — sayfa/kağıt değil.
 */

export interface DetectedDimensions {
  widthMm: number;
  heightMm: number;
  source:
    | "png_content"
    | "jpg_content"
    | "svg_content"
    | "svg_viewbox"
    | "pdf_trimbox"
    | "pdf_artbox"
    | "pdf_content_render"
    | "pdf_page"
    | "unsupported";
  dpi?: number;
  confidence: "exact" | "estimated";
  pageWidthMm?: number;
  pageHeightMm?: number;
  trimmed?: boolean;
}

const PT_TO_MM = 25.4 / 72;
const PX_AT_300DPI_TO_MM = 25.4 / 300;
const MAX_SCAN_PX = 1500;
/** Kenar flood-fill: arka plan rengine bu kadar yakın piksel = boşluk */
const BG_COLOR_TOLERANCE = 32;
const ALPHA_BG_THRESHOLD = 16;
/** İçerik sayfadan en az bu kadar küçükse kırpma uygula */
const TRIM_RATIO = 0.98;
/** TrimBox/ArtBox alanı sayfanın bu oranından küçük olmalı — yoksa sayfa sayılır */
const MAX_BOX_AREA_RATIO = 0.82;
/** Gürültü: toplam alanın bu oranından küçük bileşenler yok sayılır */
const MIN_COMPONENT_AREA_RATIO = 0.0008;

type BBox = { x: number; y: number; w: number; h: number };

export async function detectFileDimensions(
  file: File
): Promise<DetectedDimensions | null> {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  try {
    if (ext === ".pdf" || ext === ".ai") return await detectFromPdf(file);
    if (ext === ".svg") return await detectFromSvg(file);
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return await detectFromRaster(file, ext);
    }
    return null;
  } catch {
    return null;
  }
}

/** Banner alt satırı — trimmed ise kağıt vs tasarım farkını göster */
export function detectedDimsTrimHint(dims: DetectedDimensions): string | null {
  if (
    !dims.trimmed ||
    dims.pageWidthMm == null ||
    dims.pageHeightMm == null
  ) {
    return null;
  }
  return `(kağıt ${dims.pageWidthMm}×${dims.pageHeightMm}mm — içindeki tasarım baz alındı)`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

function isMeaningfulTrim(
  bbox: BBox | null,
  fullW: number,
  fullH: number
): bbox is BBox {
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return false;
  return bbox.w < fullW * TRIM_RATIO || bbox.h < fullH * TRIM_RATIO;
}

function sampleCornerBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sample = 8
): { r: number; g: number; b: number } {
  const corners = [
    [0, 0],
    [width - sample, 0],
    [0, height - sample],
    [width - sample, height - sample],
  ] as const;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < sample; dy++) {
      for (let dx = 0; dx < sample; dx++) {
        const x = Math.min(width - 1, cx + dx);
        const y = Math.min(height - 1, cy + dy);
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a <= ALPHA_BG_THRESHOLD) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  if (n === 0) return { r: 255, g: 255, b: 255 };
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: { r: number; g: number; b: number },
  useAlpha: boolean
): boolean {
  if (useAlpha && a <= ALPHA_BG_THRESHOLD) return true;
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  return Math.sqrt(dr * dr + dg * dg + db * db) <= BG_COLOR_TOLERANCE;
}

function buildBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
  useAlpha: boolean
): Uint8Array {
  const total = width * height;
  const bgMask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    const idx = y * width + x;
    if (bgMask[idx]) return;
    const i = idx * 4;
    if (
      !isBackgroundPixel(
        data[i],
        data[i + 1],
        data[i + 2],
        data[i + 3],
        bg,
        useAlpha
      )
    ) {
      return;
    }
    bgMask[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) trySeed(x - 1, y);
    if (x < width - 1) trySeed(x + 1, y);
    if (y > 0) trySeed(x, y - 1);
    if (y < height - 1) trySeed(x, y + 1);
  }

  return bgMask;
}

function bboxFromComponents(
  bgMask: Uint8Array,
  width: number,
  height: number
): BBox | null {
  const total = width * height;
  const visited = new Uint8Array(total);
  const minArea = Math.max(16, total * MIN_COMPONENT_AREA_RATIO);
  const components: Array<{ area: number; bbox: BBox }> = [];

  for (let start = 0; start < total; start++) {
    if (bgMask[start] || visited[start]) continue;

    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    const queue = [start];
    visited[start] = 1;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      area++;
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const n = idx - 1;
        if (!bgMask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (!bgMask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
      if (y > 0) {
        const n = idx - width;
        if (!bgMask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (!bgMask[n] && !visited[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }

    if (area >= minArea && maxX >= 0) {
      components.push({
        area,
        bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      });
    }
  }

  if (components.length === 0) return null;

  components.sort((a, b) => b.area - a.area);
  const anchor = components[0].bbox;
  const anchorCx = anchor.x + anchor.w / 2;
  const anchorCy = anchor.y + anchor.h / 2;
  const mergeDist = Math.max(width, height) * 0.08;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (const c of components) {
    const cx = c.bbox.x + c.bbox.w / 2;
    const cy = c.bbox.y + c.bbox.h / 2;
    const dist = Math.hypot(cx - anchorCx, cy - anchorCy);
    if (dist > mergeDist && c.area < components[0].area * 0.15) continue;

    minX = Math.min(minX, c.bbox.x);
    minY = Math.min(minY, c.bbox.y);
    maxX = Math.max(maxX, c.bbox.x + c.bbox.w - 1);
    maxY = Math.max(maxY, c.bbox.y + c.bbox.h - 1);
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Satır/sütun yoğunluğu — ortadaki etiket bloğunu sayfa bandından ayırır */
function bboxFromProjection(
  bgMask: Uint8Array,
  width: number,
  height: number
): BBox | null {
  const rowDensity = new Float32Array(height);
  const colDensity = new Float32Array(width);

  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (!bgMask[y * width + x]) count++;
    }
    rowDensity[y] = count / width;
  }
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (!bgMask[y * width + x]) count++;
    }
    colDensity[x] = count / height;
  }

  const rowMax = Math.max(...rowDensity);
  const colMax = Math.max(...colDensity);
  if (rowMax <= 0 || colMax <= 0) return null;

  const rowThresh = Math.max(0.004, rowMax * 0.12);
  const colThresh = Math.max(0.004, colMax * 0.12);

  let minY = height;
  let maxY = -1;
  let minX = width;
  let maxX = -1;

  for (let y = 0; y < height; y++) {
    if (rowDensity[y] >= rowThresh) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  for (let x = 0; x < width; x++) {
    if (colDensity[x] >= colThresh) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function padContentBBox(
  bbox: BBox,
  fullW: number,
  fullH: number,
  ratio = 0.06
): BBox {
  const px = Math.round(bbox.w * ratio);
  const py = Math.round(bbox.h * ratio);
  const x = Math.max(0, bbox.x - px);
  const y = Math.max(0, bbox.y - py);
  return {
    x,
    y,
    w: Math.min(fullW - x, bbox.w + px * 2),
    h: Math.min(fullH - y, bbox.h + py * 2),
  };
}

function pickTighterBBox(
  a: BBox | null,
  b: BBox | null,
  fullW: number,
  fullH: number
): BBox | null {
  const candidates = [a, b].filter(
    (box): box is BBox =>
      box != null && box.w > 0 && box.h > 0 && isMeaningfulTrim(box, fullW, fullH)
  );
  if (candidates.length === 0) return null;
  candidates.sort((x, y) => x.w * x.h - y.w * y.h);
  return candidates[0];
}

/**
 * Kenar flood-fill + bileşen birleşimi + projeksiyon.
 * Sayfadaki gerçek etiket bloğunu (beyaz kenar boşlukları hariç) bulur.
 */
function computeContentBBox(
  img: HTMLImageElement,
  useAlpha: boolean
): BBox | null {
  const fullW = img.naturalWidth;
  const fullH = img.naturalHeight;
  if (fullW === 0 || fullH === 0) return null;

  const scale = Math.min(1, MAX_SCAN_PX / Math.max(fullW, fullH));
  const scanW = Math.max(1, Math.round(fullW * scale));
  const scanH = Math.max(1, Math.round(fullH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = scanW;
  canvas.height = scanH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, scanW, scanH);

  const { data, width, height } = ctx.getImageData(0, 0, scanW, scanH);
  const bg = sampleCornerBackground(data, width, height);
  const bgMask = buildBackgroundMask(data, width, height, bg, useAlpha);

  const componentBox = bboxFromComponents(bgMask, width, height);
  const projectionBox = bboxFromProjection(bgMask, width, height);
  let chosen = pickTighterBBox(componentBox, projectionBox, width, height);

  if (
    chosen &&
    chosen.w * chosen.h < width * height * 0.45 &&
    componentBox &&
    chosen.w * chosen.h <= componentBox.w * componentBox.h * 1.05
  ) {
    chosen = padContentBBox(chosen, width, height);
  }

  if (!chosen) return null;

  const inv = 1 / scale;
  return {
    x: Math.round(chosen.x * inv),
    y: Math.round(chosen.y * inv),
    w: Math.round(chosen.w * inv),
    h: Math.round(chosen.h * inv),
  };
}

async function detectFromRaster(
  file: File,
  ext: string
): Promise<DetectedDimensions> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;
    const isPng = ext === ".png" || ext === ".webp";

    const bbox = computeContentBBox(img, isPng);
    const useBox = isMeaningfulTrim(bbox, fullW, fullH);

    const w = useBox && bbox ? bbox.w : fullW;
    const h = useBox && bbox ? bbox.h : fullH;

    return {
      widthMm: Math.round(w * PX_AT_300DPI_TO_MM),
      heightMm: Math.round(h * PX_AT_300DPI_TO_MM),
      source: isPng ? "png_content" : "jpg_content",
      dpi: 300,
      confidence: "estimated",
      pageWidthMm: Math.round(fullW * PX_AT_300DPI_TO_MM),
      pageHeightMm: Math.round(fullH * PX_AT_300DPI_TO_MM),
      trimmed: useBox,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function detectFromSvg(file: File): Promise<DetectedDimensions> {
  const text = await file.text();
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute;left:-99999px;width:0;height:0;overflow:hidden";
  wrapper.innerHTML = text;
  document.body.appendChild(wrapper);

  const vbRef = parseSvgViewBox(text);

  try {
    const svg = wrapper.querySelector("svg");
    if (!svg) throw new Error("no svg root");

    const widthAttr = svg.getAttribute("width") || "";
    const isMm = widthAttr.includes("mm");
    const widthFromAttr = parseFloat(widthAttr.replace(/mm|px|pt/gi, ""));
    const heightFromAttr = parseFloat(
      (svg.getAttribute("height") || "").replace(/mm|px|pt/gi, "")
    );
    const vbW =
      vbRef?.w ??
      (Number.isFinite(widthFromAttr) && widthFromAttr > 0
        ? widthFromAttr
        : svg.viewBox.baseVal.width) ??
      0;
    const vbH =
      vbRef?.h ??
      (Number.isFinite(heightFromAttr) && heightFromAttr > 0
        ? heightFromAttr
        : svg.viewBox.baseVal.height) ??
      0;

    const toMm = (v: number) =>
      isMm ? Math.round(v) : Math.round(v * PX_AT_300DPI_TO_MM);

    const pageWidthMm = toMm(vbW);
    const pageHeightMm = toMm(vbH);

    const blobUrl = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml" })
    );
    try {
      const img = await loadImage(blobUrl);
      const bbox = computeContentBBox(img, true);
      const useBox =
        bbox &&
        isMeaningfulTrim(bbox, img.naturalWidth, img.naturalHeight);

      if (useBox && bbox && vbW > 0 && vbH > 0) {
        const w = (bbox.w / img.naturalWidth) * vbW;
        const h = (bbox.h / img.naturalHeight) * vbH;
        return {
          widthMm: toMm(w),
          heightMm: toMm(h),
          source: "svg_content",
          confidence: isMm ? "exact" : "estimated",
          pageWidthMm,
          pageHeightMm,
          trimmed: true,
        };
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    let contentW = vbW;
    let contentH = vbH;
    let useContent = false;
    try {
      const bb = (svg as unknown as SVGGraphicsElement).getBBox();
      if (bb && bb.width > 0 && bb.height > 0) {
        if (bb.width < vbW * TRIM_RATIO || bb.height < vbH * TRIM_RATIO) {
          contentW = bb.width;
          contentH = bb.height;
          useContent = true;
        }
      }
    } catch {
      /* getBBox başarısız */
    }

    return {
      widthMm: toMm(contentW),
      heightMm: toMm(contentH),
      source: useContent ? "svg_content" : "svg_viewbox",
      confidence: isMm ? "exact" : "estimated",
      pageWidthMm,
      pageHeightMm,
      trimmed: useContent,
    };
  } finally {
    document.body.removeChild(wrapper);
  }
}

function parseSvgViewBox(text: string): { w: number; h: number } | null {
  const m = text.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return { w: parts[2], h: parts[3] };
}

type PdfBox = { width: number; height: number; x?: number; y?: number };

function safePdfBox(fn: () => PdfBox): PdfBox | null {
  try {
    const b = fn();
    return b && b.width > 0 && b.height > 0 ? b : null;
  } catch {
    return null;
  }
}

function boxArea(box: PdfBox): number {
  return box.width * box.height;
}

function isMeaningfulContentBox(box: PdfBox, media: PdfBox): boolean {
  const mediaArea = boxArea(media);
  if (mediaArea <= 0) return false;
  const areaRatio = boxArea(box) / mediaArea;
  if (areaRatio >= MAX_BOX_AREA_RATIO) return false;
  return (
    box.width < media.width * TRIM_RATIO ||
    box.height < media.height * TRIM_RATIO
  );
}

function pickContentBox(boxes: {
  trim: PdfBox | null;
  art: PdfBox | null;
  media: PdfBox;
}): { box: PdfBox; source: DetectedDimensions["source"] } {
  const { trim, art, media } = boxes;

  if (trim && isMeaningfulContentBox(trim, media)) {
    return { box: trim, source: "pdf_trimbox" };
  }
  if (art && isMeaningfulContentBox(art, media)) {
    return { box: art, source: "pdf_artbox" };
  }
  return { box: media, source: "pdf_page" };
}

async function renderPdfFirstPage(
  file: File
): Promise<{ canvas: HTMLCanvasElement; pageW: number; pageH: number } | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: arrayBuffer,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;

  if (pdf.numPages === 0) {
    await pdf.destroy();
    return null;
  }

  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, MAX_SCAN_PX / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    await pdf.destroy();
    return null;
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    canvas,
    viewport,
  } as Parameters<typeof page.render>[0]).promise;

  await pdf.cleanup();
  await pdf.destroy();

  return {
    canvas,
    pageW: baseViewport.width,
    pageH: baseViewport.height,
  };
}

async function detectPdfContentByRender(
  file: File,
  media: PdfBox
): Promise<{
  widthMm: number;
  heightMm: number;
  source: "pdf_content_render";
  confidence: "estimated";
} | null> {
  const rendered = await renderPdfFirstPage(file);
  if (!rendered) return null;

  const { canvas } = rendered;
  const img = await loadImage(canvas.toDataURL("image/png"));
  const bbox = computeContentBBox(img, true);
  if (!bbox || !isMeaningfulTrim(bbox, img.naturalWidth, img.naturalHeight)) {
    return null;
  }

  const widthMm = Math.round(
    (bbox.w / img.naturalWidth) * media.width * PT_TO_MM
  );
  const heightMm = Math.round(
    (bbox.h / img.naturalHeight) * media.height * PT_TO_MM
  );
  return { widthMm, heightMm, source: "pdf_content_render", confidence: "estimated" };
}

async function detectFromPdf(file: File): Promise<DetectedDimensions> {
  const { PDFDocument } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error("no pages");

  const media = page.getMediaBox();
  const pageWidthMm = Math.round(media.width * PT_TO_MM);
  const pageHeightMm = Math.round(media.height * PT_TO_MM);

  const trim = safePdfBox(() => page.getTrimBox());
  const art = safePdfBox(() => page.getArtBox());
  const picked = pickContentBox({ trim, art, media });

  const trimCandidate =
    picked.source !== "pdf_page"
      ? {
          widthMm: Math.round(picked.box.width * PT_TO_MM),
          heightMm: Math.round(picked.box.height * PT_TO_MM),
          source: picked.source,
          confidence: "exact" as const,
        }
      : null;

  const rendered = await detectPdfContentByRender(file, media);

  const candidates = [trimCandidate, rendered].filter(
    (c): c is NonNullable<typeof c> => c != null
  );

  if (candidates.length > 0) {
    candidates.sort(
      (a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm
    );
    const best = candidates[0];
    const trimmed =
      best.widthMm < pageWidthMm * TRIM_RATIO ||
      best.heightMm < pageHeightMm * TRIM_RATIO;

    return {
      widthMm: best.widthMm,
      heightMm: best.heightMm,
      source: best.source,
      confidence: best.confidence,
      pageWidthMm,
      pageHeightMm,
      trimmed,
    };
  }

  return {
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
    source: "pdf_page",
    confidence: "estimated",
    pageWidthMm,
    pageHeightMm,
    trimmed: false,
  };
}
