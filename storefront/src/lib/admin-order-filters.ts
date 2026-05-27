/**
 * Admin dashboard — test siparişlerini prod metriklerinden ayır.
 */

import type { CustomerOrder } from "./customer-order";

/** Simülatör / QA siparişleri — ciro ve top müşteri metriklerine dahil edilmez. */
export function isTestOrder(order: CustomerOrder): boolean {
  const name = (order.address?.name ?? "").toLowerCase();
  const id = order.id.toLowerCase();
  return (
    name.includes("test") ||
    id.includes("test") ||
    order.id === "00000001"
  );
}

export function excludeTestOrders(orders: CustomerOrder[]): CustomerOrder[] {
  return orders.filter((o) => !isTestOrder(o));
}
