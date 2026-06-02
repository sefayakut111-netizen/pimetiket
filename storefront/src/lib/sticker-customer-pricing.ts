/**
 * Customer-facing sticker pricing — /sticker configurator için thin wrapper.
 *
 * Mevcut /sticker UI'sının (shape/material/finish/size/tier) shared
 * pricing-engine'e bağlanması (Block A.7).
 *
 * Mantık:
 *   - Customer kendi seçimleriyle (boyut, malzeme, yüzey, adet) basit fiyat görür
 *   - Material + finish multiplier'ları fason rate'e bindirilir
 *     (hidden surcharge — customer "vinil + holografik = +X ₺" görmez,
 *      sadece final fiyatın farklı olduğunu görür)
 *   - Engine'in fee gross-up + tier + KDV hesabı uygulanır
 *   - Cüzdan +%2 indirimi (PRICING_FINANCE_REVIEW.md #13) destekli
 *   - Customer "fire %", "m²", "tabaka" gibi operasyonel detay GÖRMEZ
 */

import {
  quoteSticker,
  type QuoteResult,
} from "./pricing-engine";
import { getDefaultInput } from "./pricing-profiles";
import { FALLBACK_STICKER_CONFIG } from "./pricing-config-types";
import { KARTLI_MARGIN_MM } from "@/lib/editor/cutline/export-svg";

// ============================================================
// Customer-facing types
// ============================================================

export type StickerMaterial = "vinil" | "transparan" | "holo" | "simli";
export type StickerFinish = "parlak" | "mat" | "yok";
export type StickerCutType = "tabaka" | "diecut" | "kisscut" | "kartli";

/** Customer-facing tier preset'leri — chip'ler için kullanılır.
 * Müşteri serbest qty seçer (25'er artış); engine en yakın tier
 * zammını otomatik uygular (findTier). */
export const CUSTOMER_STICKER_TIERS = [25, 50, 100, 250, 500, 1000] as const;
export type CustomerStickerTier = (typeof CUSTOMER_STICKER_TIERS)[number];

/** Sticker qty sınırları — UI input için */
export const STICKER_MIN_QTY = 25;
export const STICKER_MAX_QTY = 1000;
export const STICKER_QTY_STEP = 25;

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
  yok: 0.95, // Kaplamasız — küçük indirim, kaplama maliyeti yok
};

/** Kesim türü → fiyat çarpanı (admin config fail fallback) */
export const CUT_MULT: Record<StickerCutType, number> = {
  diecut: 1.10,
  kartli: 1.10,
  kisscut: 1.00,
  tabaka: 1.00,
};

export interface CustomerQuoteInput {
  /** Sticker genişliği mm. Min 25, max 400 (BIG_SHEET_W). */
  width: number;
  /** Sticker yüksekliği mm. Min 25, max 650 (BIG_SHEET_H). */
  height: number;
  material: StickerMaterial;
  finish: StickerFinish;
  qty: number;
  /** Kesim tipi — default die-cut (customer-friendly) */
  cut?: StickerCutType;
}

/** Sticker boyut sınırları (customer-facing) */
export const STICKER_MIN_DIM = 25;
export const STICKER_MAX_W = 400;
export const STICKER_MAX_H = 650;

/** Customer-friendly quote sonucu — operasyonel detay yok */
export interface CustomerQuoteSuccess {
  ok: true;
  /** KDV dahil müşteri fiyatı */
  total: number;
  /** Birim fiyat (KDV dahil) */
  unitPrice: number;
  /** Hediye sticker — engine producedQty - requestedQty */
  overrunCount: number;
  /** Tier multiplier kullanıldı (display için) */
  tierMultiplier: number;
  /** Toplam cost'a uygulanan material+finish multiplier */
  surchargeMultiplier: number;
  /** Sefa 18 May v67: canlı önizleme için geometri özetı.
   *  Preview tabaka grid'i bu cols × rows üzerinden çizilir. */
  geometry: {
    cols: number;
    rows: number;
    perSheet: number;
    sheetsNeeded: number;
    sheetW: number;
    sheetH: number;
  };
}

export interface CustomerQuoteError {
  ok: false;
  reason: string;
  bigEtiketRedirect?: boolean;
}

export type CustomerQuoteResult = CustomerQuoteSuccess | CustomerQuoteError;

/** Kartlı sticker — fiyat/geometri için dış kart boyutu (sticker + 2×margin). */
export function resolveStickerQuoteDimensions(
  input: Pick<CustomerQuoteInput, "width" | "height" | "cut">
): {
  geomWidth: number;
  geomHeight: number;
  pricingWidthMm: number;
  pricingHeightMm: number;
} {
  const isKartli = input.cut === "kartli";
  const marginTotal = KARTLI_MARGIN_MM * 2;
  const geomWidth = isKartli ? input.width + marginTotal : input.width;
  const geomHeight = isKartli ? input.height + marginTotal : input.height;
  return {
    geomWidth,
    geomHeight,
    pricingWidthMm: geomWidth,
    pricingHeightMm: geomHeight,
  };
}

export function resolveStickerGeomCut(
  cut: StickerCutType | undefined
): "tabaka" | "diecut" {
  const key = cut ?? "diecut";
  if (key === "kisscut" || key === "kartli") return "diecut";
  return key === "tabaka" ? "tabaka" : "diecut";
}

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
  const cutKey = input.cut ?? "diecut";
  const cutMult = CUT_MULT[cutKey];
  const surchargeMultiplier = matMult * finMult * cutMult;
  const { geomWidth, geomHeight } = resolveStickerQuoteDimensions(input);
  const geomCut = resolveStickerGeomCut(cutKey);

  const result: QuoteResult = quoteSticker({
    width: geomWidth,
    height: geomHeight,
    cut: geomCut,
    qty: input.qty,
    production: {
      mode: "fason",
      rate: defaults.fasonRate * surchargeMultiplier,
    },
    operation: {
      setup: 0,
      packaging: 0,
      feePct: FALLBACK_STICKER_CONFIG.operation.fee_pct ?? 2.5,
    },
    vatPct: 20,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      bigEtiketRedirect: result.bigEtiketRedirect,
    };
  }

  const { cost, geometry } = result;

  const overrunCount = Math.max(
    geometry.fit.producedQty - input.qty,
    0
  );

  return {
    ok: true,
    total: cost.total,
    unitPrice: cost.unitPrice,
    overrunCount,
    tierMultiplier: cost.tierMultiplier,
    surchargeMultiplier,
    geometry: {
      cols: geometry.fit.cols,
      rows: geometry.fit.rows,
      perSheet: geometry.fit.perSheet,
      sheetsNeeded: geometry.fit.sheetsNeeded,
      sheetW: geometry.fit.sheetW,
      sheetH: geometry.fit.sheetH,
    },
  };
}

/**
 * Tier savings hesabı — bir qty'nin baseQty'a göre %tasarrufu.
 * Aynı material+finish+size ile. Müşteri serbest qty seçebildiği
 * için number kabul eder (preset literal union şart değil).
 */
export function computeTierSavings(
  input: Omit<CustomerQuoteInput, "qty">,
  baseQty: number,
  targetQty: number
): number {
  const base = quoteCustomerSticker({ ...input, qty: baseQty });
  const target = quoteCustomerSticker({ ...input, qty: targetQty });

  if (!base.ok || !target.ok || base.unitPrice === 0) return 0;
  return Math.round((1 - target.unitPrice / base.unitPrice) * 100);
}
