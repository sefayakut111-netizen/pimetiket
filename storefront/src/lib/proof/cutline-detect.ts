/**
 * Dosya tipine göre bıçak tespiti — POC v2 iframe'inden önce çalışır.
 * Dosyada gömülü bıçak varsa parse eder, yoksa POC'a bırakır.
 */

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
}

const CUT_LAYER_NAMES =
  /die|cut|knife|bicak|bıçak|cutline|contour|kesim|cutcontour|thru-cut/i;

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
        const subtype = dict.get(PDFName.of("Subtype"));
        const contents = String(dict.get(PDFName.of("Contents")) ?? "");
        const name = String(dict.get(PDFName.of("NM")) ?? "");
        const label = `${name} ${contents}`;
        if (CUT_LAYER_NAMES.test(label)) {
          return {
            found: true,
            source: "file_embedded",
            partCount: 1,
            valid: true,
            issues: [],
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
    const psd = readPsd(new Uint8Array(buf), { skipLayerImageData: true, skipCompositeImageData: true });
    const layers = flattenLayerNames(psd.children ?? []);
    const cutLayer = layers.find((n) => CUT_LAYER_NAMES.test(n));
    if (cutLayer) {
      return {
        found: true,
        source: "file_embedded",
        partCount: 1,
        valid: true,
        issues: [`PSD katmanı tespit edildi: ${cutLayer}`],
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
