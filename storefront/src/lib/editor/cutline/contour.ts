import { hullFromImage, offsetPolygonPx } from "@/lib/editor/alpha-contour";
import { offsetMmToPx } from "@/lib/editor/cutline/contour-opencv-algorithms";
import { computeContourPathsPxMultiViaWorker } from "@/lib/editor/cutline/contour-worker-client";
import type { PathRing } from "@/lib/editor/cutline/types";

/** Piksel uzayındaki konturları etiket mm uzayına taşı */
export function mapPixelPathsToLabelMm(
  pathsPx: PathRing[],
  imagePlacementMm: { x: number; y: number; w: number; h: number },
  imageNatural: { w: number; h: number }
): PathRing[] {
  const sx = imagePlacementMm.w / imageNatural.w;
  const sy = imagePlacementMm.h / imageNatural.h;
  return pathsPx.map((ring) =>
    ring.map(([px, py]) => [
      imagePlacementMm.x + px * sx,
      imagePlacementMm.y + py * sy,
    ])
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
