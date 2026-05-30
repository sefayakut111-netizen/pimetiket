/**
 * Dosya tipine göre bıçak tespiti — POC v2 iframe'inden önce çalışır.
 * Dosyada gömülü bıçak varsa parse eder, yoksa POC'a bırakır.
 */

export type CutlineDetectionMethod =
  | "magenta_spot_color"
  | "named_layer"
  | "alpha_channel"
  | "pdf_annotation"
  | "psd_layer";

export type CutlineSourceKind =
  | "file_embedded"
  | "auto_generated"
  | "prior"
  | "geo_shape"
  | "operator";

export interface CutlineDetectResult {
  found: boolean;
  source:
    | "file_embedded"
    | "auto_generated"
    | "geo_shape"
    | "operator"
    | "none";
  svgPath?: string;
  partCount?: number;
  valid?: boolean;
  issues?: string[];
  detectionMethod?: CutlineDetectionMethod;
}

const CUT_LAYER_NAMES =
  /die|cut|knife|bicak|bıçak|cutline|contour|kesim|cutcontour|thru-cut/i;

const MAGENTA_STROKES = new Set([
  "#ff00ff",
  "magenta",
  "rgb(255,0,255)",
  "rgb(255, 0, 255)",
]);

function isMagentaStroke(value: string): boolean {
  return MAGENTA_STROKES.has(value.trim().toLowerCase());
}

function findMagentaStrokePath(svgText: string): string | null {
  const pathRegex = /<path\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgText)) !== null) {
    const attrs = match[1];
    const stroke = attrs.match(/\bstroke=["']([^"']+)["']/i)?.[1];
    if (!stroke || !isMagentaStroke(stroke)) continue;
    const d = attrs.match(/\bd=["']([^"']+)["']/i)?.[1];
    if (d) return d;
  }
  return null;
}

