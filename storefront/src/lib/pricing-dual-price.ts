/**
 * Çift fiyat (alış/satış) — sticker + etiket tabaka.
 * Etiket rulo (pricebook) bu modülü kullanmaz.
 */

import type {
  MaterialItem,
  OptionItem,
  ProfileConfig,
  ScopeName,
} from "./pricing-config-types";

const DEFAULT_SELL_MULTIPLIER = 1.5;
const DEFAULT_COST_PCT_RATIO = 0.5;

export function resolveM2Cost(m: MaterialItem): number {
  return m.m2_cost_try ?? 0;
}

export function resolveM2Sell(m: MaterialItem): number {
  if (m.m2_sell_try != null && Number.isFinite(m.m2_sell_try)) {
    return m.m2_sell_try;
  }
  const cost = resolveM2Cost(m);
  return cost > 0 ? cost * DEFAULT_SELL_MULTIPLIER : 0;
}

export function resolveSheetCost(m: MaterialItem): number {
  return m.sheet_cost_try ?? 0;
}

export function resolveSheetSell(m: MaterialItem): number {
  if (m.sheet_sell_try != null && Number.isFinite(m.sheet_sell_try)) {
    return m.sheet_sell_try;
  }
  const cost = resolveSheetCost(m);
  return cost > 0 ? cost * DEFAULT_SELL_MULTIPLIER : 0;
}

export function resolveOptionSellPct(item: OptionItem): number {
  return item.pct_add ?? 0;
}

export function resolveOptionCostPct(item: OptionItem): number {
  if (item.pct_cost != null && Number.isFinite(item.pct_cost)) {
    return item.pct_cost;
  }
  return resolveOptionSellPct(item) * DEFAULT_COST_PCT_RATIO;
}

/** Malzeme alış→satış kâr yüzdesi (admin UI) */
export function materialProfitPct(
  m: MaterialItem,
  sheetMode = false
): number | null {
  const cost = sheetMode ? resolveSheetCost(m) : resolveM2Cost(m);
  const sell = sheetMode ? resolveSheetSell(m) : resolveM2Sell(m);
  if (cost <= 0 || sell <= 0) return null;
  return Math.round(((sell - cost) / cost) * 100);
}

export function isDualPriceScope(scope?: ScopeName | string): boolean {
  return scope === "sticker" || scope === "etiket_tabaka";
}

/** @deprecated isDualPriceScope kullan */
export function isStickerDualPriceScope(scope?: ScopeName | string): boolean {
  return isDualPriceScope(scope);
}

export function dualPriceOperationCost(
  config: ProfileConfig,
  qty: number
): number {
  const op = config.operation;
  return op.setup + op.packaging_per_unit * qty;
}

/** @deprecated dualPriceOperationCost kullan */
export function stickerOperationCost(
  config: ProfileConfig,
  qty: number
): number {
  return dualPriceOperationCost(config, qty);
}
