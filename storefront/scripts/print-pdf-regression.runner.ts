/**
 * Print-ready PDF regresyon — mm kutular + CutContour Separation determinizm.
 */
import {
  buildPrintReadyPdf,
  computePrintBoxesMm,
  mmToPt,
} from "../src/lib/print/build-print-pdf";

const WIDTH_MM = 100;
const HEIGHT_MM = 60;
const BLEED_MM = 2;

/** 1×1 şeffaf PNG */
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  ),
  (c) => c.charCodeAt(0)
);

const SIMPLE_RING: [number, number][] = [
  [10, 10],
  [90, 10],
  [90, 50],
  [10, 50],
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function parseBox(raw: string, name: string): number[] | null {
  const re = new RegExp(`/${name}\\s*\\[([^\\]]+)\\]`);
  const m = raw.match(re);
  if (!m) return null;
  return m[1]!.trim().split(/\s+/).map((s) => parseFloat(s));
}

export async function runPrintPdfRegression() {
  const boxes = computePrintBoxesMm({
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    bleedMm: BLEED_MM,
  });

  assert(
    Math.abs(boxes.mediaWPt - 294.803) < 0.1,
    `MediaBox width expected ~294.80pt, got ${boxes.mediaWPt}`
  );
  assert(
    Math.abs(boxes.mediaHPt - 181.417) < 0.1,
    `MediaBox height expected ~181.42pt, got ${boxes.mediaHPt}`
  );

  const pdfA = await buildPrintReadyPdf({
    artwork: { bytes: TINY_PNG, mimeType: "image/png" },
    cutlinePathMm: [SIMPLE_RING],
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    bleedMm: BLEED_MM,
  });
  const pdfB = await buildPrintReadyPdf({
    artwork: { bytes: TINY_PNG, mimeType: "image/png" },
    cutlinePathMm: [SIMPLE_RING],
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    bleedMm: BLEED_MM,
  });

  assert(pdfA.length === pdfB.length, "buildPrintReadyPdf must be deterministic");
  for (let i = 0; i < pdfA.length; i++) {
    assert(pdfA[i] === pdfB[i], `byte mismatch at index ${i}`);
  }

  const raw = new TextDecoder("latin1").decode(pdfA);
  assert(raw.includes("/Separation"), "PDF must contain /Separation");
  assert(
    raw.includes("/CutContour") || raw.includes("(CutContour)"),
    "PDF must contain CutContour spot name"
  );

  const mediaRaw = parseBox(raw, "MediaBox");
  assert(mediaRaw !== null && mediaRaw.length === 4, "MediaBox array missing");
  const media = mediaRaw as [number, number, number, number];
  assert(Math.abs(media[2] - boxes.mediaWPt) < 0.1, "MediaBox width in PDF");
  assert(Math.abs(media[3] - boxes.mediaHPt) < 0.1, "MediaBox height in PDF");

  const trimRaw = parseBox(raw, "TrimBox");
  assert(trimRaw !== null && trimRaw.length === 4, "TrimBox array missing");
  const trim = trimRaw as [number, number, number, number];
  const bleedPt = mmToPt(BLEED_MM);
  assert(Math.abs(trim[0] - bleedPt) < 0.1, "TrimBox x offset");
  assert(Math.abs(trim[1] - bleedPt) < 0.1, "TrimBox y offset");
  assert(
    Math.abs(trim[2] - (bleedPt + mmToPt(WIDTH_MM))) < 0.1,
    "TrimBox x2"
  );
  assert(
    Math.abs(trim[3] - (bleedPt + mmToPt(HEIGHT_MM))) < 0.1,
    "TrimBox y2"
  );

  console.log("[print-pdf-regression] OK");
  console.log(
    `  MediaBox: [0 0 ${media[2].toFixed(2)} ${media[3].toFixed(2)}] pt`
  );
  console.log(
    `  TrimBox: [${trim[0].toFixed(2)} ${trim[1].toFixed(2)} ${trim[2].toFixed(2)} ${trim[3].toFixed(2)}] pt`
  );
  console.log(`  Separation CutContour: yes · bytes: ${pdfA.length}`);
}

runPrintPdfRegression().catch((err) => {
  console.error("[print-pdf-regression] FAIL:", err);
  process.exit(1);
});
