/** Piksel boyutundan editör mm önerisi (300 DPI varsayım). */

import { roundEditorMm } from "@/lib/editor/coords";

const DEFAULT_DPI = 300;

/** Uzun kenar sabit (varsayılan 50 mm), kısa kenar piksel oranına göre — editör ilk yükleme. */
export function suggestMmFromAspectLongEdge(
  widthPx: number,
  heightPx: number,
  longEdgeMm = 50
): { widthMm: number; heightMm: number; aspect: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    return { widthMm: longEdgeMm, heightMm: longEdgeMm, aspect: 1 };
  }
  const aspect = widthPx / heightPx;
  if (widthPx >= heightPx) {
    return {
      widthMm: roundEditorMm(longEdgeMm),
      heightMm: roundEditorMm(longEdgeMm / aspect),
      aspect,
    };
  }
  return {
    widthMm: roundEditorMm(longEdgeMm * aspect),
    heightMm: roundEditorMm(longEdgeMm),
    aspect,
  };
}

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

export type PrintDpiLevel = "ok" | "warn" | "critical";

/** Baskı etkin DPI — boyut mm ile piksel genişliğinden (dar kenar). */
export function effectivePrintDpi(
  widthPx: number,
  heightPx: number,
  widthMm: number,
  heightMm: number
): number {
  if (widthPx <= 0 || heightPx <= 0 || widthMm <= 0 || heightMm <= 0) {
    return DEFAULT_DPI;
  }
  const dpiW = widthPx / (widthMm / 25.4);
  const dpiH = heightPx / (heightMm / 25.4);
  return Math.min(dpiW, dpiH);
}

export function printDpiStatus(dpi: number): {
  level: PrintDpiLevel;
  dpi: number;
  message: string | null;
} {
  const rounded = Math.round(dpi);
  if (rounded >= 150) {
    return { level: "ok", dpi: rounded, message: null };
  }
  if (rounded >= 100) {
    return {
      level: "warn",
      dpi: rounded,
      message: `Bu boyutta baskı kalitesi düşebilir (≈${rounded} DPI). Daha küçük boyut veya yüksek çözünürlüklü görsel öner.`,
    };
  }
  return {
    level: "critical",
    dpi: rounded,
    message:
      "Çözünürlük baskı için düşük — pikselli çıkabilir.",
  };
}
