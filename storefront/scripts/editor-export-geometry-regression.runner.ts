/**
 * Faz 4.1 regresyon: export SVG deterministik; sabit çerçeve geometrisi tutarlı.
 * P0: köşe yuvarlama arc path, imageTransform export hizası, gömülü viewBox.
 */
import { buildCutlineSvgMm } from "../src/lib/editor/cutline/export-svg";
import { fixedFramePathsMm } from "../src/lib/editor/cutline/offsets";
import { roundedRectSvgD } from "../src/lib/editor/cutline/shapes";
import {
  artDrawRectToSvgImageAttrs,
  computeArtDrawRect,
} from "../src/lib/editor/cutline/svg-coords";
import {
  buildEmbeddedCutlineSvg,
  computePathBBox,
} from "../src/lib/proof/cutline-detect";
import { chaikinSmoothPath } from "../src/lib/editor/chaikin-smooth";

const WIDTH_MM = 50;
const HEIGHT_MM = 30;
const OFFSET_MM = 2;
const CORNER_MM = 4;

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

  // (a) cornerRadius — 4 köşe arc'lı rect path
  const roundedD = roundedRectSvgD(10, 20, 100, 60, 8);
  assert(roundedD.includes(" A 8 8 "), "rounded rect must use SVG arc commands");
  assert(
    (roundedD.match(/ A /g) ?? []).length === 4,
    "rounded rect must have 4 corner arcs"
  );
  assert(!roundedD.includes(" Q "), "rounded rect uses arc not quadratic");

  const roundedBundle = fixedFramePathsMm({
    mode: "rect",
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    offsetMm: OFFSET_MM,
    cornerRadiusMm: CORNER_MM,
  });
  assert(
    roundedBundle.cut[0]!.length === 8,
    "fixedFramePathsMm cornerRadius produces 8-point ring"
  );

  // (b) imageTransform export hizası — görsel katmanı bake
  const content = {
    contentOffsetX: 40,
    contentOffsetY: 30,
    contentW: 200,
    contentH: 120,
  };
  const transform = { x: 15, y: -10, scale: 1.25 };
  const drawRect = computeArtDrawRect({ ...content, transform });
  const imageAttrs = artDrawRectToSvgImageAttrs({
    drawRect,
    padding: 20,
    inverseScale: 0.5,
  });
  assert(
    Math.abs(imageAttrs.x - (drawRect.x - 20) * 0.5) < 0.001,
    "artwork x must bake canvas placement into orig space"
  );
  assert(
    Math.abs(imageAttrs.width - drawRect.w * 0.5) < 0.001,
    "artwork width must reflect imageTransform scale"
  );
  assert(
    imageAttrs.x !== (content.contentOffsetX - 20) * 0.5,
    "artwork x must differ from untransformed placement when transform active"
  );

  // (c) gömülü bıçak viewBox — path bbox + mm ölçek
  const embeddedPath = "M 10 20 H 110 V 80 H 10 Z";
  const bbox = computePathBBox(embeddedPath);
  assert(bbox !== null, "computePathBBox must parse embedded path");
  assert(bbox!.minX === 10 && bbox!.minY === 20, "bbox min corner");
  assert(bbox!.width === 100 && bbox!.height === 60, "bbox dimensions");

  const embeddedSvg = buildEmbeddedCutlineSvg(embeddedPath, {
    widthMm: 50,
    heightMm: 30,
  });
  assert(
    embeddedSvg.includes('viewBox="10 20 100 60"'),
    "embedded SVG viewBox must match path bbox"
  );
  assert(
    !embeddedSvg.includes('viewBox="0 0 100 100"'),
    "embedded SVG must not use fixed 0 0 100 100 viewBox"
  );
  assert(
    embeddedSvg.includes('width="50mm"') && embeddedSvg.includes('height="30mm"'),
    "embedded SVG must preserve mm scale attrs"
  );

  // (d) Chaikin smoothing deterministik
  const square: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const smoothA = chaikinSmoothPath(square, 60);
  const smoothB = chaikinSmoothPath(square, 60);
  assert(smoothA.length === smoothB.length, "chaikin output length stable");
  for (let i = 0; i < smoothA.length; i++) {
    assert(
      smoothA[i]![0] === smoothB[i]![0] && smoothA[i]![1] === smoothB[i]![1],
      `chaikin point ${i} must match`
    );
  }
  assert(smoothA.length > square.length, "chaikin must subdivide corners");
  const smoothZero = chaikinSmoothPath(square, 0);
  assert(smoothZero.length === square.length, "smoothness 0 is no-op");

  console.log("[editor-export-geometry-regression] OK");
  console.log(`  SVG length: ${svgA.length} chars (stable)`);
  console.log(`  rounded arc path: ${roundedD.slice(0, 48)}…`);
  console.log(`  artwork bake: x=${imageAttrs.x} w=${imageAttrs.width}`);
  console.log(`  embedded viewBox: 10 20 100 60`);
}

runRegressionTests();
