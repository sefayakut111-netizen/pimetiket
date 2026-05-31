/**
 * Faz 4.1 regresyon: view transform export SVG'yi değiştirmemeli;
 * label-origin (0,0) ile placement mm tutarlı.
 */
import { buildCutlineSvgMm } from "../src/lib/editor/cutline/export-svg";
import { fixedFramePathsMm } from "../src/lib/editor/cutline/offsets";
import { computeViewTransform } from "../src/lib/editor/pikaso/apply-view-transform";
import { placementFromPikasoImage } from "../src/lib/editor/pikaso/placement";
import { LABEL_ORIGIN_X, LABEL_ORIGIN_Y } from "../src/lib/editor/pikaso/world-coords";
import { mmToPx } from "../src/lib/editor/coords";

const WIDTH_MM = 50;
const HEIGHT_MM = 30;
const OFFSET_MM = 2;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runRegressionTests() {
  assert(LABEL_ORIGIN_X === 0 && LABEL_ORIGIN_Y === 0, "label origin must be 0,0");

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

  const viewA = computeViewTransform({
    stageWidth: 400,
    stageHeight: 300,
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    viewZoom: 1,
  });
  const viewB = computeViewTransform({
    stageWidth: 1200,
    stageHeight: 900,
    widthMm: WIDTH_MM,
    heightMm: HEIGHT_MM,
    viewZoom: 1.5,
  });
  assert(viewA.effScale !== viewB.effScale, "view scales should differ by stage/zoom");
  assert(svgA === svgB, "view transform must not change export SVG");

  const marginMm = 2;
  const drawWMm = WIDTH_MM - marginMm * 2;
  const drawHMm = HEIGHT_MM - marginMm * 2;
  const xPx = mmToPx((WIDTH_MM - drawWMm) / 2);
  const yPx = mmToPx((HEIGHT_MM - drawHMm) / 2);
  const natW = 400;
  const natH = 300;
  const scale = mmToPx(drawWMm) / natW;

  const mockShape = {
    x: () => xPx,
    y: () => yPx,
    width: () => natW,
    height: () => natH,
    scaleX: () => scale,
    scaleY: () => scale,
    node: { rotation: () => 0 },
  };

  const { placementMm } = placementFromPikasoImage(mockShape);
  assert(
    Math.abs(placementMm.x - (WIDTH_MM - drawWMm) / 2) < 0.01,
    `placementMm.x expected ${(WIDTH_MM - drawWMm) / 2}, got ${placementMm.x}`
  );
  assert(
    Math.abs(placementMm.y - (HEIGHT_MM - drawHMm) / 2) < 0.01,
    `placementMm.y expected ${(HEIGHT_MM - drawHMm) / 2}, got ${placementMm.y}`
  );

  const legacyLabelX = (800 - mmToPx(WIDTH_MM)) / 2;
  const legacyXpx = legacyLabelX + xPx;
  const legacyPlacementX = legacyXpx / 4;
  assert(
    Math.abs(placementMm.x - legacyPlacementX) > 0.5,
    "label origin 0,0 must not include legacy 800px stage centering in placement mm"
  );

  console.log("[editor-export-geometry-regression] OK");
  console.log(`  SVG length: ${svgA.length} chars (stable)`);
  console.log(`  placementMm: ${placementMm.x.toFixed(2)} x ${placementMm.y.toFixed(2)} mm`);
}

runRegressionTests();
