/**
 * Cart PDF helpers — sepetteki item snapshot'ından PDF için synthetic
 * GeometryResult + CostResult yeniden oluştur.
 *
 * pricing-cart.ts'teki CartItem zaten gerekli tüm alanları taşıyor.
 * Bu helper sadece PDF generator'ın beklediği yapıya çevirir.
 */

import type { CartItem } from "./pricing-cart";
import type {
  CostResult,
  CostBreakdownItem,
  GeometryResult,
} from "./pricing-engine";

/**
 * CartItem → GeometryResult (PDF için synthetic).
 * Etiket için tabaka kavramı yok, rulo bazlı; sticker için tabaka.
 */
export function reconstructGeometryFromCart(item: CartItem): GeometryResult {
  const isEtiket = item.product === "etiket";

  return {
    fit: {
      mode: (item.layoutMode ?? "small") as "small" | "big",
      cols: 1, // detail yok — PDF'te approximate
      rows: 1,
      perSheet: isEtiket ? 1 : 1,
      sheetsNeeded: item.rollsNeeded,
      sheetW: item.width,
      sheetH: item.height,
      stickerW: item.width,
      stickerH: item.height,
      usedW: item.width,
      usedH: item.height,
      gap: 6,
      rotated: false,
      forcedDieCut: isEtiket,
      producedQty: item.producedQty,
      overrun: 0,
    },
    roll: {
      rollW: 600,
      cols: 1,
      rows: 1,
      sheetsPerRoll: 1,
      rollsNeeded: item.rollsNeeded,
      sheetsOnLastRoll: item.requestedQty,
      lastRowsCount: 1,
      lastRollLengthMm: 1520,
      totalLengthMm: 1520 * item.rollsNeeded,
      totalArea: item.totalM2 * 1_000_000,
      usableW: 520,
      usableL: 1470,
      extraSidePad: 0,
    },
    totalM2: item.totalM2,
    stickerArea: (item.width * item.height * item.producedQty) / 1_000_000,
    wastePct: 0,
    effectiveCut: isEtiket ? "diecut" : (item.cut ?? "diecut"),
  };
}

/**
 * CartItem → CostResult (PDF için synthetic). Cost detay snapshot'ı
 * tam değil — item.baseCost/profit/total alanları kullanılıyor.
 *
 * NOT: PDF iş emri "Sepet PDF"inde fiyat detayı tek satır göründüğü
 * için yeterli. Sefa istediğinde tam reconstruction yapılır.
 */
export function reconstructCostFromCart(item: CartItem): CostResult {
  const productionItems: CostBreakdownItem[] = [
    {
      name: item.product === "etiket" ? "Etiket Üretim" : "Sticker Üretim",
      formula: `${item.totalM2.toFixed(3)} m²`,
      amount: item.baseCost * 0.7, // approx — tam breakdown kayıtta yok
    },
  ];
  const operationItems: CostBreakdownItem[] = [
    {
      name: "Operasyon (hazırlık + paketleme + kargo)",
      formula: "snapshot",
      amount: item.baseCost * 0.3,
    },
  ];

  const intendedProfit = item.intendedProfit;
  const actualProfit = item.actualProfit;
  const subtotal = item.total / (1 + item.vatPct / 100);
  const tieredPure = item.baseCost + actualProfit;
  const preTierSubtotal = item.baseCost + intendedProfit;

  return {
    productionItems,
    productionCost: productionItems.reduce((s, i) => s + i.amount, 0),
    operationItems,
    operationCost: operationItems.reduce((s, i) => s + i.amount, 0),
    baseCost: item.baseCost,
    intendedProfit,
    profit: intendedProfit, // legacy alias
    processingFee: subtotal - tieredPure,
    preTierSubtotal,
    tierAdjustment: preTierSubtotal * (item.tierMultiplier - 1),
    tierMultiplier: item.tierMultiplier,
    subtotal,
    vatAmount: item.vatAmount,
    total: item.total,
    unitPrice: item.unitPrice,
    envelopeCount: item.rollsNeeded,
    actualProfit,
    actualMarkupPct:
      item.baseCost > 0 ? (actualProfit / item.baseCost) * 100 : 0,
  };
}
