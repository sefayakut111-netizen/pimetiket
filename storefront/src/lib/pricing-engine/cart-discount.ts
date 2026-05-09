/**
 * Sticker pricing — sepet grup indirimi (saf fonksiyon).
 *
 * Kaynak: docs/PRICING_SPEC.md §6
 *
 * v0.4 finans denetim düzeltmesi (PRICING_FINANCE_REVIEW.md):
 *   #1 Group discount KDV ÖNCESİ uygulanır (KDV Kanunu m.25/a)
 *      — indirim matrahtan düşer, KDV indirimli matrah üzerinden hesaplanır
 *
 * Mantık:
 *   - Aynı boyutta (W×H) line'lar gruplanır
 *   - Grup büyüklüğü → indirim oranı (max %10)
 *   - İndirim KDV-hariç matraha (subtotal'a) uygulanır
 *   - VAT discounted matrah üzerinden yeniden hesaplanır
 *   - Customer'ın ödediği final = discountedSubtotal × (1 + vat%)
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
  /**
   * Tek tasarımın matrahı (KDV HARİÇ, fee dahil) — `cost.ts → CostResult.subtotal`.
   * v0.4'te `preGroupTotal` (KDV dahil) yerine `preGroupSubtotal` kullanılıyor.
   */
  preGroupSubtotal: number;
  /** KDV oranı (0-100). Genelde 20. */
  vatPct: number;
}

export interface CartLineResult extends CartLineInput {
  /** Boyut grubu key'i — "WxH" formatı */
  groupKey: string;
  /** Bu boyut grubundaki tasarım sayısı */
  groupCount: number;
  /** Uygulanan grup indirimi 0-1 */
  groupDiscountPct: number;
  /** Mutlak TL indirim — KDV-hariç matrah üzerinden */
  groupDiscountAmount: number;
  /** İndirim sonrası matrah (KDV hariç) */
  finalSubtotal: number;
  /** İndirim sonrası VAT (yeniden hesaplandı) */
  finalVat: number;
  /** Müşterinin ödediği final tutar (KDV dahil) */
  finalTotal: number;
  /** Reference: indirim öncesi VAT (matrah × vatPct) */
  preGroupVat: number;
  /** Reference: indirim öncesi total (matrah + VAT) */
  preGroupTotal: number;
}

export interface CartGroup {
  width: number;
  height: number;
  count: number;
  discountPct: number;
  items: CartLineInput[];
}

export interface CartResult {
  items: CartLineResult[];
  groups: Record<string, CartGroup>;
  /** Tüm preGroupSubtotal toplamı (indirim öncesi matrah) */
  subtotalBeforeDiscount: number;
  /** Toplam grup indirimi (KDV-hariç matrah üzerinden) */
  groupDiscountTotal: number;
  /** İndirim sonrası matrah toplamı */
  subtotalAfterDiscount: number;
  /** Geriye uyum: subtotalAfterDiscount alias */
  subtotal: number;
  /** Toplam VAT (discounted matraha göre) */
  vatTotal: number;
  /** Sepet nihai toplamı (KDV dahil) */
  total: number;
  /** Sepetteki toplam sticker adedi */
  totalStickers: number;
}

// ============================================================
// Helpers
// ============================================================

export function getGroupDiscount(count: number): number {
  for (const tier of GROUP_DISCOUNT_TIERS) {
    if (count >= tier.minCount) return tier.rate;
  }
  return 0;
}

function groupKeyFor(width: number, height: number): string {
  return `${width}x${height}`;
}

// ============================================================
// Main
// ============================================================

export function computeCart(items: CartLineInput[]): CartResult {
  if (items.length === 0) {
    return {
      items: [],
      groups: {},
      subtotalBeforeDiscount: 0,
      groupDiscountTotal: 0,
      subtotalAfterDiscount: 0,
      subtotal: 0,
      vatTotal: 0,
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

  // 2. Her grubun indirim oranı
  for (const key in groups) {
    groups[key].discountPct = getGroupDiscount(groups[key].count);
  }

  // 3. Her line'da indirim KDV-hariç matraha uygulanır
  let subtotalBefore = 0;
  let discountTotal = 0;
  let subtotalAfter = 0;
  let vatTotal = 0;
  let totalStickers = 0;
  const enriched: CartLineResult[] = [];

  for (const item of items) {
    const key = groupKeyFor(item.width, item.height);
    const group = groups[key];
    const discountPct = group.discountPct;

    // KDV ÖNCESİ indirim — KDV mevzuatı m.25/a
    const lineDiscount = item.preGroupSubtotal * discountPct;
    const finalSubtotal = item.preGroupSubtotal - lineDiscount;

    // VAT discounted matrah üzerinden yeniden hesap
    const finalVat = finalSubtotal * (item.vatPct / 100);
    const finalTotal = finalSubtotal + finalVat;

    // Reference (indirim öncesi — gösterim için)
    const preGroupVat = item.preGroupSubtotal * (item.vatPct / 100);
    const preGroupTotal = item.preGroupSubtotal + preGroupVat;

    enriched.push({
      ...item,
      groupKey: key,
      groupCount: group.count,
      groupDiscountPct: discountPct,
      groupDiscountAmount: lineDiscount,
      finalSubtotal,
      finalVat,
      finalTotal,
      preGroupVat,
      preGroupTotal,
    });

    subtotalBefore += item.preGroupSubtotal;
    discountTotal += lineDiscount;
    subtotalAfter += finalSubtotal;
    vatTotal += finalVat;
    totalStickers += item.requestedQty;
  }

  return {
    items: enriched,
    groups,
    subtotalBeforeDiscount: subtotalBefore,
    groupDiscountTotal: discountTotal,
    subtotalAfterDiscount: subtotalAfter,
    subtotal: subtotalAfter,
    vatTotal,
    total: subtotalAfter + vatTotal,
    totalStickers,
  };
}
