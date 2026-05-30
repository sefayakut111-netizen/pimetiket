/** Piksel boyutundan editör mm önerisi (300 DPI varsayım). */

const DEFAULT_DPI = 300;
const MIN_MM = 5;
const MAX_MM = 500;

function clampMm(n: number): number {
  return Math.max(MIN_MM, Math.min(MAX_MM, Math.round(n)));
}

export function suggestMmFromPixels(
  widthPx: number,
  heightPx: number,
  dpi = DEFAULT_DPI
): { widthMm: number; heightMm: number; aspect: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    return { widthMm: 50, heightMm: 50, aspect: 1 };
  }
  const widthMm = clampMm((widthPx / dpi) * 25.4);
  const heightMm = clampMm((heightPx / dpi) * 25.4);
  return {
    widthMm,
    heightMm,
    aspect: widthPx / heightPx,
  };
}
