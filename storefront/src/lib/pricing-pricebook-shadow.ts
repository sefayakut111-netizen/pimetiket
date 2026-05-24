/**
 * Faz 4 — Shadow diff: eski m² (pricing-calc area) vs partner price book.
 */

import { calculatePrice } from "./pricing-calc";
import type { ProfileConfig } from "./pricing-config-types";
import { quoteEtiket } from "./pricing-engine";
import {
  quoteRuloFromPricebook,
  type PricebookSnapshot,
  type RuloPricebookQuoteInput,
} from "./pricing-pricebook";
import type { PricebookLookupDiagnostics } from "./pricing-pricebook-types";

export type { RuloPricebookQuoteInput as PricebookShadowInput };

export interface PricebookShadowCompareOk {
  ok: true;
  billable_m2: number;
  legacy_ok: boolean;
  pricebook_ok: boolean;
  legacy_total: number | null;
  legacy_unit: number | null;
  pricebook_total: number | null;
  pricebook_unit: number | null;
  partner_unit: number | null;
  delta_total: number | null;
  delta_pct: number | null;
  legacy_reason?: string;
  pricebook_reason?: string;
  diagnostics?: PricebookLookupDiagnostics;
}

export interface PricebookShadowCompareFail {
  ok: false;
  reason: string;
}

export type PricebookShadowCompareResult =
  | PricebookShadowCompareOk
  | PricebookShadowCompareFail;

/** Eski area motoru (m² × tier) ile price book yan yana */
export function comparePricebookVsLegacyArea(
  config: ProfileConfig,
  snapshot: PricebookSnapshot,
  input: RuloPricebookQuoteInput
): PricebookShadowCompareResult {
  const coating =
    typeof input.selected_options.coating === "string"
      ? input.selected_options.coating
      : "yok";

  const geom = quoteEtiket({
    width: input.width_mm,
    height: input.height_mm,
    qty: input.qty,
    materialId: input.material_key,
    coatingId: coating,
    customizationId: "yok",
    production: { mode: "fason", rate: 100 },
    operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
    margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },
  });

  if (!geom.ok) {
    return { ok: false, reason: geom.reason };
  }

  const legacyConfig: ProfileConfig = {
    ...config,
    pricing_mode: "area",
  };

  const legacy = calculatePrice(
    {
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      qty: input.qty,
      material_id: input.material_key,
      selected_options: input.selected_options,
      billable_m2: geom.geometry.totalM2,
    },
    legacyConfig
  );

  const pb = quoteRuloFromPricebook(snapshot, config, input);

  const legacyTotal = legacy.ok ? legacy.final : null;
  const legacyUnit = legacy.ok ? legacy.unit_price : null;
  const pbTotal = pb.ok ? pb.total : null;
  const pbUnit = pb.ok ? pb.unitPrice : null;

  let deltaTotal: number | null = null;
  let deltaPct: number | null = null;
  if (legacyTotal !== null && pbTotal !== null && legacyTotal > 0) {
    deltaTotal = pbTotal - legacyTotal;
    deltaPct = (deltaTotal / legacyTotal) * 100;
  }

  return {
    ok: true,
    billable_m2: geom.geometry.totalM2,
    legacy_ok: legacy.ok,
    pricebook_ok: pb.ok,
    legacy_total: legacyTotal,
    legacy_unit: legacyUnit,
    pricebook_total: pbTotal,
    pricebook_unit: pbUnit,
    partner_unit: pb.ok ? pb.partner_unit_per_label : null,
    delta_total: deltaTotal,
    delta_pct: deltaPct,
    legacy_reason: legacy.ok ? undefined : legacy.reason,
    pricebook_reason: pb.ok ? undefined : pb.reason,
    diagnostics: pb.ok ? pb.diagnostics : undefined,
  };
}
