/** Görsel alpha kanalından basit kontur / convex hull (OpenCV yerine Faz 2a) */

export type Point2 = { x: number; y: number };

function cross(o: Point2, a: Point2, b: Point2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function convexHull(points: Point2[]): Point2[] {
  if (points.length < 3) return points.slice();
  const sorted = [...points].sort((a, b) =>
    a.x !== b.x ? a.x - b.x : a.y - b.y
  );
  const lower: Point2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Alpha > eşik piksellerden örnek noktalar */
export function sampleOpaquePoints(
  image: HTMLImageElement,
  maxDim = 480,
  step = 2,
  alphaThreshold = 128
): Point2[] {
  const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const inv = 1 / scale;
  const out: Point2[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i + 3]! > alphaThreshold) {
        out.push({ x: x * inv, y: y * inv });
      }
    }
  }
  return out;
}

export function hullFromImage(
  image: HTMLImageElement,
  useConvexHull: boolean
): Point2[] {
  const pts = sampleOpaquePoints(image);
  if (pts.length < 3) {
    return [
      { x: 0, y: 0 },
      { x: image.naturalWidth, y: 0 },
      { x: image.naturalWidth, y: image.naturalHeight },
      { x: 0, y: image.naturalHeight },
    ];
  }
  return useConvexHull ? convexHull(pts) : convexHull(pts);
}

/** Piksel uzayında merkeze göre ölçekle (offset mm → px oranlı genişleme) */
export function expandHullFromCentroid(
  hull: Point2[],
  expandPx: number
): Point2[] {
  if (hull.length < 3 || expandPx === 0) return hull;
  let cx = 0;
  let cy = 0;
  for (const p of hull) {
    cx += p.x;
    cy += p.y;
  }
  cx /= hull.length;
  cy /= hull.length;
  const avgR =
    hull.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / hull.length || 1;
  const factor = 1 + expandPx / avgR;
  return hull.map((p) => ({
    x: cx + (p.x - cx) * factor,
    y: cy + (p.y - cy) * factor,
  }));
}

export function hullToPathD(points: Point2[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let d = `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)}`;
  for (const p of rest) {
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return `${d} Z`;
}
