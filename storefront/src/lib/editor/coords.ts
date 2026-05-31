/** Editör tuvali — mm ↔ px (POC ile uyumlu 4px/mm önizleme) */
export const EDITOR_PX_PER_MM = 4;

export const EDITOR_BLEED_MM = 2;
export const EDITOR_SAFE_MM = 1;
/** offset 0 iken makine kayması telafisi (poc.html slipToleranceMm) */
export const EDITOR_SLIP_TOLERANCE_MM = 0.3;

export function mmToPx(mm: number): number {
  return mm * EDITOR_PX_PER_MM;
}

export function pxToMm(px: number, viewZoom = 1): number {
  return px / (EDITOR_PX_PER_MM * viewZoom);
}

export function effectiveCutOffsetMm(offsetMm: number): number {
  if (offsetMm < 0) return offsetMm;
  return offsetMm === 0 ? -EDITOR_SLIP_TOLERANCE_MM : offsetMm;
}

export const EDITOR_MIN_MM = 5;
export const EDITOR_MAX_MM = 500;

/** Editör boyut girişi — 0,1 mm hassasiyet */
export function roundEditorMm(n: number): number {
  return Math.max(
    EDITOR_MIN_MM,
    Math.min(EDITOR_MAX_MM, Math.round(n * 10) / 10)
  );
}
