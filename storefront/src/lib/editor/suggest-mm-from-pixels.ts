/** Piksel boyutundan editör mm önerisi (300 DPI varsayım). */

import { roundEditorMm } from "@/lib/editor/coords";

const DEFAULT_DPI = 300;

export function suggestMmFromPixels(
  widthPx: number,
  heightPx: number,
  dpi = DEFAULT_DPI
): { widthMm: number; heightMm: number; aspect: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    return { widthMm: 50, heightMm: 50, aspect: 1 };
  }
  const aspect = widthPx / heightPx;
  const widthMm = roundEditorMm((widthPx / dpi) * 25.4);
  const heightMm = roundEditorMm(widthMm / aspect);
  return {
    widthMm,
    heightMm,
    aspect,
  };
}
