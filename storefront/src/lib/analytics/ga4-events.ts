/**
 * GA4 e-commerce event helper — consent-aware, no-op when gtag yok.
 */

import { hasConsent } from "@/lib/cookie-consent";

function ga4Event(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics")) return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag !== "function") return;
  w.gtag("event", name, params);
}

export function ga4ViewItem(product: string, price = 0): void {
  ga4Event("view_item", {
    currency: "TRY",
    value: price,
    items: [{ item_id: product, item_name: product }],
  });
}

export function ga4AddToCart(
  product: string,
  qty: number,
  price: number
): void {
  ga4Event("add_to_cart", {
    currency: "TRY",
    value: price,
    items: [
      {
        item_id: product,
        item_name: product,
        quantity: qty,
        price: qty > 0 ? price / qty : price,
      },
    ],
  });
}

export function ga4BeginCheckout(total: number, itemCount: number): void {
  ga4Event("begin_checkout", {
    currency: "TRY",
    value: total,
    items: [{ item_name: "order", quantity: itemCount }],
  });
}

export function ga4Purchase(
  orderId: string,
  total: number,
  items?: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    price: number;
  }>
): void {
  ga4Event("purchase", {
    transaction_id: orderId,
    currency: "TRY",
    value: total,
    ...(items && items.length > 0 ? { items } : {}),
  });
}
