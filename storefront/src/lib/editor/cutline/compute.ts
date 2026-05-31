import {
  EDITOR_BLEED_MM,
  EDITOR_SAFE_MM,
  effectiveCutOffsetMm,
} from "@/lib/editor/coords";
import {
  computeContourPathsPxMulti,
  computeContourPathsPxMultiFast,
  mapPixelPathsToLabelMm,
} from "@/lib/editor/cutline/contour";
import { fixedFramePathsMm, templatePathsMm } from "@/lib/editor/cutline/offsets";
import { ringBoundsMm } from "@/lib/editor/cutline/shapes";
import type { PathRing } from "@/lib/editor/cutline/types";
import type {
  ComputeCutlineInput,
  CutlineBundle,
  CutlineMode,
} from "@/lib/editor/cutline/types";

/** PathRing[] vs tek PathRing karışıklığını önler */
function ensurePathRings(v: PathRing[] | PathRing | undefined): PathRing[] {
  if (!v || !Array.isArray(v) || v.length === 0) return [];
  if (Array.isArray(v[0]?.[0])) return v as PathRing[];
  return [v as PathRing];
}

function bundleFromContourPxRings(
  ringsList: PathRing[][],
  input: Pick<
    ComputeCutlineInput,
    "image" | "imagePlacementMm" | "labelWidthMm" | "labelHeightMm"
  >
): CutlineBundle {
  const { image, imagePlacementMm, labelWidthMm, labelHeightMm } = input;
  const nat = {
    w: image!.naturalWidth,
    h: image!.naturalHeight,
  };
  const cutPx = ensurePathRings(ringsList[0]);
  const bleedPx = ensurePathRings(ringsList[1]);
  const safePx = ensurePathRings(ringsList[2]);
  const cut = mapPixelPathsToLabelMm(cutPx, imagePlacementMm!, nat);
  const bleed = mapPixelPathsToLabelMm(bleedPx, imagePlacementMm!, nat);
  const safe = mapPixelPathsToLabelMm(safePx, imagePlacementMm!, nat);
  const b = ringBoundsMm(cut);
  return {
    cut,
    bleed,
    safe,
    cutlineWidthMm: b.w || labelWidthMm,
    cutlineHeightMm: b.h || labelHeightMm,
  };
}

/** Kontur/hull — senkron hızlı önizleme (OpenCV yok) */
export function computeCutlineBundleFast(
  input: ComputeCutlineInput
): CutlineBundle | null {
  const { mode, image, imagePlacementMm, offsetMm } = input;
  if (
    (mode !== "contour" && mode !== "hull") ||
    !image ||
    !imagePlacementMm
  ) {
    return null;
  }
  const pxPerMmInImage =
    image.naturalWidth / Math.max(imagePlacementMm.w, 0.01);
  const eff = effectiveCutOffsetMm(offsetMm);
  const ringsList = computeContourPathsPxMultiFast(
    image,
    [offsetMm, eff + EDITOR_BLEED_MM, eff - EDITOR_SAFE_MM],
    mode === "hull",
    pxPerMmInImage
  );
  return bundleFromContourPxRings(ringsList, input);
}

export async function computeCutlineBundle(
  input: ComputeCutlineInput
): Promise<CutlineBundle> {
  const {
    mode,
    labelWidthMm,
    labelHeightMm,
    offsetMm,
    cornerRadiusMm = 0,
    smoothness = 0,
    image,
    imagePlacementMm,
  } = input;

  if (mode === "rect" || mode === "circle") {
    const paths = fixedFramePathsMm({
      mode,
      widthMm: labelWidthMm,
      heightMm: labelHeightMm,
      offsetMm,
      cornerRadiusMm,
    });
    const b = ringBoundsMm(paths.cut);
    return {
      ...paths,
      cutlineWidthMm: b.w || labelWidthMm,
      cutlineHeightMm: b.h || labelHeightMm,
    };
  }

  if ((mode === "contour" || mode === "hull") && image && imagePlacementMm) {
    const pxPerMmInImage =
      image.naturalWidth / Math.max(imagePlacementMm.w, 0.01);
    const eff = effectiveCutOffsetMm(offsetMm);
    const hull = mode === "hull";
    const ringsList = await computeContourPathsPxMulti(
      image,
      [offsetMm, eff + EDITOR_BLEED_MM, eff - EDITOR_SAFE_MM],
      smoothness,
      hull,
      pxPerMmInImage
    );
    return bundleFromContourPxRings(ringsList, input);
  }

  const fallback = fixedFramePathsMm({
    mode: "rect",
    widthMm: labelWidthMm,
    heightMm: labelHeightMm,
    offsetMm,
    cornerRadiusMm,
  });
  const b = ringBoundsMm(fallback.cut);
  return {
    ...fallback,
    cutlineWidthMm: b.w || labelWidthMm,
    cutlineHeightMm: b.h || labelHeightMm,
  };
}

export function computeTemplateBundle(args: {
  shape: "circle" | "ellipse" | "rect";
  widthMm: number;
  heightMm: number;
  offsetMm: number;
  cornerRadiusMm: number;
}): CutlineBundle {
  const paths = templatePathsMm(args);
  const b = ringBoundsMm(paths.cut);
  return {
    ...paths,
    cutlineWidthMm: b.w || args.widthMm,
    cutlineHeightMm: b.h || args.heightMm,
  };
}

export type { CutlineMode };
