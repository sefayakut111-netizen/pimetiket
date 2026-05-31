import { hullFromImage, offsetPolygonPx } from "@/lib/editor/alpha-contour";
import { offsetMmToPx } from "@/lib/editor/cutline/contour-opencv-algorithms";
import { computeContourPathsPxMultiViaWorker } from "@/lib/editor/cutline/contour-worker-client";
import type { ImagePlacementMm, PathRing } from "@/lib/editor/cutline/types";

function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number
): [number, number] {
  if (deg === 0) return [x, y];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/** Piksel uzayındaki konturları etiket mm uzayına taşı */
export function mapPixelPathsToLabelMm(
  pathsPx: PathRing[],
  imagePlacementMm: ImagePlacementMm,
  imageNatural: { w: number; h: number }
): PathRing[] {
  const sx = imagePlacementMm.w / imageNatural.w;
  const sy = imagePlacementMm.h / imageNatural.h;
  const rotDeg = imagePlacementMm.rotationDeg ?? 0;
  const icx = imageNatural.w / 2;
  const icy = imageNatural.h / 2;
  return pathsPx.map((ring) =>
    ring.map(([px, py]) => {
      const [rpx, rpy] = rotatePoint(px, py, icx, icy, rotDeg);
      return [
        imagePlacementMm.x + rpx * sx,
        imagePlacementMm.y + rpy * sy,
      ];
    })
  );
}

/** OpenCV beklemeden anında önizleme (alpha — main thread) */
export function computeContourPathsPxMultiFast(
  image: HTMLImageElement,
  offsetsMm: number[],
  useHull: boolean,
  pxPerMmInImage: number
): PathRing[][] {
  const baseHull = hullFromImage(image, useHull);
  return offsetsMm.map((offsetMm) => {
    const expandPx = offsetMmToPx(offsetMm, pxPerMmInImage, 1);
    const expanded = offsetPolygonPx(baseHull, expandPx);
    return [expanded.map((p) => [p.x, p.y] as [number, number])];
  });
}

/** Tek mask — cut/bleed/safe (OpenCV worker'da) */
export async function computeContourPathsPxMulti(
  image: HTMLImageElement,
  offsetsMm: number[],
  smoothness: number,
  useHull: boolean,
  pxPerMmInImage: number
): Promise<PathRing[][]> {
  return computeContourPathsPxMultiViaWorker(
    image,
    offsetsMm,
    smoothness,
    useHull,
    pxPerMmInImage
  );
}

export async function computeContourPathsPx(
  image: HTMLImageElement,
  offsetMm: number,
  smoothness: number,
  useHull: boolean,
  pxPerMmInImage: number
): Promise<PathRing[]> {
  const [paths] = await computeContourPathsPxMulti(
    image,
    [offsetMm],
    smoothness,
    useHull,
    pxPerMmInImage
  );
  return paths ?? [];
}
