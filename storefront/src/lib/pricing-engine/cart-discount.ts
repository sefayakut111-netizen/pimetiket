/**
 * Sticker pricing — sepet grup indirimi (saf fonksiyon).
 *
 * Kaynak: docs/PRICING_SPEC.md §6
 * Modül: sticker-fiyatlama.html v0.3 — `getGroupDiscount`, `computeCart`
 *
 * Mantık:
 *   - Aynı boyutta (W×H) birden çok tasarım = grup
 *   - Grup büyüdükçe indirim oranı artar (max %10)
 *   - İndirim her tasarıma KDV dahil tek tasarım fiyatından uygulanır
 */

import { GROUP_DISCOUNT_TIERS } from "./constants";

// ============================================================
// Types
// ============================================================

export interface CartLineInput {
  /** Sepet line ID (UI tracking için) */
  id: string;
  /** Sticker boyutları (mm) */
  width: number;
  height: number;
  /** Müşteri talep adedi */
  requestedQty: number;
  /** Tek tasarımın KDV dahil fiyatı (cost.ts → CostResult.total) */
  preGroupTotal: number;
}

export interface CartLineResult extends CartLineInput {
  /** Boyut grubu key'i — "WxH" formatı */
  groupKey: string;
  /** Bu boyut grubundaki tasarım sayısı */
  groupCount: number;
  /** Uygulanan grup indirimi 0-1 */
  groupDiscountPct: number;
  /** Mutlak TL indirim tutarı */
  groupDiscountAmount: number;
  /** İndirim sonrası nihai fiyat (KDV dahil) */
  finalTotal: number;
}

export interface CartGroup {
  width: number;
  height: number;
  count: number;
  discountPct: number;
  /** Grupta toplam line sayısı */
  items: CartLineInput[];
}

export interface CartResult {
  /** Her line'ın grup-bilgisi enriched hâli */
  items: CartLineResult[];
  /** Boyut grupları (key = "WxH") */
  groups: Record<string, CartGroup>;
  /** Tüm preGroupTotal'ların toplamı (indirim öncesi) */
  subtotal: number;
  /** Tüm grup indirimleri toplamı (TL) */
  groupDiscountTotal: number;
  /** Sepet nihai toplamı (subtotal - groupDiscountTotal) */
  total: number;
  /** Sepetteki toplam sticker adedi */
  totalStickers: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Grup büyüklüğüne göre indirim oranı bul.
 * En yüksek match'i döndürür (10+ → %10, 6-9 → %8, vs).
 */
export function getGroupDiscount(count: number): number {
  for (const tier of GROUP_DISCOUNT_TIERS) {
    if (count >= tier.minCount) return tier.rate;
  }
  return 0;
}

/**
 * Boyut grup key'i — "WxH" deterministik format.
 */
function groupKeyFor(width: number, height: number): string {
  return `${width}x${height}`;
}

// ============================================================
// Main
// ============================================================

/**
 * Sepetteki tüm line'ları grup indirimleri ile birlikte hesapla.
 *
 * Aynı boyut (W×H) line'lar gruplanır → grup büyüklüğüne göre indirim
 * tüm gruptaki her line'a uygulanır.
 */
export function computeCart(items: CartLineInput[]): CartResult {
  if (items.length === 0) {
    return {
      items: [],
      groups: {},
      subtotal: 0,
      groupDiscountTotal: 0,
      total: 0,
      totalStickers: 0,
    };
  }

  // 1. Boyut bazlı grupla
  const groups: Record<string, CartGroup> = {};
  for (const item of items) {
    const key = groupKeyFor(item.width, item.height);
    if (!groups[key]) {
      groups[key] = {
        width: item.width,
        height: item.height,
        count: 0,
        discountPct: 0,
        items: [],
      };
    }
    groups[key].count++;
    groups[key].items.push(item);
  }

  // 2. Her grubun indirim oranını belirle
  for (const key in groups) {
    groups[key].discountPct = getGroupDiscount(groups[key].count);
  }

  // 3. Her line'a grup bilgisini enrich et
  let subtotal = 0;
  let groupDiscountTotal = 0;
  let totalStickers = 0;
  const enriched: CartLineResult[] = [];

  for (const item of items) {
    const key = groupKeyFor(item.width, item.height);
    const group = groups[key];
    const discountPct = group.discountPct;
    const lineDiscount = item.preGroupTotal * discountPct;
    const finalTotal = item.preGroupTotal - lineDiscount;

    enriched.push({
      ...item,
      groupKey: key,
      groupCount: group.count,
      groupDiscountPct: discountPct,
      groupDiscountAmount: lineDiscount,
      finalTotal,
    });

    subtotal += item.preGroupTotal;
    groupDiscountTotal += lineDiscount;
    totalStickers += item.requestedQty;
  }

  return {
    items: enriched,
    groups,
    subtotal,
    groupDiscountTotal,
    total: subtotal - groupDiscountTotal,
    totalStickers,
  };
}
