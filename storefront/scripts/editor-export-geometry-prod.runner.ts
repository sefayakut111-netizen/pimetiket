/**
 * Üretim bıçak yolu round-trip: poc-format SVG → extractCutlineRingsFromSvg → mm doğrulama.
 * buildCutlineSvgMm (ölü kod yolu) burada test EDİLMEZ.
 */
import { extractCutlineRingsFromSvg } from "../src/lib/print/extract-cutline-rings";
import { roundedRectSvgD } from "../src/lib/editor/cutline/shapes";

const LABEL_W_MM = 80;
const LABEL_H_MM = 50;
/** poc pimBuildCutlineSvg: viewBox = tam orijinal görsel px alanı (label alanından çok büyük) */
const VIEWBOX_W_PX = 4000;
const VIEWBOX_H_PX = 2500;
/** ~80mm @ 300dpi orijinal px genişliği */
const CUT_W_PX = (LABEL_W_MM * 300) / 25.4;
const CUT_H_PX = (LABEL_H_MM * 300) / 25.4;
const CUT_X = (VIEWBOX_W_PX - CUT_W_PX) / 2;
const CUT_Y = (VIEWBOX_H_PX - CUT_H_PX) / 2;
const CORNER_R_PX = 30;
const MIN_ARC_SAMPLES_PER_CORNER = 3;
const MIN_RING_POINTS = 20;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function ringBounds(ring: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** poc pimBuildCutlineSvg benzeri: px viewBox + mm width/height attrib */
function buildPocStyleCutlineSvg(pathD: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${LABEL_W_MM.toFixed(2)}mm" height="${LABEL_H_MM.toFixed(2)}mm"
     viewBox="0 0 ${VIEWBOX_W_PX} ${VIEWBOX_H_PX}">
  <g id="CutContour" data-pim-cutline="true">
    <path d="${pathD}" fill="none" stroke="#FF0080" stroke-width="0.5"/>
  </g>
</svg>`;
}

function countCornerArcSamples(
  ring: [number, number][],
  cornerX: number,
  cornerY: number,
  radiusPx: number
): number {
  const r2 = (radiusPx * 1.5) ** 2;
  return ring.filter(([x, y]) => {
    const dx = x - cornerX;
    const dy = y - cornerY;
    return dx * dx + dy * dy <= r2;
  }).length;
}

export function runProdGeometryTests() {
  const pathD = roundedRectSvgD(
    CUT_X,
    CUT_Y,
    CUT_W_PX,
    CUT_H_PX,
    CORNER_R_PX
  );
  assert(pathD.includes(" A "), "fixture must include SVG arc commands");

  const svg = buildPocStyleCutlineSvg(pathD);
  const ringsA = extractCutlineRingsFromSvg(svg, LABEL_W_MM, LABEL_H_MM);
  const ringsB = extractCutlineRingsFromSvg(svg, LABEL_W_MM, LABEL_H_MM);

  assert(ringsA.length === 1, "expected single cut ring");
  const ring = ringsA[0]!;
  assert(ring.length >= MIN_RING_POINTS, `ring needs arc samples (got ${ring.length})`);

  const b = ringBounds(ring);
  const tol = 0.02;
  assert(
    Math.abs(b.width - LABEL_W_MM) / LABEL_W_MM < tol,
    `(a) width mm: expected ~${LABEL_W_MM}, got ${b.width.toFixed(2)}`
  );
  assert(
    Math.abs(b.height - LABEL_H_MM) / LABEL_H_MM < tol,
    `(a) height mm: expected ~${LABEL_H_MM}, got ${b.height.toFixed(2)}`
  );
  const aspect = b.width / b.height;
  const expectedAspect = LABEL_W_MM / LABEL_H_MM;
  assert(
    Math.abs(aspect - expectedAspect) / expectedAspect < tol,
    `(a) aspect ratio: expected ~${expectedAspect.toFixed(3)}, got ${aspect.toFixed(3)}`
  );

  const topRightCornerMmX = b.maxX;
  const topRightCornerMmY = b.minY;
  const cornerSamples = countCornerArcSamples(
    ring,
    topRightCornerMmX,
    topRightCornerMmY,
    (CORNER_R_PX / CUT_W_PX) * LABEL_W_MM
  );
  assert(
    cornerSamples >= MIN_ARC_SAMPLES_PER_CORNER,
    `(b) top-right corner arc samples: expected ≥${MIN_ARC_SAMPLES_PER_CORNER}, got ${cornerSamples}`
  );

  assert(
    JSON.stringify(ringsA) === JSON.stringify(ringsB),
    "(c) extract must be deterministic"
  );

  console.log("[editor-export-geometry-prod] OK");
  console.log(`  ring points: ${ring.length}`);
  console.log(
    `  bbox mm: ${b.width.toFixed(2)} × ${b.height.toFixed(2)} (target ${LABEL_W_MM}×${LABEL_H_MM})`
  );
  console.log(`  corner arc samples (TR): ${cornerSamples}`);
}

runProdGeometryTests();
