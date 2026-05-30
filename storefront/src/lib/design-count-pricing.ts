/**
 * Çoklu tasarım fiyatı — konfigüratör ve payment-validation tek kaynak.
 *
 * Konfigüratör: quote(perDesignQty) → unit × designCount × iskonto → quantizeForCart
 * Server recalc aynı formülü kullanır (undercharge / false reject önleme).
 */

import { quantizeForCart } from "./pricing-quantize";

/** Tasarım sayısı iskonto tablosu — etiket + sticker ile birebir. */
export function designCountDiscountPct(n: number): number {
  if (n >= 26) return 10;
  if (n >= 11) return 8;
  if (n >= 6) return 6;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 0;
}

export function resolveDesignCount(item: {
  meta?: Record<string, unknown> | null;
  designCount?: number | null;
}): number {
  const fromMeta = item.meta?.designCount;
  if (typeof fromMeta === "number" && fromMeta >= 1) {
    return Math.round(fromMeta);
  }
  if (typeof item.designCount === "number" && item.designCount >= 1) {
    return Math.round(item.designCount);
  }
  return 1;
}

/** Toplam adetten tasarım başına tier adedi. */
export function perDesignQty(totalQty: number, designCount: number): number {
  const dc = Math.max(1, designCount);
  return Math.round(totalQty / dc);
}

/**
 * Tek tasarım birim fiyatından sepet satırı unit/total (quantizeForCart ile).
 */
export function expectedCartLineFromPerDesignQuote(
  perDesignUnitPrice: number,
  totalQty: number,
  designCount: number
): { unit: number; total: number } {
  const dc = Math.max(1, designCount);
  const factor = 1 - designCountDiscountPct(dc) / 100;
  const rawUnit = perDesignUnitPrice * factor;
  return quantizeForCart(rawUnit, totalQty);
}
