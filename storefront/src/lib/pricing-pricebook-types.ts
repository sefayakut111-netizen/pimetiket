/**
 * Partner Price Book — client-safe types + fallback snapshot.
 */

export type PricebookAxisKind = "width" | "height" | "qty";

export interface PricebookAxes {
  width: number[];
  height: number[];
  qty: number[];
}

export interface PricebookMatrixMeta {
  id: string;
  material_key: string;
  display_name: string;
  active: boolean;
  version: number;
}

/** Hucre anahtari: `${width_mm}:${height_mm}:${qty}` */
export type PricebookCellMap = Record<string, number>;

export interface PricebookSnapshot {
  axes: PricebookAxes;
  matrices: Record<
    string,
    {
      meta: PricebookMatrixMeta;
      cells: PricebookCellMap;
    }
  >;
  markup_pct: number;
}

export interface PricebookLookupInput {
  width_mm: number;
  height_mm: number;
  qty: number;
  material_key: string;
}

export interface PricebookLookupDiagnostics {
  anchors: {
    width: [number, number];
    height: [number, number];
    qty: [number, number];
  };
  interpolation: { t_w: number; t_h: number; t_qty: number };
  corners: Array<{
    width_mm: number;
    height_mm: number;
    qty: number;
    price_per_unit: number;
  }>;
  partner_unit_raw: number;
  clamped: { width: boolean; height: boolean; qty: boolean };
}

export interface PricebookLookupOk {
  ok: true;
  partner_unit_per_label: number;
  partner_subtotal: number;
  diagnostics: PricebookLookupDiagnostics;
  matrix_version: number;
}

export interface PricebookLookupFail {
  ok: false;
  reason:
    | "material_not_found"
    | "matrix_inactive"
    | "qty_below_min"
    | "qty_above_max"
    | "size_above_max"
    | "missing_cells"
    | "invalid_input";
  hint?: string;
  min_qty?: number;
  max_qty?: number;
}

export type PricebookLookupResult = PricebookLookupOk | PricebookLookupFail;

export const PRICEBOOK_MIN_QTY = 1000;
export const PRICEBOOK_MAX_QTY = 10000;

export function pricebookCellKey(
  width_mm: number,
  height_mm: number,
  qty: number
): string {
  return `${width_mm}:${height_mm}:${qty}`;
}

import { buildFallbackPricebookSnapshot } from "./pricing-pricebook-seed";

/** PRICING-MATRIX.md ornek verisi — DB yoksa fallback (5 malzeme) */
export const FALLBACK_PRICEBOOK_SNAPSHOT: PricebookSnapshot =
  buildFallbackPricebookSnapshot(50);
