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
    | "pdf_page"
    | "unsupported";
  dpi?: number;
  confidence: "exact" | "estimated";
  /** Tam sayfa / tuval boyutu (referans) */
  pageWidthMm?: number;
  pageHeightMm?: number;
  /** İçerik sayfadan küçük kırpıldı mı */
  trimmed?: boolean;
}

const PT_TO_MM = 25.4 / 72;
const PX_AT_300DPI_TO_MM = 25.4 / 300;
const MAX_RASTER_SCAN_PX = 1500;
const ALPHA_CONTENT_THRESHOLD = 16;
const JPG_WHITE_THRESHOLD = 245;

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PdfBox {
  width: number;
  height: number;
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

export async function detectFileDimensions(
  file: File
): Promise<DetectedDimensions | null> {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));

  try {
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
      return detectFromRaster(file, ext);
    }
    if (ext === ".svg") {
      return detectFromSvg(file);
    }
    if (ext === ".pdf") {
      return detectFromPdf(file);
    }
    return {
      widthMm: 0,
      heightMm: 0,
      source: "unsupported",
      confidence: "exact",
    };
  } catch {
    return null;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
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

    const bbox = computeContentBBox(img, ext);
    const isPng = ext === ".png";

    let useBox = false;
    if (bbox) {
      const smallerThanCanvas =
        bbox.w < fullW * 0.98 || bbox.h < fullH * 0.98;
      if (isPng) {
        useBox = smallerThanCanvas;
      } else {
        // JPG: beyaz zemin riski — kenara dayalı tasarımda kırpma yapma
        useBox =
          smallerThanCanvas &&
          bbox.w < fullW * 0.95 &&
          bbox.h < fullH * 0.95;
      }
    }

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

function computeContentBBox(
  img: HTMLImageElement,
  ext: string
): BBox | null {
  const fullW = img.naturalWidth;
  const fullH = img.naturalHeight;
  if (fullW <= 0 || fullH <= 0) return null;

  const scale = Math.min(1, MAX_RASTER_SCAN_PX / Math.max(fullW, fullH));
  const scanW = Math.max(1, Math.round(fullW * scale));
  const scanH = Math.max(1, Math.round(fullH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = scanW;
  canvas.height = scanH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, scanW, scanH);
  const { data, width, height } = ctx.getImageData(0, 0, scanW, scanH);

  const isPng = ext === ".png";
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const isContent = isPng
        ? a > ALPHA_CONTENT_THRESHOLD
        : !(r > JPG_WHITE_THRESHOLD && g > JPG_WHITE_THRESHOLD && b > JPG_WHITE_THRESHOLD);

      if (isContent) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  const inv = 1 / scale;
  return {
    x: Math.round(minX * inv),
    y: Math.round(minY * inv),
    w: Math.round((maxX - minX + 1) * inv),
    h: Math.round((maxY - minY + 1) * inv),
  };
}

async function detectFromSvg(file: File): Promise<DetectedDimensions> {
  const text = await file.text();
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:absolute;left:-99999px;width:0;height:0;overflow:hidden";
  wrapper.innerHTML = text;
  document.body.appendChild(wrapper);

  try {
    const svg = wrapper.querySelector("svg");
    if (!svg) throw new Error("no svg root");

    const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const widthAttr = svg.getAttribute("width") || "";
    const heightAttr = svg.getAttribute("height") || "";
    const isMm = widthAttr.includes("mm");

    let contentBox: PdfBox | null = null;
    try {
      const bb = (svg as SVGGraphicsElement).getBBox();
      if (bb && bb.width > 0 && bb.height > 0) {
        contentBox = { width: bb.width, height: bb.height };
      }
    } catch {
      /* getBBox başarısız → viewBox fallback */
    }

    const vbW =
      vb && vb.length === 4 ? vb[2] : parseFloat(widthAttr.replace(/mm|px/gi, "") || "0");
    const vbH =
      vb && vb.length === 4
        ? vb[3]
        : parseFloat(heightAttr.replace(/mm|px/gi, "") || "0");

    const useContent =
      contentBox != null &&
      vbW > 0 &&
      vbH > 0 &&
      (contentBox.width < vbW * 0.98 || contentBox.height < vbH * 0.98);

    const w = useContent && contentBox ? contentBox.width : vbW;
    const h = useContent && contentBox ? contentBox.height : vbH;
    const toMm = (v: number) =>
      isMm ? Math.round(v) : Math.round(v * PX_AT_300DPI_TO_MM);

    return {
      widthMm: toMm(w),
      heightMm: toMm(h),
      source: useContent ? "svg_content" : "svg_viewbox",
      confidence: isMm ? "exact" : "estimated",
      pageWidthMm: vbW > 0 ? toMm(vbW) : undefined,
      pageHeightMm: vbH > 0 ? toMm(vbH) : undefined,
      trimmed: useContent,
    };
  } finally {
    document.body.removeChild(wrapper);
  }
}

function safePdfBox(fn: () => PdfBox): PdfBox | null {
  try {
    const b = fn();
    return b && b.width > 0 && b.height > 0 ? b : null;
  } catch {
    return null;
  }
}

function isMeaningfulContentBox(box: PdfBox, media: PdfBox): boolean {
  return (
    box.width <= media.width + 1 &&
    box.height <= media.height + 1 &&
    box.width > 0 &&
    box.height > 0 &&
    (box.width < media.width * 0.98 || box.height < media.height * 0.98)
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

async function detectFromPdf(file: File): Promise<DetectedDimensions> {
  const { PDFDocument } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error("no pages");

  const media = page.getMediaBox();
  const trim = safePdfBox(() => page.getTrimBox());
  const art = safePdfBox(() => page.getArtBox());

  const picked = pickContentBox({ trim, art, media });
  const trimmed = picked.source !== "pdf_page";

  return {
    widthMm: Math.round(picked.box.width * PT_TO_MM),
    heightMm: Math.round(picked.box.height * PT_TO_MM),
    source: picked.source,
    confidence: picked.source === "pdf_page" ? "estimated" : "exact",
    pageWidthMm: Math.round(media.width * PT_TO_MM),
    pageHeightMm: Math.round(media.height * PT_TO_MM),
    trimmed,
  };
}
