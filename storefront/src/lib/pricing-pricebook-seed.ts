/**
 * Partner Price Book — ortak seed verisi (DB migration + fallback).
 */

import type { PricebookCellMap, PricebookSnapshot } from "./pricing-pricebook-types";
import { pricebookCellKey } from "./pricing-pricebook-types";

/** PRICING-MATRIX.md kuşe referans hücreleri (TL/adet) */
export const KUSE_BASE_CELLS: Array<{
  width_mm: number;
  height_mm: number;
  qty: number;
  price_per_unit: number;
}> = [
  { width_mm: 30, height_mm: 30, qty: 1000, price_per_unit: 0.2 },
  { width_mm: 30, height_mm: 30, qty: 3000, price_per_unit: 0.15 },
  { width_mm: 30, height_mm: 30, qty: 5000, price_per_unit: 0.12 },
  { width_mm: 30, height_mm: 30, qty: 10000, price_per_unit: 0.09 },
  { width_mm: 50, height_mm: 50, qty: 1000, price_per_unit: 0.35 },
  { width_mm: 50, height_mm: 50, qty: 3000, price_per_unit: 0.27 },
  { width_mm: 50, height_mm: 50, qty: 5000, price_per_unit: 0.22 },
  { width_mm: 50, height_mm: 50, qty: 10000, price_per_unit: 0.17 },
  { width_mm: 70, height_mm: 70, qty: 1000, price_per_unit: 0.55 },
  { width_mm: 70, height_mm: 70, qty: 3000, price_per_unit: 0.42 },
  { width_mm: 70, height_mm: 70, qty: 5000, price_per_unit: 0.35 },
  { width_mm: 70, height_mm: 70, qty: 10000, price_per_unit: 0.27 },
  { width_mm: 100, height_mm: 100, qty: 1000, price_per_unit: 0.85 },
  { width_mm: 100, height_mm: 100, qty: 3000, price_per_unit: 0.65 },
  { width_mm: 100, height_mm: 100, qty: 5000, price_per_unit: 0.55 },
  { width_mm: 100, height_mm: 100, qty: 10000, price_per_unit: 0.42 },
  { width_mm: 150, height_mm: 150, qty: 1000, price_per_unit: 1.5 },
  { width_mm: 150, height_mm: 150, qty: 3000, price_per_unit: 1.25 },
  { width_mm: 150, height_mm: 150, qty: 5000, price_per_unit: 1.1 },
  { width_mm: 150, height_mm: 150, qty: 10000, price_per_unit: 0.85 },
  { width_mm: 300, height_mm: 450, qty: 1000, price_per_unit: 2.5 },
  { width_mm: 300, height_mm: 450, qty: 3000, price_per_unit: 2.1 },
  { width_mm: 300, height_mm: 450, qty: 5000, price_per_unit: 1.85 },
  { width_mm: 300, height_mm: 450, qty: 10000, price_per_unit: 1.5 },
  { width_mm: 300, height_mm: 500, qty: 1000, price_per_unit: 2.75 },
  { width_mm: 300, height_mm: 500, qty: 3000, price_per_unit: 2.35 },
  { width_mm: 300, height_mm: 500, qty: 5000, price_per_unit: 2.05 },
  { width_mm: 300, height_mm: 500, qty: 10000, price_per_unit: 1.65 },
];

/** m² maliyet oranı — kuşe referans (legacy pricing_config) */
export const RULO_MATERIAL_PRICE_MULTIPLIERS: Record<
  string,
  { display_name: string; multiplier: number }
> = {
  kuse: { display_name: "Kuşe Rulo Etiket", multiplier: 1.0 },
  kraft: { display_name: "Kraft Rulo Etiket", multiplier: 300 / 350 },
  beyaz: { display_name: "Opak PP Rulo Etiket", multiplier: 400 / 350 },
  ultra: { display_name: "Ultra Clear Rulo Etiket", multiplier: 600 / 350 },
  seffaf: { display_name: "Şeffaf Rulo Etiket", multiplier: 600 / 350 },
  metalik: { display_name: "Metalik Rulo Etiket", multiplier: 900 / 350 },
};

export const PRICEBOOK_DEFAULT_AXES = {
  width: [30, 50, 70, 100, 150, 300],
  height: [30, 50, 70, 100, 150, 450, 500],
  qty: [1000, 3000, 5000, 10000],
};

export function buildMaterialCells(
  materialKey: string,
  baseCells: typeof KUSE_BASE_CELLS = KUSE_BASE_CELLS
): PricebookCellMap {
  const mult =
    RULO_MATERIAL_PRICE_MULTIPLIERS[materialKey]?.multiplier ?? 1;
  const cells: PricebookCellMap = {};
  for (const c of baseCells) {
    const key = pricebookCellKey(c.width_mm, c.height_mm, c.qty);
    cells[key] = Number((c.price_per_unit * mult).toFixed(4));
  }
  return cells;
}

export function buildFallbackPricebookSnapshot(
  markup_pct = 50
): PricebookSnapshot {
  const matrices: PricebookSnapshot["matrices"] = {};
  for (const [key, meta] of Object.entries(RULO_MATERIAL_PRICE_MULTIPLIERS)) {
    matrices[key] = {
      meta: {
        id: `fallback-${key}`,
        material_key: key,
        display_name: meta.display_name,
        active: true,
        version: 1,
      },
      cells: buildMaterialCells(key),
    };
  }
  return {
    markup_pct,
    axes: PRICEBOOK_DEFAULT_AXES,
    matrices,
  };
}

/** Kuşe matrisinden yeni malzeme üret (admin UI klonlama) */
export function cloneCellsFromKuse(
  targetMaterialKey: string,
  sourceCells: PricebookCellMap
): PricebookCellMap {
  const mult =
    RULO_MATERIAL_PRICE_MULTIPLIERS[targetMaterialKey]?.multiplier ?? 1;
  const out: PricebookCellMap = {};
  for (const [key, price] of Object.entries(sourceCells)) {
    out[key] = Number((price * mult).toFixed(4));
  }
  return out;
}
