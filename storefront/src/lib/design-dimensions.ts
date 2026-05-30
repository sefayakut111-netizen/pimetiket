export interface DetectedDimensions {
  widthMm: number;
  heightMm: number;
  source: "png_pixel" | "jpg_pixel" | "svg_viewbox" | "pdf_page" | "unsupported";
  dpi?: number;
  confidence: "exact" | "estimated";
}

const PT_TO_MM = 25.4 / 72;
const PX_AT_300DPI_TO_MM = 25.4 / 300;

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

async function detectFromRaster(
  file: File,
  ext: string
): Promise<DetectedDimensions> {
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
      source: ext === ".png" ? "png_pixel" : "jpg_pixel",
      dpi: 300,
      confidence: "estimated",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function detectFromSvg(file: File): Promise<DetectedDimensions> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("no svg root");

  const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  let w = 0;
  let h = 0;
  if (vb && vb.length === 4) {
    w = vb[2];
    h = vb[3];
  } else {
    w = parseFloat(svg.getAttribute("width") || "0");
    h = parseFloat(svg.getAttribute("height") || "0");
  }

  const widthAttr = svg.getAttribute("width") || "";
  const isMm = widthAttr.includes("mm");

  return {
    widthMm: isMm ? Math.round(w) : Math.round(w * PX_AT_300DPI_TO_MM),
    heightMm: isMm ? Math.round(h) : Math.round(h * PX_AT_300DPI_TO_MM),
    source: "svg_viewbox",
    confidence: isMm ? "exact" : "estimated",
  };
}

async function detectFromPdf(file: File): Promise<DetectedDimensions> {
  const { PDFDocument } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const page = pdf.getPages()[0];
  if (!page) throw new Error("no pages");
  const { width, height } = page.getSize();
  return {
    widthMm: Math.round(width * PT_TO_MM),
    heightMm: Math.round(height * PT_TO_MM),
    source: "pdf_page",
    confidence: "exact",
  };
}