/** Gömülü path d → CutContour SVG (POC/depolama uyumlu) */
export function buildEmbeddedCutlineSvg(pathD: string): string {
  const safeD = pathD.replace(/"/g, "'");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="CutContour" data-pim-cutline="true" data-pim-embedded="true">
    <path d="${safeD}" fill="none" stroke="#FF0080" stroke-width="0.5"/>
  </g>
</svg>`;
}

export async function detectCutlineInFile(
  fileUrl: string,
  fileName: string,
  mimeType: string
): Promise<CutlineDetectResult> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));

  switch (ext) {
    case ".svg":
      return detectCutlineFromSvg(fileUrl);
    case ".pdf":
      return detectCutlineFromPdf(fileUrl);
    case ".ai":
      return detectCutlineFromAi(fileUrl);
    case ".psd":
      return detectCutlineFromPsd(fileUrl);
    case ".png":
      return detectCutlineFromPng(fileUrl);
    case ".jpg":
    case ".jpeg":
      return { found: false, source: "none" };
    default:
      void mimeType;
      return { found: false, source: "none" };
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function detectCutlineFromSvg(
  fileUrl: string
): Promise<CutlineDetectResult> {
  try {
    const text = await fetchText(fileUrl);

    const magentaPath = findMagentaStrokePath(text);
    if (magentaPath) {
      const validation = validateCutlineSvg(magentaPath);
      return {
        found: true,
        source: "file_embedded",
        svgPath: magentaPath,
        partCount: countPathParts(magentaPath),
        valid: validation.valid,
        issues: validation.issues,
        detectionMethod: "magenta_spot_color",
      };
    }

    const cutPathById = text.match(
      /<path[^>]*\bid=["'][^"']*cut[^"']*["'][^>]*\bd=["']([^"']+)["']/i
    );
    if (cutPathById?.[1]) {
      const path = cutPathById[1];
      const validation = validateCutlineSvg(path);
      return {
        found: true,
        source: "file_embedded",
        svgPath: path,
        partCount: countPathParts(path),
        valid: validation.valid,
        issues: validation.issues,
        detectionMethod: "named_layer",
      };
    }

    const clipInner = text.match(/<clipPath[^>]*>([\s\S]*?)<\/clipPath>/i);
    if (clipInner?.[1]) {
      const pathInClip = clipInner[1].match(/\bd=["']([^"']+)["']/i);
      if (pathInClip?.[1]) {
        const path = pathInClip[1];
        const validation = validateCutlineSvg(path);
        return {
          found: true,
          source: "file_embedded",
          svgPath: path,
          partCount: countPathParts(path),
          valid: validation.valid,
          issues: validation.issues,
          detectionMethod: "named_layer",
        };
      }
    }

    const outerPath = text.match(/<path[^>]*\bd=["']([^"']+)["']/i);
    if (outerPath?.[1]) {
      const path = outerPath[1];
      const validation = validateCutlineSvg(path);
      return {
        found: true,
        source: "file_embedded",
        svgPath: path,
        partCount: countPathParts(path),
        valid: validation.valid,
        issues: validation.issues,
        detectionMethod: "named_layer",
      };
    }

    return { found: false, source: "none" };
  } catch {
    return { found: false, source: "none" };
  }
}

export async function detectCutlineFromPdf(
  fileUrl: string
): Promise<CutlineDetectResult> {
  try {
    const buf = await fetchBuffer(fileUrl);
    const { PDFDocument, PDFName } = await import("pdf-lib");
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = doc.getPages();
    if (pages.length === 0) return { found: false, source: "none" };

    for (const page of pages) {
      const annots = page.node.Annots();
      if (!annots) continue;
      const refs = annots.asArray();
      for (const ref of refs) {
        const annot = doc.context.lookup(ref);
        if (!annot || typeof annot !== "object" || !("dict" in annot)) continue;
        const dict = (annot as { dict: Map<unknown, unknown> }).dict;
        const contents = String(dict.get(PDFName.of("Contents")) ?? "");
        const name = String(dict.get(PDFName.of("NM")) ?? "");
        const subtype = String(dict.get(PDFName.of("Subtype")) ?? "");
        const label = `${name} ${contents} ${subtype}`;
        if (
          CUT_LAYER_NAMES.test(label) ||
          /cutcontour|thru-cut|spot/i.test(label)
        ) {
          return {
            found: true,
            source: "file_embedded",
            partCount: 1,
            valid: true,
            issues: [],
            detectionMethod: "pdf_annotation",
          };
        }
      }
    }

    return { found: false, source: "none" };
  } catch {
    return { found: false, source: "none" };
  }
}

export async function detectCutlineFromAi(
  fileUrl: string
): Promise<CutlineDetectResult> {
  return detectCutlineFromPdf(fileUrl);
}

export async function detectCutlineFromPsd(
  fileUrl: string
): Promise<CutlineDetectResult> {
  try {
    const buf = await fetchBuffer(fileUrl);
    const { readPsd } = await import("ag-psd");
    const psd = readPsd(new Uint8Array(buf), {
      skipLayerImageData: true,
      skipCompositeImageData: true,
    });
    const layers = flattenLayerNames(psd.children ?? []);
    const cutLayer = layers.find((n) => CUT_LAYER_NAMES.test(n));
    if (cutLayer) {
      return {
        found: true,
        source: "file_embedded",
        partCount: 1,
        valid: true,
        issues: [`PSD katmanı tespit edildi: ${cutLayer}`],
        detectionMethod: "psd_layer",
      };
    }
    return { found: false, source: "none" };
  } catch {
    return { found: false, source: "none" };
  }
}

function flattenLayerNames(
  layers: Array<{ name?: string; children?: unknown[] }>,
  acc: string[] = []
): string[] {
  for (const layer of layers) {
    if (layer.name) acc.push(layer.name);
    if (Array.isArray(layer.children)) {
      flattenLayerNames(
        layer.children as Array<{ name?: string; children?: unknown[] }>,
        acc
      );
    }
  }
  return acc;
}

/** PNG IHDR color type — 4 (grayscale+alpha) veya 6 (RGBA) alpha içerir */
export async function detectCutlineFromPng(
  fileUrl: string
): Promise<CutlineDetectResult> {
  try {
    const buf = await fetchBuffer(fileUrl);
    if (buf.length < 26 || buf.toString("ascii", 1, 4) !== "PNG") {
      return { found: false, source: "none" };
    }
    const colorType = buf[25];
    const hasAlpha = colorType === 4 || colorType === 6;
    if (!hasAlpha) {
      return { found: false, source: "none" };
    }
    return {
      found: true,
      source: "file_embedded",
      partCount: 1,
      valid: true,
      issues: ["Alpha kanalı var — bıçak POC tarafından üretilecek"],
      detectionMethod: "alpha_channel",
    };
  } catch {
    return { found: false, source: "none" };
  }
}

function countPathParts(path: string): number {
  const moves = path.match(/[Mm]/g);
  return moves?.length ?? (path.trim() ? 1 : 0);
}

export function validateCutlineSvg(svgPath: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const trimmed = svgPath.trim();

  if (!trimmed.match(/[Zz]\s*$/)) {
    issues.push("Bıçak konturu kapalı değil — açık path");
  }

  const nodeCount = (trimmed.match(/[MLHVCSQTA]/gi) || []).length;
  if (nodeCount > 500) {
    issues.push(
      `Kontur çok karmaşık (${nodeCount} node) — sadeleştirme gerekebilir`
    );
  }

  return { valid: issues.length === 0, issues };
}
