/**
 * Partner Price Book — public API.
 *
 * Rulo etiket fiyatlandirmasi: WxH x qty matris + retail katmani.
 */

import type { ProfileConfig } from "./pricing-config-types";
import { lookupPricebookFromSnapshot } from "./pricing-pricebook-lookup";
import {
  FALLBACK_PRICEBOOK_SNAPSHOT,
  type PricebookLookupDiagnostics,
  type PricebookSnapshot,
} from "./pricing-pricebook-types";
import { applyRetailLayer } from "./pricing-retail";

export type {
  PricebookSnapshot,
  PricebookLookupDiagnostics,
} from "./pricing-pricebook-types";

export { buildFallbackPricebookSnapshot } from "./pricing-pricebook-seed";
export {
  RULO_MATERIAL_PRICE_MULTIPLIERS,
  KUSE_BASE_CELLS,
} from "./pricing-pricebook-seed";
export { lookupPricebookFromSnapshot } from "./pricing-pricebook-lookup";
export { FALLBACK_PRICEBOOK_SNAPSHOT } from "./pricing-pricebook-types";

export interface RuloPricebookQuoteInput {
  width_mm: number;
  height_mm: number;
  qty: number;
  material_key: string;
  selected_options: Record<string, string | string[] | undefined>;
}

export interface RuloPricebookQuoteOk {
  ok: true;
  total: number;
  unitPrice: number;
  partner_unit_per_label: number;
  partner_subtotal: number;
  diagnostics: PricebookLookupDiagnostics;
  matrix_version: number;
  retail: ReturnType<typeof applyRetailLayer>;
}

export interface RuloPricebookQuoteFail {
  ok: false;
  reason: string;
  hint?: string;
  min_qty?: number;
  max_qty?: number;
}

export type RuloPricebookQuoteResult =
  | RuloPricebookQuoteOk
  | RuloPricebookQuoteFail;

/** Snapshot + config ile rulo fiyat (sync — client preview icin) */
export function quoteRuloFromPricebook(
  snapshot: PricebookSnapshot,
  config: ProfileConfig,
  input: RuloPricebookQuoteInput
): RuloPricebookQuoteResult {
  const lookup = lookupPricebookFromSnapshot(snapshot, {
    width_mm: input.width_mm,
    height_mm: input.height_mm,
    qty: input.qty,
    material_key: input.material_key,
  });

  if (!lookup.ok) {
    return {
      ok: false,
      reason: lookup.reason,
      hint: lookup.hint,
      min_qty: lookup.min_qty,
      max_qty: lookup.max_qty,
    };
  }

  const retail = applyRetailLayer(
    {
      qty: input.qty,
      base_subtotal: lookup.partner_subtotal,
      selected_options: input.selected_options,
      skip_tier: true,
      markup_pct_override: snapshot.markup_pct,
    },
    config
  );

  return {
    ok: true,
    total: retail.final,
    unitPrice: retail.unit_price,
    partner_unit_per_label: lookup.partner_unit_per_label,
    partner_subtotal: lookup.partner_subtotal,
    diagnostics: lookup.diagnostics,
    matrix_version: lookup.matrix_version,
    retail,
  };
}

/** pricebook modu aktif mi? */
export function isPricebookMode(config: ProfileConfig): boolean {
  return config.pricing_mode === "pricebook";
}
