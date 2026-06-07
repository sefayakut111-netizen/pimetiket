/**
 * Tabaka etiket geometri — ortak kaynak (etiket tabaka modu).
 *
 * Sticker kiss-cut motorundan ayrı: etiket tabaka 33×45 cm sabit tabaka.
 * Net baskı alanı 31×40 cm (asimetrik marj: üst 1cm, alt 4cm kesici tutunma).
 */

import { GAP_TABAKA, snapSizeUp } from "./pricing-engine/constants";

/** Etiket tabaka fiziksel boyutu — 33×45 cm */
const ETIKET_TABAKA_SHEET_W = 330;
const ETIKET_TABAKA_SHEET_H = 450;

/** Asimetrik kenar payları (mm) */
export const TABAKA_MARGIN_TOP_MM = 10;
export const TABAKA_MARGIN_BOTTOM_MM = 40;
export const TABAKA_MARGIN_X_MM = 10;

/** Geriye uyumluluk — yan marj (simetrik sol/sağ) */
export const TABAKA_SHEET_MARGIN_MM = TABAKA_MARGIN_X_MM;

export const TABAKA_SHEET_W_MM = ETIKET_TABAKA_SHEET_W;
export const TABAKA_SHEET_H_MM = ETIKET_TABAKA_SHEET_H;

/** Net baskı alanı — 31×40 cm */
export const TABAKA_USABLE_W_MM =
  ETIKET_TABAKA_SHEET_W - 2 * TABAKA_MARGIN_X_MM;
export const TABAKA_USABLE_H_MM =
  ETIKET_TABAKA_SHEET_H -
  TABAKA_MARGIN_TOP_MM -
  TABAKA_MARGIN_BOTTOM_MM;

const USABLE_W_MM = TABAKA_USABLE_W_MM;
const USABLE_H_MM = TABAKA_USABLE_H_MM;
const GAP_MM = GAP_TABAKA;

export interface TabakaSheetGeometry {
  cols: number;
  rows: number;
  per_sheet: number;
  sheets_needed: number;
  total_m2: number;
  waste_pct: number;
  snapped_width_mm: number;
  snapped_height_mm: number;
  /** Etiketler 90° döndürülerek yerleştirildi mi */
  rotated_layout: boolean;
}

/**
 * Tabaka geometry — kaç etiket bir tabakaya sığar?
 */
export function calculateTabakaSheetGeometry(
  width_mm: number,
  height_mm: number,
  qty: number
): TabakaSheetGeometry {
  const w = Math.max(5, snapSizeUp(width_mm));
  const h = Math.max(5, snapSizeUp(height_mm));

  const cols_w = Math.floor((USABLE_W_MM + GAP_MM) / (w + GAP_MM));
  const rows_h = Math.floor((USABLE_H_MM + GAP_MM) / (h + GAP_MM));
  const per_a = Math.max(0, cols_w * rows_h);

  const cols_h = Math.floor((USABLE_W_MM + GAP_MM) / (h + GAP_MM));
  const rows_w = Math.floor((USABLE_H_MM + GAP_MM) / (w + GAP_MM));
  const per_b = Math.max(0, cols_h * rows_w);

  const per_sheet =
    per_a === 0 && per_b === 0 ? 0 : Math.max(per_a, per_b);
  const rotated_layout = per_b > per_a;
  const cols = per_a >= per_b ? cols_w : cols_h;
  const rows = per_a >= per_b ? rows_h : rows_w;

  const sheets_needed =
    per_sheet === 0 ? 0 : Math.ceil(qty / per_sheet);
  const total_area_mm2 = sheets_needed * TABAKA_SHEET_W_MM * TABAKA_SHEET_H_MM;
  const total_m2 = total_area_mm2 / 1_000_000;
  const used_mm2 = qty * w * h;
  const waste_pct =
    total_area_mm2 > 0
      ? ((total_area_mm2 - used_mm2) / total_area_mm2) * 100
      : 0;

  return {
    cols,
    rows,
    per_sheet,
    sheets_needed,
    total_m2,
    waste_pct,
    snapped_width_mm: w,
    snapped_height_mm: h,
    rotated_layout,
  };
}

/** Bridge / calculatePrice için kısa alias */
export function calcTabakaSheets(
  width_mm: number,
  height_mm: number,
  qty: number
): number {
  return calculateTabakaSheetGeometry(width_mm, height_mm, qty).sheets_needed;
}
