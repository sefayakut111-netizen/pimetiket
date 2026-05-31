import { hullFromImage } from "@/lib/editor/alpha-contour";
import type { PathRing } from "@/lib/editor/cutline/types";
import { loadOpenCv, type OpenCvModule } from "@/lib/editor/cutline/opencv-loader";

function detectBackgroundColor(cv: OpenCvModule, gray: OpenCvMat): number {
  const w = gray.cols;
  const h = gray.rows;
  const sampleSize = Math.min(10, Math.floor(Math.min(w, h) / 10));
  const samples: number[] = [];
  const corners = [
    { x: 0, y: 0 },
    { x: w - sampleSize, y: 0 },
    { x: 0, y: h - sampleSize },
    { x: w - sampleSize, y: h - sampleSize },
  ];
  const data = gray as OpenCvMat & { data: Uint8Array };
  for (const corner of corners) {
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        samples.push(data.data[(corner.y + dy) * w + (corner.x + dx)]!);
      }
    }
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 255;
}

function buildMask(
  cv: OpenCvModule,
  srcMat: OpenCvMat & { cols: number; rows: number; channels?: () => number }
): OpenCvMat {
  const channels = (srcMat as { channels: () => number }).channels?.() ?? 4;
  let mask = new cv.Mat();
  const hasAlpha = channels === 4;

  if (hasAlpha) {
    const ch = new cv.MatVector();
    cv.split(srcMat, ch);
    const alpha = ch.get(3);
    const meanAlpha = cv.mean(alpha)[0] ?? 255;
    if (meanAlpha < 250) {
      cv.threshold(alpha, mask, 200, 255, cv.THRESH_BINARY);
    } else {
      const gray = new cv.Mat();
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
      const bg = detectBackgroundColor(cv, gray);
      cv.threshold(gray, mask, Math.max(200, bg - 8), 255, cv.THRESH_BINARY_INV);
      gray.delete();
    }
    ch.delete();
  } else {
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    const bg = detectBackgroundColor(cv, gray);
    cv.threshold(gray, mask, Math.max(200, bg - 8), 255, cv.THRESH_BINARY_INV);
    gray.delete();
  }

  const minDim = Math.min(srcMat.cols, srcMat.rows);
  const closeSize = Math.max(5, Math.min(9, Math.round(minDim / 120) * 2 + 1));
  const closeKernel = cv.getStructuringElement(
    cv.MORPH_ELLIPSE,
    new cv.Size(closeSize, closeSize)
  );
  const closed = new cv.Mat();
  cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, closeKernel);
  mask.delete();
  closeKernel.delete();

  const openKernel = cv.getStructuringElement(
    cv.MORPH_ELLIPSE,
    new cv.Size(3, 3)
  );
  const cleaned = new cv.Mat();
  cv.morphologyEx(closed, cleaned, cv.MORPH_OPEN, openKernel);
  closed.delete();
  openKernel.delete();

  return cleaned;
}

function generateOffsetPaths(
  cv: OpenCvModule,
  mask: OpenCvMat,
  offsetPx: number,
  smoothness: number,
  useHull: boolean
): PathRing[] {
  let workingMask = mask;
  let needsDelete = false;
  const absOffset = Math.abs(offsetPx);

  if (absOffset > 0) {
    const kernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(2 * absOffset + 1, 2 * absOffset + 1)
    );
    workingMask = new cv.Mat();
    if (offsetPx > 0) cv.dilate(mask, workingMask, kernel);
    else cv.erode(mask, workingMask, kernel);
    kernel.delete();
    needsDelete = true;
  }

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    workingMask,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  const paths: PathRing[] = [];

  if (useHull && contours.size() > 0) {
    const allPoints: number[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      for (let j = 0; j < c.rows; j++) {
        allPoints.push(c.data32S[j * 2]!, c.data32S[j * 2 + 1]!);
      }
    }
    if (allPoints.length >= 6) {
      const mat = cv.matFromArray(allPoints.length / 2, 1, cv.CV_32SC2, allPoints);
      const hull = new cv.Mat();
      cv.convexHull(mat, hull, false, true);
      const path: PathRing = [];
      for (let i = 0; i < hull.rows; i++) {
        path.push([hull.data32S[i * 2]!, hull.data32S[i * 2 + 1]!]);
      }
      paths.push(path);
      mat.delete();
      hull.delete();
    }
  } else {
    const totalArea = workingMask.rows * workingMask.cols;
    const minArea = Math.max(100, totalArea * 0.003);
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      if (cv.contourArea(c) < minArea) continue;
      const approx = new cv.Mat();
      const epsilon = (smoothness / 100) * 0.015 * cv.arcLength(c, true);
      cv.approxPolyDP(c, approx, epsilon, true);
      const path: PathRing = [];
      for (let j = 0; j < approx.rows; j++) {
        path.push([approx.data32S[j * 2]!, approx.data32S[j * 2 + 1]!]);
      }
      paths.push(path);
      approx.delete();
    }
  }

  contours.delete();
  hierarchy.delete();
  if (needsDelete) workingMask.delete();

  return paths;
}

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

const OPENCV_MAX_EDGE_PX = 1000;

function imageToCvMatScaled(
  cv: OpenCvModule,
  image: HTMLImageElement
): { mat: OpenCvMat; downscale: number } {
  const natW = image.naturalWidth;
  const natH = image.naturalHeight;
  const maxDim = Math.max(natW, natH, 1);
  const downscale =
    maxDim > OPENCV_MAX_EDGE_PX ? OPENCV_MAX_EDGE_PX / maxDim : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(natW * downscale));
  canvas.height = Math.max(1, Math.round(natH * downscale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d yok");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { mat: cv.imread(canvas), downscale };
}

function scalePathsPx(paths: PathRing[], invScale: number): PathRing[] {
  if (invScale === 1) return paths;
  return paths.map((ring) =>
    ring.map(([px, py]) => [px * invScale, py * invScale])
  );
}

export async function computeContourPathsPx(
  image: HTMLImageElement,
  offsetMm: number,
  smoothness: number,
  useHull: boolean,
  pxPerMmInImage: number
): Promise<PathRing[]> {
  try {
    const cv = await loadOpenCv();
    const { mat: src, downscale } = imageToCvMatScaled(cv, image);
    const mask = buildMask(cv, src);
    const effectiveOffsetMm = offsetMm === 0 ? -0.3 : offsetMm;
    const offsetPx = Math.round(
      effectiveOffsetMm * pxPerMmInImage * downscale
    );
    const pathsSmall = generateOffsetPaths(
      cv,
      mask,
      offsetPx,
      smoothness,
      useHull
    );
    const paths = scalePathsPx(pathsSmall, downscale > 0 ? 1 / downscale : 1);
    mask.delete();
    src.delete();
    return paths;
  } catch {
    const hull = hullFromImage(image, useHull);
    return [hull];
  }
}
