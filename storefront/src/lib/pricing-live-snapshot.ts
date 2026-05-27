/**
 * Live config fiyat sonucunu operatör PDF/sepet/istatistik CostResult'a çevirir.
 */

import type { PriceCalcOk } from "./pricing-calc";
import type { CostResult } from "./pricing-engine";

export function livePriceToCostResult(price: PriceCalcOk): CostResult {
  const profit = price.with_margin - price.cost_total;
  const fee = price.with_fee - price.with_margin;
  const vat = price.final - price.with_fee;
  const materialCost = price.cost_total - price.operation_cost;
  const profitPct =
    price.cost_total > 0 ? (profit / price.cost_total) * 100 : 0;

  return {
    productionItems: [
      {
        name: `Malzeme (Alış) · ${price.material.name}`,
        formula: "m2_cost_try × billable m²",
        amount: materialCost,
      },
    ],
    productionCost: materialCost,
    operationItems:
      price.operation_cost > 0
        ? [
            {
              name: "Operasyon",
              formula: "setup + paketleme × adet",
              amount: price.operation_cost,
            },
          ]
        : [],
    operationCost: price.operation_cost,
    baseCost: price.cost_total,
    intendedProfit: profit,
    profit,
    processingFee: fee,
    preTierSubtotal: price.with_margin,
    tierAdjustment: 0,
    tierMultiplier: price.tier.multiplier,
    subtotal: price.with_fee,
    vatAmount: vat,
    total: price.final,
    unitPrice: price.unit_price,
    envelopeCount: 1,
    actualProfit: profit,
    actualMarkupPct: profitPct,
  };
}
