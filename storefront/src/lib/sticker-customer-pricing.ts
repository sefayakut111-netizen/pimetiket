/**
 * Customer-facing sticker pricing — /sticker configurator için thin wrapper.
 *
 * Mevcut /sticker UI'sının (shape/material/finish/size/tier) shared
 * pricing-engine'e bağlanması (Block A.7).
 *
 * Mantık:
 *   - Customer kendi seçimleriyle (boyut, malzeme, yüzey, adet) basit fiyat görür
 *   - Material + finish multiplier'ları fason rate'e bindirilir
 *     (hidden surcharge — customer "vinil + holografik = +X TL" görmez,
 *      sadece final fiyatın farklı olduğunu görür)
 *   - Engine'in fee gross-up + tier + KDV hesabı uygulanır
 *   - Cüzdan +%2 indirimi (PRICING_FINANCE_REVIEW.md #13) destekli
 *   - Customer "fire %", "m²", "tabaka" gibi operasyonel detay GÖRMEZ
 */

import {
  quoteSticker,
  type CutType,
  type QuoteResult,
} from "./pricing-engine";
import { getDefaultInput } from "./pricing-profiles";

// ============================================================
// Customer-facing types
// ============================================================

export type StickerMaterial = "vinil" | "transparan" | "holo" | "simli";
export type StickerFinish = "parlak" | "mat";

/** Customer-facing tier'lar — engine tier'larıyla uyumlu */
export const CUSTOMER_STICKER_TIERS = [50, 100, 250, 500, 1000] as const;
export type CustomerStickerTier = (typeof CUSTOMER_STICKER_TIERS)[number];

/** Material → fason rate multiplier (gizli surcharge) */
export const MATERIAL_MULT: Record<StickerMaterial, number> = {
  vinil: 1.0,
  transparan: 1.1,
  holo: 1.4,
  simli: 1.3, // glitter base — premium ama holo'dan az
};

/** Finish → fason rate multiplier (gizli surcharge) */
export const FINISH_MULT: Record<StickerFinish, number> = {
  parlak: 1.0,
  mat: 1.05,
};

export interface CustomerQuoteInput {
  /** Sticker genişliği mm. Min 25, max 400 (BIG_SHEET_W). */
  width: number;
  /** Sticker yüksekliği mm. Min 25, max 650 (BIG_SHEET_H). */
  height: number;
  material: StickerMaterial;
  finish: StickerFinish;
  qty: number;
  /** Müşteri cüzdandan ödüyor mu — +%2 indirim */
  walletPayment?: boolean;
  /** Kesim tipi — default die-cut (customer-friendly) */
  cut?: CutType;
}

/** Sticker boyut sınırları (customer-facing) */
export const STICKER_MIN_DIM = 25;
export const STICKER_MAX_W = 400;
export const STICKER_MAX_H = 650;

/** Customer-friendly quote sonucu — operasyonel detay yok */
export interface CustomerQuoteSuccess {
  ok: true;
  /** KDV dahil müşteri fiyatı (cüzdan indirimi öncesi) */
  total: number;
  /** Birim fiyat (KDV dahil, cüzdan indirimi öncesi) */
  unitPrice: number;
  /** Eğer cüzdan ödeme: indirim TL */
  walletDiscount: number;
  /** Cüzdan indirimi sonrası nihai */
  totalAfterWallet: number;
  unitAfterWallet: number;
  /** Hediye sticker — engine producedQty - requestedQty */
  overrunCount: number;
  /** Tier multiplier kullanıldı (display için) */
  tierMultiplier: number;
  /** Toplam cost'a uygulanan material+finish multiplier */
  surchargeMultiplier: number;
}

export interface CustomerQuoteError {
  ok: false;
  reason: string;
  bigEtiketRedirect?: boolean;
}

export type CustomerQuoteResult = CustomerQuoteSuccess | CustomerQuoteError;

// ============================================================
// Quote
// ============================================================

/**
 * Customer-facing sticker quote — engine'i wrap eder, customer-friendly
 * çıktı verir (no breakdown, no fire %, no m²).
 *
 * Material + finish multiplier fason rate'e bindirilir (hidden surcharge):
 *   effectiveRate = defaultFasonRate × materialMult × finishMult
 */
export function quoteCustomerSticker(
  input: CustomerQuoteInput
): CustomerQuoteResult {
  const defaults = getDefaultInput();
  const matMult = MATERIAL_MULT[input.material];
  const finMult = FINISH_MULT[input.finish];
  const surchargeMultiplier = matMult * finMult;

  const result: QuoteResult = quoteSticker({
    width: input.width,
    height: input.height,
    cut: input.cut ?? "diecut",
    qty: input.qty,
    production: {
      mode: "fason",
      rate: defaults.fasonRate * surchargeMultiplier,
    },
    operation: {
      setup: defaults.setup,
      packaging: defaults.packaging,
      cargo: defaults.cargo,
      feePct: defaults.feePct,
    },
    margin: {
      marginPct: defaults.marginPct,
      vatPct: defaults.vatPct,
      // Customer flow: minMarkup floor düşük (zaten customer-side)
      minMarkupFraction: 0,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      bigEtiketRedirect: result.bigEtiketRedirect,
    };
  }

  const { cost, geometry } = result;

  // Cüzdan +%2 indirimi (PRICING_FINANCE_REVIEW.md #13)
  const walletDiscount = input.walletPayment ? cost.total * 0.02 : 0;
  const totalAfterWallet = cost.total - walletDiscount;
  const unitAfterWallet = totalAfterWallet / input.qty;

  const overrunCount = Math.max(
    geometry.fit.producedQty - input.qty,
    0
  );

  return {
    ok: true,
    total: cost.total,
    unitPrice: cost.unitPrice,
    walletDiscount,
    totalAfterWallet,
    unitAfterWallet,
    overrunCount,
    tierMultiplier: cost.tierMultiplier,
    surchargeMultiplier,
  };
}

/**
 * Tier savings hesabı — bir tier'ın en küçük tier'a göre %tasarrufu.
 * Aynı material+finish+size ile.
 */
export function computeTierSavings(
  input: Omit<CustomerQuoteInput, "qty">,
  baseTier: CustomerStickerTier,
  targetTier: CustomerStickerTier
): number {
  const base = quoteCustomerSticker({ ...input, qty: baseTier });
  const target = quoteCustomerSticker({ ...input, qty: targetTier });

  if (!base.ok || !target.ok || base.unitPrice === 0) return 0;
  return Math.round((1 - target.unitPrice / base.unitPrice) * 100);
}
