/**
 * Sticker pricing — maliyet ve fiyat hesabı (saf fonksiyon).
 *
 * Kaynak: docs/PRICING_SPEC.md §4-5
 * Modül: sticker-fiyatlama.html v0.3 — `compute()`
 *
 * Akış:
 *   baseCost = production + operation
 *   + kar (×margin%)
 *   + işlem ücreti (×opFee%)
 *   = preTierSubtotal
 *   × tier çarpanı
 *   = subtotal
 *   + KDV
 *   = total
 *
 * Müşteri-yüzü dönüşler: subtotal, vatAmount, total, unitPrice.
 * Operatör-yüzü dönüşler: tüm productionItems, operationItems, profit, breakdown.
 */

import { STICKER_TIERS, type StickerTier } from "./constants";
import type { GeometryResult } from "./geometry";

// ============================================================
// Types
// ============================================================

export type ProductionMode = "fason" | "uretim";

export interface FasonRates {
  mode: "fason";
  /** Fason birim maliyet TL/m² */
  rate: number;
}

export interface UretimRates {
  mode: "uretim";
  paper: number; // Kağıt/Folio TL/m²
  ink: number; // Mürekkep TL/m²
  coating: number; // Kaplama TL/m²
  labor: number; // İşçilik TL/m²
  overhead: number; // Genel gider TL/m²
  depreciation: number; // Amortisman TL/m²
}

export type ProductionRates = FasonRates | UretimRates;

export interface OperationRates {
  /** Hazırlık tek seferlik TL */
  setup: number;
  /** Paketleme TL/zarf (büyük tabakada × 2) */
  packaging: number;
  /** Kargo TL */
  cargo: number;
  /** İşlem ücreti % (ödeme komisyonu) */
  feePct: number;
}

export interface MarginConfig {
  /** Kar marjı % (üretim+operasyon üstüne) */
  marginPct: number;
  /** KDV % */
  vatPct: number;
}

export interface CostInput {
  geometry: GeometryResult;
  /** Müşteri talep ettiği adet (üretilen değil) */
  requestedQty: number;
  production: ProductionRates;
  operation: OperationRates;
  margin: MarginConfig;
  /** Adet kademesinden seçilen tier */
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

  // Toplam maliyet (production + operation)
  baseCost: number;

  // Kar
  profit: number;

  // İşlem ücreti
  processingFee: number;

  // Tier öncesi ara toplam (KDV hariç)
  preTierSubtotal: number;

  // Tier ayarı (pozitif=zam, negatif=indirim)
  tierAdjustment: number;
  tierMultiplier: number;

  // Tier sonrası ara toplam (KDV hariç)
  subtotal: number;

  // KDV
  vatAmount: number;

  // Müşteri-yüzü TOPLAM (KDV dahil)
  total: number;

  // Birim fiyat (KDV dahil)
  unitPrice: number;

  // Zarf/koli sayısı (paketleme için)
  envelopeCount: number;
}

// ============================================================
// Hesap
// ============================================================

/**
 * Üretim modu için kalemleri hesaplar.
 */
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
          formula: `${totalM2.toFixed(3)} m² × ${rates.rate} TL/m²`,
          amount: cost,
        },
      ],
      total: cost,
    };
  }

  // Üretim modu — 6 kalem
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
      formula: `${totalM2.toFixed(3)} m² × ${rate} TL/m²`,
      amount: c,
    });
    total += c;
  }

  return { items, total };
}

/**
 * Operasyon kalemleri.
 *
 * Büyük tabakada paketleme × 2 (büyük koli), kargo formula değişir
 * (ama mevcut HTML'de kargo değeri sabit, formula label "desi/m³ hesaplı").
 */
function computeOperationItems(
  envelopeCount: number,
  isBigMode: boolean,
  rates: OperationRates
): { items: CostBreakdownItem[]; total: number } {
  const packagingPerUnit = isBigMode ? rates.packaging * 2 : rates.packaging;
  const packagingTotal = packagingPerUnit * envelopeCount;

  const items: CostBreakdownItem[] = [
    {
      name: "Hazırlık",
      formula: "tek seferlik",
      amount: rates.setup,
    },
    {
      name: isBigMode ? "Paketleme (büyük koli)" : "Paketleme",
      formula: `${envelopeCount} ${isBigMode ? "koli" : "zarf"} × ${packagingPerUnit} TL`,
      amount: packagingTotal,
    },
    {
      name: "Kargo",
      formula: isBigMode ? "desi/m³ hesaplı" : "yurtiçi",
      amount: rates.cargo,
    },
  ];

  const total = rates.setup + packagingTotal + rates.cargo;
  return { items, total };
}

/**
 * Tam maliyet+fiyat hesabı.
 *
 * Adet kademesi (tier) öncesi: production + operation + margin + processingFee
 * Sonra: × tier çarpanı + KDV
 */
export function computeCost(input: CostInput): CostResult {
  const { geometry, requestedQty, production, operation, margin, tier } = input;
  const { totalM2, fit } = geometry;
  const isBigMode = fit.mode === "big";
  const envelopeCount = fit.sheetsNeeded;

  // Üretim
  const prod = computeProductionItems(totalM2, production);

  // Operasyon
  const op = computeOperationItems(envelopeCount, isBigMode, operation);

  // Base + kar + fee
  const baseCost = prod.total + op.total;
  const profit = baseCost * (margin.marginPct / 100);
  const subtotalBeforeFee = baseCost + profit;
  const processingFee = subtotalBeforeFee * (operation.feePct / 100);
  const preTierSubtotal = subtotalBeforeFee + processingFee;

  // Tier ayarı (referans tier 1.00, üstü/altı çarpan)
  const tierAdjustment = preTierSubtotal * (tier.multiplier - 1);
  const subtotal = preTierSubtotal * tier.multiplier;

  // KDV
  const vatAmount = subtotal * (margin.vatPct / 100);
  const total = subtotal + vatAmount;
  const unitPrice = total / requestedQty;

  return {
    productionItems: prod.items,
    productionCost: prod.total,
    operationItems: op.items,
    operationCost: op.total,
    baseCost,
    profit,
    processingFee,
    preTierSubtotal,
    tierAdjustment,
    tierMultiplier: tier.multiplier,
    subtotal,
    vatAmount,
    total,
    unitPrice,
    envelopeCount,
  };
}

// ============================================================
// Tier yardımcısı
// ============================================================

/**
 * Adet için en yakın tier'ı bulur (exact match veya en yakın).
 * UI'da kullanıcı tier butonuna basar — bu yardımcı API/programatik kullanım için.
 */
export function findTier(qty: number): StickerTier {
  // Exact match
  const exact = STICKER_TIERS.find((t) => t.qty === qty);
  if (exact) return exact;

  // En yakın (hem alt hem üst tier'ı düşün, yakın olanı seç)
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
