/**
 * Customer-facing etiket pricing — /etiket configurator için thin wrapper.
 *
 * /etiket UI'sının (malzeme/kaplama/özelleştirme/sarım/adet/ölçü)
 * shared pricing-engine'e bağlanması (Block A.7 — etiket yarısı).
 *
 * Mantık (sticker-customer-pricing.ts ile paralel):
 *   - Customer kendi seçimleriyle parametre verir (UI id'leri)
 *   - quoteEtiket() çağrılır — engine fiyat çıkarır
 *   - Customer "fire %", "m²", "tabaka", "PSP fee" GÖRMEZ
 *   - Cüzdan +%2 indirim slot'u
 */

import { quoteEtiket, type QuoteResult } from "./pricing-engine";
import { getDefaultInput } from "./pricing-profiles";

export type EtiketMaterialId = "kraft" | "beyaz" | "kuse" | "ultra" | "metalik";
export type EtiketCoatingId = "yok" | "mat" | "parlak" | "soft";
export type EtiketCustomId = "yok" | "emboss" | "yaldiz" | "spotuv";

/** Customer-facing tier preset'leri — chip'ler için kullanılır.
 * Müşteri serbest qty seçer (500'er artış); engine en yakın tier
 * zammını otomatik uygular (findEtiketTier). */
export const CUSTOMER_ETIKET_TIERS = [1000, 2000, 5000, 10000, 20000, 50000] as const;
export type CustomerEtiketTier = (typeof CUSTOMER_ETIKET_TIERS)[number];

/** Etiket qty sınırları — UI input için */
export const ETIKET_MIN_QTY = 1000;
export const ETIKET_MAX_QTY = 50000;
export const ETIKET_QTY_STEP = 500;

export interface CustomerEtiketQuoteInput {
  width: number; // mm
  height: number; // mm
  qty: number;
  material: EtiketMaterialId;
  coating: EtiketCoatingId;
  customization: EtiketCustomId;
}

export interface CustomerEtiketQuoteSuccess {
  ok: true;
  total: number; // KDV dahil
  unitPrice: number;
  rollsNeeded: number;
  effectiveRate: number; // gizli — UI'da gösterilmez
  multipliers: {
    material: number;
    coating: number;
    customization: number;
  };
}

export interface CustomerEtiketQuoteError {
  ok: false;
  reason: string;
}

export type CustomerEtiketQuoteResult =
  | CustomerEtiketQuoteSuccess
  | CustomerEtiketQuoteError;

/**
 * Customer-facing etiket quote.
 */
export function quoteCustomerEtiket(
  input: CustomerEtiketQuoteInput
): CustomerEtiketQuoteResult {
  const defaults = getDefaultInput();

  const result = quoteEtiket({
    width: input.width,
    height: input.height,
    qty: input.qty,
    materialId: input.material,
    coatingId: input.coating,
    customizationId: input.customization,
    production: { mode: "fason", rate: defaults.fasonRate },
    operation: {
      // Etiket-spesifik default'lar (admin etiket page ile uyumlu)
      setup: 100,
      packaging: 25,
      cargo: 100,
      feePct: defaults.feePct,
    },
    margin: {
      marginPct: defaults.marginPct,
      vatPct: defaults.vatPct,
      minMarkupFraction: 0,
    },
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }

  const { cost, geometry, effectiveRate, multipliers } = result;

  return {
    ok: true,
    total: cost.total,
    unitPrice: cost.unitPrice,
    rollsNeeded: geometry.rollsNeeded,
    effectiveRate,
    multipliers,
  };
}

/**
 * Tier savings: target tier'ın baseTier'a göre %tasarrufu.
 * QtySlider'dan gelen arbitrary değerler için number kabul eder.
 */
export function computeEtiketTierSavings(
  input: Omit<CustomerEtiketQuoteInput, "qty">,
  baseQty: number,
  targetQty: number
): number {
  const base = quoteCustomerEtiket({ ...input, qty: baseQty });
  const target = quoteCustomerEtiket({ ...input, qty: targetQty });

  if (!base.ok || !target.ok || base.unitPrice === 0) return 0;
  return Math.round((1 - target.unitPrice / base.unitPrice) * 100);
}

/**
 * Suppress unused QuoteResult import warning (re-export uyumu için tutuluyor).
 */
export type { QuoteResult };
