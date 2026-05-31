import { EDITOR_PX_PER_MM } from "@/lib/editor/coords";
import type { ImagePlacementMm } from "@/lib/editor/cutline/types";

export interface PlacementReadback {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/** Yalnız local node koordinatları — stage view transform dahil edilmez. */
export function placementFromPikasoImage(shape: {
  x: () => number;
  y: () => number;
  width: () => number;
  height: () => number;
  scaleX: () => number;
  scaleY: () => number;
  node: { rotation: () => number };
}): { readback: PlacementReadback; placementMm: ImagePlacementMm; scale: number } {
  const xPx = shape.x();
  const yPx = shape.y();
  const wPx = shape.width() * Math.abs(shape.scaleX());
  const hPx = shape.height() * Math.abs(shape.scaleY());
  return {
    readback: {
      x: xPx,
      y: yPx,
      scaleX: shape.scaleX(),
      scaleY: shape.scaleY(),
      rotation: shape.node.rotation(),
    },
    placementMm: {
      x: xPx / EDITOR_PX_PER_MM,
      y: yPx / EDITOR_PX_PER_MM,
      w: wPx / EDITOR_PX_PER_MM,
      h: hPx / EDITOR_PX_PER_MM,
      rotationDeg: shape.node.rotation(),
    },
    scale: Math.abs(shape.scaleX()),
  };
}

export function sizeMmFromPlacement(
  placementMm: ImagePlacementMm,
  viewZoom: number
): { wMm: number; hMm: number } {
  return {
    wMm: (placementMm.w * viewZoom) / viewZoom,
    hMm: (placementMm.h * viewZoom) / viewZoom,
  };
}

export function formatMm(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}
