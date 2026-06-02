/**
 * Sipariş kalemi → üretim dizgi geometrisi (fiyat yok, saf layout).
 * Partner portal + admin SVG bileşenleri bu sonucu kullanır.
 */

import {
  computeGeometry,
  computeEtiketGeometry,
  adaptEtiketToGeometryResult,
  type CutType,
  type GeometryResult,
} from "@/lib/pricing-engine";
import {
  resolveStickerGeomCut,
  resolveStickerQuoteDimensions,
  type StickerCutType,
} from "@/lib/sticker-customer-pricing";

export interface OrderItemLayoutInput {
  product: string;
  width: number;
  height: number;
  qty: number;
  meta?: Record<string, unknown> | null;
}

function readCut(meta: Record<string, unknown> | null | undefined): string | undefined {
  const cut = meta?.cut;
  return typeof cut === "string" ? cut : undefined;
}

function stickerCutFromMeta(meta: Record<string, unknown> | null | undefined): StickerCutType {
  const cut = readCut(meta);
  if (
    cut === "tabaka" ||
    cut === "diecut" ||
    cut === "kisscut" ||
    cut === "kartli"
  ) {
    return cut;
  }
  return "diecut";
}

/** computeGeometry için kesim tipi (kisscut/kartli → diecut). */
export function mapOrderItemToGeometryCut(
  product: string,
  meta?: Record<string, unknown> | null
): CutType {
  if (product === "etiket_tabaka") return "tabaka";
  if (product === "sticker") {
    return resolveStickerGeomCut(stickerCutFromMeta(meta));
  }
  return "diecut";
}

/** Partner / üretim özeti — fiyat alanları yok. */
export interface ProductionLayoutSummary {
  cutLabel: string;
  grid: string;
  perUnit: number;
  unitLabel: string;
  unitsNeeded: number;
  unitsLabel: string;
  sheetOrRollSize: string;
  producedQty: number;
}

export function summarizeProductionLayout(
  geometry: GeometryResult,
  product: string
): ProductionLayoutSummary {
  const { fit, roll } = geometry;
  const isTabaka = fit.mode === "tabaka" && geometry.effectiveCut === "tabaka";

  if (product.startsWith("etiket")) {
    return {
      cutLabel: product === "etiket_tabaka" ? "Tabaka etiket" : "Rulo etiket (die-cut)",
      grid: `${fit.cols}×${fit.rows}`,
      perUnit: fit.perSheet,
      unitLabel: "adet/rulo",
      unitsNeeded: roll.rollsNeeded,
      unitsLabel: "rulo",
      sheetOrRollSize: `${roll.rollW}×${Math.round(roll.totalLengthMm / roll.rollsNeeded)} mm (rulo en×ort. boy)`,
      producedQty: fit.producedQty,
    };
  }

  return {
    cutLabel: isTabaka ? "Yarım kesim (tabaka)" : "Tam kesim (die-cut)",
    grid: `${fit.cols}×${fit.rows}`,
    perUnit: fit.perSheet,
    unitLabel: isTabaka ? "ad/tabaka" : "ad/rulo",
    unitsNeeded: isTabaka ? fit.sheetsNeeded : roll.rollsNeeded,
    unitsLabel: isTabaka ? "tabaka" : "rulo",
    sheetOrRollSize: isTabaka
      ? `${fit.sheetW}×${fit.sheetH} mm (dış tabaka)`
      : `${roll.rollW} mm rulo eni`,
    producedQty: fit.producedQty,
  };
}

/**
 * Sipariş kalemi için dizgi SVG verisi.
 * Sticker: computeGeometry. Etiket rulo: computeEtiketGeometry + adapter.
 */
export function computeOrderItemLayoutGeometry(
  item: OrderItemLayoutInput
): GeometryResult | null {
  const { product, width, height, qty } = item;
  if (width < 1 || height < 1 || qty < 1) return null;

  if (product === "etiket_rulo") {
    const eg = computeEtiketGeometry(width, height, qty);
    return eg ? adaptEtiketToGeometryResult(eg) : null;
  }

  if (product === "sticker") {
    const stickerCut = stickerCutFromMeta(item.meta);
    const { geomWidth, geomHeight } = resolveStickerQuoteDimensions({
      width,
      height,
      cut: stickerCut,
    });
    const engineCut = resolveStickerGeomCut(stickerCut);
    return computeGeometry({
      width: geomWidth,
      height: geomHeight,
      cut: engineCut,
      qty,
    });
  }

  if (product === "etiket_tabaka") {
    return computeGeometry({
      width,
      height,
      cut: "tabaka",
      qty,
    });
  }

  return null;
}

export function showSheetPreviewForLayout(geometry: GeometryResult): boolean {
  return geometry.fit.mode === "tabaka" || geometry.fit.mode === "diecut";
}
