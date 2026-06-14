/**
 * Teslim taahhüdü — tek kaynak (üretim süresi + prova notu).
 *
 * Üretim iş günü sayıları KANONİK kaynaktan gelir:
 *   src/lib/pim/site-facts.ts → PIM_PRODUCTION_BUSINESS_DAYS
 *   (sticker 3 · tabaka etiket 5 · rulo etiket 10 — tasarım onayı → kargoya verme)
 *
 * İŞ GÜNÜ (hafta sonu + resmi tatil hariç). Eski "5-7"/"8-12" aralıkları
 * KALDIRILDI — tek-kaynak tutarlılığı (Sefa kararı).
 */

import { PIM_PRODUCTION_BUSINESS_DAYS } from "@/lib/pim/site-facts";

export type DeliveryProduct = "sticker" | "etiket";
export type DeliveryFormFactor = "tabaka" | "rulo";

export const DELIVERY_PROMISE_NOTE = "Prova onayından sonra üretim başlar.";

/**
 * Tek ürün için üretim taahhüdü (iş günü).
 *
 * sticker → 3 iş günü
 * etiket  → formFactor "tabaka" ? 5 : "rulo" ? 10 : GÜVENLİ ÜST SINIR 10
 *           (formFactor bilinmiyorsa en uzun süreyi vaat et — eksik vaat yerine
 *            güvenli tarafta kal).
 */
export function getDeliveryPromise(
  product: DeliveryProduct,
  formFactor?: DeliveryFormFactor
): string {
  const days = productionDaysFor(product, formFactor);
  return `${days} iş günü`;
}

/** Ürün + formFactor → üretim iş günü sayısı (kanonik kaynaktan). */
export function productionDaysFor(
  product: DeliveryProduct,
  formFactor?: DeliveryFormFactor
): number {
  if (product === "sticker") return PIM_PRODUCTION_BUSINESS_DAYS.sticker;
  if (formFactor === "tabaka") return PIM_PRODUCTION_BUSINESS_DAYS.tabaka;
  if (formFactor === "rulo") return PIM_PRODUCTION_BUSINESS_DAYS.rulo;
  // Etiket ama formFactor bilinmiyor → güvenli üst sınır (rulo = en uzun).
  return PIM_PRODUCTION_BUSINESS_DAYS.rulo;
}

/** Sepetteki bir kalemin formFactor'unu meta'dan oku (etiket: tabaka/rulo). */
function cartItemFormFactor(item: {
  product: string;
  meta?: Record<string, unknown> | null;
}): DeliveryFormFactor | undefined {
  const ff = item.meta?.formFactor;
  if (ff === "tabaka" || ff === "rulo") return ff;
  return undefined;
}

/**
 * Karışık sepette EN UZUN üretim süresi (rulo 10 > tabaka 5 > sticker 3).
 *
 * Etiket kalemlerinin tabaka/rulo ayrımı cart item `meta.formFactor`'undan
 * okunur (etiket konfigüratörü buraya yazar). meta yoksa etiket için güvenli
 * üst sınır (rulo = 10) kullanılır.
 */
export function getDeliveryPromiseForCart(
  items: ReadonlyArray<{
    product: string;
    meta?: Record<string, unknown> | null;
  }>
): string {
  let maxDays = 0;
  for (const item of items) {
    if (item.product === "etiket") {
      maxDays = Math.max(
        maxDays,
        productionDaysFor("etiket", cartItemFormFactor(item))
      );
    } else {
      // sticker (veya bilinmeyen → sticker gibi davran)
      maxDays = Math.max(maxDays, PIM_PRODUCTION_BUSINESS_DAYS.sticker);
    }
  }
  if (maxDays === 0) maxDays = PIM_PRODUCTION_BUSINESS_DAYS.sticker;
  return `${maxDays} iş günü`;
}
