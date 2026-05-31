import {
  EDITOR_BLEED_MM,
  EDITOR_SAFE_MM,
  effectiveCutOffsetMm,
} from "@/lib/editor/coords";
import {
  circleToPath,
  ellipseToPath,
  expandRect,
  rectToPath,
  roundedRectPathMm,
} from "@/lib/editor/cutline/shapes";
import type { CutlineMode, PathRing } from "@/lib/editor/cutline/types";

/** Sabit çerçeve modlarında cut/bleed/safe (mm) */
export function fixedFramePathsMm(args: {
  mode: CutlineMode;
  widthMm: number;
  heightMm: number;
  offsetMm: number;
  cornerRadiusMm?: number;
}): { cut: PathRing[]; bleed: PathRing[]; safe: PathRing[] } {
  const eff = effectiveCutOffsetMm(args.offsetMm);
  const bleedDelta = eff + EDITOR_BLEED_MM;
  const safeDelta = eff - EDITOR_SAFE_MM;
  const w = args.widthMm;
  const h = args.heightMm;
  const r = args.cornerRadiusMm ?? 0;

  if (args.mode === "circle") {
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) / 2;
    return {
      cut: [circleToPath(cx, cy, Math.max(0.1, baseR + eff))],
      bleed: [circleToPath(cx, cy, Math.max(0.1, baseR + bleedDelta))],
      safe: [circleToPath(cx, cy, Math.max(0.1, baseR + safeDelta))],
    };
  }

  if (r > 0 && args.mode === "rect") {
    return {
      cut: [roundedRectPathMm(0, 0, w, h, r, eff)],
      bleed: [roundedRectPathMm(0, 0, w, h, r, bleedDelta)],
      safe: [roundedRectPathMm(0, 0, w, h, r, safeDelta)],
    };
  }

  const cutRect = expandRect(0, 0, w, h, eff);
  const bleedRect = expandRect(0, 0, w, h, bleedDelta);
  const safeRect = expandRect(0, 0, w, h, safeDelta);
  return {
    cut: [rectToPath(cutRect)],
    bleed: [rectToPath(bleedRect)],
    safe: [rectToPath(safeRect)],
  };
}

/** Şablon şekli → sabit çerçeve */
export function templatePathsMm(args: {
  shape: "circle" | "ellipse" | "rect";
  widthMm: number;
  heightMm: number;
  offsetMm: number;
  cornerRadiusMm: number;
}): { cut: PathRing[]; bleed: PathRing[]; safe: PathRing[] } {
  const eff = effectiveCutOffsetMm(args.offsetMm);
  const bleedDelta = eff + EDITOR_BLEED_MM;
  const safeDelta = eff - EDITOR_SAFE_MM;
  const w = args.widthMm;
  const h = args.heightMm;

  if (args.shape === "circle") {
    const side = Math.max(w, h);
    return fixedFramePathsMm({
      mode: "circle",
      widthMm: side,
      heightMm: side,
      offsetMm: args.offsetMm,
    });
  }

  if (args.shape === "ellipse") {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w / 2 + eff;
    const ry = h / 2 + eff;
    return {
      cut: [ellipseToPath(cx, cy, rx, ry)],
      bleed: [
        ellipseToPath(cx, cy, rx + EDITOR_BLEED_MM, ry + EDITOR_BLEED_MM),
      ],
      safe: [
        ellipseToPath(
          cx,
          cy,
          Math.max(0.1, rx - EDITOR_SAFE_MM),
          Math.max(0.1, ry - EDITOR_SAFE_MM)
        ),
      ],
    };
  }

  return fixedFramePathsMm({
    mode: "rect",
    widthMm: w,
    heightMm: h,
    offsetMm: args.offsetMm,
    cornerRadiusMm: args.cornerRadiusMm,
  });
}
