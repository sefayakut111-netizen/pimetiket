/**
 * Admin dashboard — test siparişlerini prod metriklerinden ayır.
 */

import type { CustomerOrder } from "./customer-order";

export type TestOrderLike = {
  id: string;
  address?: { name?: string } | null;
  customer?: string;
};

/** Simülatör / QA siparişleri — ciro ve top müşteri metriklerine dahil edilmez. */
export function isTestOrderLike(o: TestOrderLike): boolean {
  const name = (o.address?.name ?? o.customer ?? "").toLowerCase();
  const id = o.id.toLowerCase();
  return (
    name.includes("test") ||
    id.includes("test") ||
    o.id === "00000001"
  );
}

export function isTestOrder(order: CustomerOrder): boolean {
  return isTestOrderLike(order);
}

export function excludeTestOrders(orders: CustomerOrder[]): CustomerOrder[] {
  return orders.filter((o) => !isTestOrder(o));
}

export function excludeTestOrderLikes<T extends TestOrderLike>(
  orders: T[]
): T[] {
  return orders.filter((o) => !isTestOrderLike(o));
}

/** Email aboneleri — test/QA kayitlari */
export function isTestSubscriber(email: string): boolean {
  const e = email.toLowerCase();
  return e.includes("+test") || e.includes("test");
}
