/**
 * Sticker pricing — maliyet ve fiyat hesabı (saf fonksiyon).
 *
 * Kaynak: docs/PRICING_SPEC.md §4-5
 * Modül: sticker-fiyatlama.html v0.3 — `compute()`
 *
 * v0.4 finans denetim düzeltmeleri (PRICING_FINANCE_REVIEW.md):
 *   #2 PSP fee gross-up (komisyon müşteri toplamına bindirilir)
 *   #3 actualMarkupPct (tier sonrası gerçek markup, intended ile karşılaştırma)
 *   #5 Big mode kargo formula (desi-bazlı: 1.5x + her koli %30)
 *   #7 Min margin guard (profit < baseCost × minMarginPct → warning)
 *
 * Akış:
 *   baseCost = production + operation
 *   intendedProfit = baseCost × markup%
 *   subtotalPure = baseCost + intendedProfit (tier öncesi pure)
 *   tieredPure = subtotalPure × tierMult
 *   subtotal = tieredPure / (1 - feePct/100)   ← FEE GROSS-UP
 *   processingFee = subtotal - tieredPure
 *   vatAmount = subtotal × vat%
 *   total = subtotal + vatAmount
 *
 * Sefa cebine net giren = tieredPure (fee tamamen recovered, tier hâlâ ezdiriyor).
 */

import { STICKER_TIERS, type StickerTier } from "./constants";
import type { GeometryResult } from "./geometry";

// ============================================================
// Types
// ============================================================

export type ProductionMode = "fason" | "uretim";

export interface FasonRates {
  mode: "fason";
  rate: number;
}

export interface UretimRates {
  mode: "uretim";
  paper: number;
  ink: number;
  coating: number;
  labor: number;
  overhead: number;
  depreciation: number;
}

export type ProductionRates = FasonRates | UretimRates;

export interface OperationRates {
  setup: number;
  packaging: number;
  cargo: number;
  feePct: number;
}

export interface MarginConfig {
  /** Markup % (cost-plus) — UI'da "Kar Marjı" olarak gösteriliyor */
  marginPct: number;
  /** KDV % */
  vatPct: number;
  /**
   * Min markup floor — actualMarkup bu değerin altına düşerse marginWarning üretilir.
   * 0-1 arası fraction (default 0.10 = %10). Override yapılabilir.
   */
  minMarkupFraction?: number;
}

export interface CostInput {
  geometry: GeometryResult;
  requestedQty: number;
  production: ProductionRates;
  operation: OperationRates;
  margin: MarginConfig;
  tier: StickerTier;
}

export interface CostBreakdownItem {
  name: string;
  formula: string;
  amount: number;
}

export interface CostResult {
  // Üretim
  productionItems: CostBreakdownItem[];
  productionCost: number;

  // Operasyon
  operationItems: CostBreakdownItem[];
  operationCost: number;

  // Toplam maliyet
  baseCost: number;

  // Intended kâr (markup × baseCost — tier öncesi)
  intendedProfit: number;
  /** @deprecated v0.4'ten önce "profit" deniyordu, şimdi intendedProfit. Geriye uyum için. */
  profit: number;

  // PSP komisyonu (gross-up sonrası, customer matrahına dahil)
  processingFee: number;

  // Tier
  preTierSubtotal: number; // pure (cost + intendedProfit), fee öncesi
  tierAdjustment: number;
  tierMultiplier: number;

  // Müşteri-yüzü amount (KDV hariç matrah, fee dahil)
  subtotal: number;
  vatAmount: number;
  total: number;
  unitPrice: number;

  envelopeCount: number;

  // ===== v0.4 yeni alanlar =====

  /**
   * Tier sonrası Sefa cebine net giren kâr (intendedProfit'tan farklı olabilir).
   * Fee gross-up ile fee tamamen recovered, sadece tier eziyor.
   * actualProfit = tieredPure - baseCost
   */
  actualProfit: number;

  /** Gerçek markup yüzdesi (actualProfit / baseCost × 100). marginPct'den düşük olabilir. */
  actualMarkupPct: number;

  /**
   * Min margin guard — actualMarkup minMarkupFraction'dan düşükse warning.
   * undefined = ihlal yok.
   */
  marginWarning?: {
    intendedMarkupPct: number;
    actualMarkupPct: number;
    floor: number;
    erosionPct: number; // intended → actual erosion %
  };
}

// ============================================================
// Production items
// ============================================================

function computeProductionItems(
  totalM2: number,
  rates: ProductionRates
): { items: CostBreakdownItem[]; total: number } {
  if (rates.mode === "fason") {
    const cost = totalM2 * rates.rate;
    return {
      items: [
        {
          name: "Fason Üretim",
          formula: `${totalM2.toFixed(3)} m² × ${rates.rate} ₺/m²`,
          amount: cost,
        },
      ],
      total: cost,
    };
  }

  const breakdown: Array<[string, number]> = [
    ["Kağıt / Folio", rates.paper],
    ["Mürekkep", rates.ink],
    ["Kaplama", rates.coating],
    ["İşçilik", rates.labor],
    ["Genel Gider", rates.overhead],
    ["Amortisman", rates.depreciation],
  ];

  const items: CostBreakdownItem[] = [];
  let total = 0;

  for (const [name, rate] of breakdown) {
    const c = totalM2 * rate;
    items.push({
      name,
      formula: `${totalM2.toFixed(3)} m² × ${rate} ₺/m²`,
      amount: c,
    });
    total += c;
  }

  return { items, total };
}

