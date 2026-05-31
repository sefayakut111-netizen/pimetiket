import type { CutlineBundle, PathRing } from "@/lib/editor/cutline/types";
import { EDITOR_PX_PER_MM } from "@/lib/editor/coords";

/** Bıçak grubu transform — label mm koordinatında, merkez etrafında ölçek + döndürme */
export interface BladeTransformMm {
  offsetXmm: number;
  offsetYmm: number;
  scale: number;
  rotationDeg: number;
}

export const DEFAULT_BLADE_TRANSFORM: BladeTransformMm = {
  offsetXmm: 0,
  offsetYmm: 0,
  scale: 1,
  rotationDeg: 0,
};

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

function transformRing(
  ring: PathRing,
  cx: number,
  cy: number,
  t: BladeTransformMm
): PathRing {
  const s = t.scale;
  return ring.map(([x, y]) => {
    const scaledX = cx + (x - cx) * s;
    const scaledY = cy + (y - cy) * s;
    const [rx, ry] = rotatePoint(scaledX, scaledY, cx, cy, t.rotationDeg);
    return [rx + t.offsetXmm, ry + t.offsetYmm];
  });
}

export function applyBladeTransformToBundle(
  bundle: CutlineBundle,
  labelWidthMm: number,
  labelHeightMm: number,
  transform: BladeTransformMm
): CutlineBundle {
  if (
    transform.scale === 1 &&
    transform.offsetXmm === 0 &&
    transform.offsetYmm === 0 &&
    transform.rotationDeg === 0
  ) {
    return bundle;
  }
  const cx = labelWidthMm / 2;
  const cy = labelHeightMm / 2;
  const map = (rings: PathRing[]) =>
    rings.map((r) => transformRing(r, cx, cy, transform));
  return {
    cut: map(bundle.cut),
    bleed: map(bundle.bleed),
    safe: map(bundle.safe),
    cutlineWidthMm: bundle.cutlineWidthMm * transform.scale,
    cutlineHeightMm: bundle.cutlineHeightMm * transform.scale,
  };
}

/** Konva group → mm transform (export öncesi senkron) */
export function bladeTransformFromGroup(
  group: {
    x: () => number;
    y: () => number;
    scaleX: () => number;
    rotation: () => number;
  },
  labelX: number,
  labelY: number,
  labelWidthMm: number,
  labelHeightMm: number
): BladeTransformMm {
  const cxPx = (labelWidthMm / 2) * EDITOR_PX_PER_MM;
  const cyPx = (labelHeightMm / 2) * EDITOR_PX_PER_MM;
  return {
    offsetXmm: (group.x() - labelX - cxPx) / EDITOR_PX_PER_MM,
    offsetYmm: (group.y() - labelY - cyPx) / EDITOR_PX_PER_MM,
    scale: group.scaleX(),
    rotationDeg: group.rotation(),
  };
}
