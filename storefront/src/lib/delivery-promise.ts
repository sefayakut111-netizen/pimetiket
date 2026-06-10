/**
 * Teslim taahhüdü — tek kaynak (sticker / etiket aralıkları + prova notu).
 */

export type DeliveryProduct = "sticker" | "etiket";

export const DELIVERY_PROMISE: Record<DeliveryProduct, string> = {
  sticker: "5-7 iş günü",
  etiket: "8-12 iş günü",
};

export const DELIVERY_PROMISE_NOTE =
  "Prova onayından sonra üretim başlar.";

export function getDeliveryPromise(product: DeliveryProduct): string {
  return DELIVERY_PROMISE[product];
}

/** Karışık sepette en uzun süre (etiket öncelikli). */
export function getDeliveryPromiseForCart(
  items: ReadonlyArray<{ product: string }>
): string {
  if (items.some((i) => i.product === "etiket")) {
    return DELIVERY_PROMISE.etiket;
  }
  return DELIVERY_PROMISE.sticker;
}