// ============================================================
// Operation items — v0.4: big mode cargo formula
// ============================================================

function computeOperationItems(
  envelopeCount: number,
  isBigMode: boolean,
  rates: OperationRates
): { items: CostBreakdownItem[]; total: number } {
  // Paketleme: büyük tabakada × 2 (büyük koli)
  const packagingPerUnit = isBigMode ? rates.packaging * 2 : rates.packaging;
  const packagingTotal = packagingPerUnit * envelopeCount;

  // Kargo: büyük tabakada desi-bazlı (baseline ×1.5 + her ek koli için ×0.3)
  // Küçük zarf: yurtiçi sabit fiyat
  const cargoMultiplier = isBigMode
    ? 1.5 + Math.max(envelopeCount - 1, 0) * 0.3
    : 1.0;
  const cargoTotal = rates.cargo * cargoMultiplier;

  const items: CostBreakdownItem[] = [
    {
      name: "Hazırlık",
      formula: "tek seferlik",
      amount: rates.setup,
    },
    {
      name: isBigMode ? "Paketleme (büyük koli)" : "Paketleme",
      formula: `${envelopeCount} ${isBigMode ? "koli" : "zarf"} × ${packagingPerUnit} ₺`,
      amount: packagingTotal,
    },
    {
      name: "Kargo",
      formula: isBigMode
        ? `${envelopeCount} koli · desi/m³ (×${cargoMultiplier.toFixed(2)})`
        : "yurtiçi",
      amount: cargoTotal,
    },
  ];

  return { items, total: rates.setup + packagingTotal + cargoTotal };
}

// ============================================================
// Main compute — v0.4 fee gross-up + actual margin tracking
// ============================================================

export function computeCost(input: CostInput): CostResult {
  const { geometry, requestedQty, production, operation, margin, tier } = input;
  const { totalM2, fit } = geometry;
  const isBigMode = fit.mode === "big";
  const envelopeCount = fit.sheetsNeeded;

  // 1. Üretim + operasyon → baseCost
  const prod = computeProductionItems(totalM2, production);
  const op = computeOperationItems(envelopeCount, isBigMode, operation);
  const baseCost = prod.total + op.total;

  // 2. Intended kâr (markup × baseCost)
  const intendedProfit = baseCost * (margin.marginPct / 100);

  // 3. Pure subtotal (KDV ve fee öncesi)
  const subtotalPure = baseCost + intendedProfit;

  // 4. Tier ayarı (preTier'a uygulanır)
  const tieredPure = subtotalPure * tier.multiplier;
  const tierAdjustment = subtotalPure * (tier.multiplier - 1);

  // 5. PSP fee GROSS-UP — komisyon müşteri toplamına bindirilir
  // Müşterinin ödediği matrah (subtotal) = tieredPure / (1 - feePct/100)
  // Çünkü PSP, müşteri ödediği subtotal'dan feePct% keser → Sefa tieredPure alır.
  const feeFraction = operation.feePct / 100;
  const subtotal =
    feeFraction < 1 ? tieredPure / (1 - feeFraction) : tieredPure;
  const processingFee = subtotal - tieredPure;

  // 6. KDV grossed-up matrah üzerinden
  const vatAmount = subtotal * (margin.vatPct / 100);
  const total = subtotal + vatAmount;
  const unitPrice = total / requestedQty;

  // 7. Actual kâr (tier sonrası, fee gross-up zaten recovered)
  // Sefa cebine giren = tieredPure (fee tarafından alınmadı çünkü grossed-up)
  const actualProfit = tieredPure - baseCost;
  const actualMarkupPct = baseCost > 0 ? (actualProfit / baseCost) * 100 : 0;

  // 8. Min margin guard
  const minMarkupFraction = margin.minMarkupFraction ?? 0.10;
  const floor = baseCost * minMarkupFraction;
  let marginWarning: CostResult["marginWarning"];
  if (actualProfit < floor) {
    const intendedMarkup = margin.marginPct;
    const erosion = intendedMarkup > 0
      ? ((intendedMarkup - actualMarkupPct) / intendedMarkup) * 100
      : 0;
    marginWarning = {
      intendedMarkupPct: intendedMarkup,
      actualMarkupPct,
      floor: minMarkupFraction * 100,
      erosionPct: erosion,
    };
  }

  return {
    productionItems: prod.items,
    productionCost: prod.total,
    operationItems: op.items,
    operationCost: op.total,
    baseCost,
    intendedProfit,
    profit: intendedProfit, // legacy alias
    processingFee,
    preTierSubtotal: subtotalPure,
    tierAdjustment,
    tierMultiplier: tier.multiplier,
    subtotal,
    vatAmount,
    total,
    unitPrice,
    envelopeCount,
    actualProfit,
    actualMarkupPct,
    marginWarning,
  };
}

// ============================================================
// Tier finder
// ============================================================

export function findTier(qty: number): StickerTier {
  const exact = STICKER_TIERS.find((t) => t.qty === qty);
  if (exact) return exact;

  let closest = STICKER_TIERS[0];
  let minDistance = Math.abs(qty - closest.qty);

  for (const t of STICKER_TIERS) {
    const d = Math.abs(qty - t.qty);
    if (d < minDistance) {
      minDistance = d;
      closest = t;
    }
  }

  return closest;
}
