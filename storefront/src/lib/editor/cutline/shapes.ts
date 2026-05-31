import type { PathRing } from "@/lib/editor/cutline/types";

export function expandRect(
  x: number,
  y: number,
  w: number,
  h: number,
  delta: number
): { x: number; y: number; w: number; h: number } {
  return { x: x - delta, y: y - delta, w: w + 2 * delta, h: h + 2 * delta };
}

export function rectToPath(r: {
  x: number;
  y: number;
  w: number;
  h: number;
}): PathRing {
  return [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
  ];
}

export function circleToPath(
  cx: number,
  cy: number,
  r: number,
  segments = 96
): PathRing {
  const path: PathRing = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    path.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return path;
}

export function ellipseToPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments = 96
): PathRing {
  const path: PathRing = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    path.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return path;
}

/** mm uzayında yuvarlak köşeli dikdörtgen kontur */
export function roundedRectPathMm(
  x: number,
  y: number,
  w: number,
  h: number,
  radiusMm: number,
  offsetMm = 0
): PathRing {
  const r = expandRect(x, y, w, h, offsetMm);
  const cr = Math.min(radiusMm, r.w / 2, r.h / 2);
  if (cr <= 0) return rectToPath(r);
  return [
    [r.x + cr, r.y],
    [r.x + r.w - cr, r.y],
    [r.x + r.w, r.y + cr],
    [r.x + r.w, r.y + r.h - cr],
    [r.x + r.w - cr, r.y + r.h],
    [r.x + cr, r.y + r.h],
    [r.x, r.y + r.h - cr],
    [r.x, r.y + cr],
  ];
}

export function ringBoundsMm(rings: PathRing[]): {
  w: number;
  h: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return { w: 0, h: 0 };
  return { w: maxX - minX, h: maxY - minY };
}

export function ringCenterMm(rings: PathRing[]): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return { x: NaN, y: NaN };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function pathRingToSvgD(ring: PathRing): string {
  if (ring.length < 2) return "";
  const [first, ...rest] = ring;
  let d = `M ${first![0].toFixed(3)} ${first![1].toFixed(3)}`;
  for (const [x, y] of rest) {
    d += ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return `${d} Z`;
}
