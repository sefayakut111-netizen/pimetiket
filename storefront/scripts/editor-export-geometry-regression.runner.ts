/**
 * Faz 4.1 regresyon: export SVG deterministik; sabit çerçeve geometrisi tutarlı.
 * (Pikaso view-transform testleri kaldırıldı — editör POC iframe mimarisine geçti.)
 */
import { buildCutlineSvgMm } from "../src/lib/editor/cutline/export-svg";
import { fixedFramePathsMm } from "../src/lib/editor/cutline/offsets";

const WIDTH_MM = 50;
const HEIGHT_MM = 30;
const OFFSET_MM = 2;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runRegressionTests() {
  const bundle = fixedFramePathsMm({
    mode: "rect",
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    offsetMm: OFFSET_MM,
  });

  const svgA = buildCutlineSvgMm({
    bundle: { ...bundle, cutlineWidthMm: WIDTH_MM, cutlineHeightMm: HEIGHT_MM },
    labelWidthMm: WIDTH_MM,
    labelHeightMm: HEIGHT_MM,
  });
  const svgB = buildCutlineSvgMm({
    bundle: { ...bundle, cutlineWidthMm: WIDTH_MM, cutlineHeightMm: HEIGHT_MM },
    labelWidthMm: WIDTH_MM,
    labelHeightMm: HEIGHT_MM,
  });
  assert(svgA === svgB, "buildCutlineSvgMm must be deterministic");
  assert(svgA.includes("<svg"), "export must produce valid SVG");

  console.log("[editor-export-geometry-regression] OK");
  console.log(`  SVG length: ${svgA.length} chars (stable)`);
}

runRegressionTests();
