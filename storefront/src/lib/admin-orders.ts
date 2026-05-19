/**
 * Admin tarafı sipariş veri kaynağı.
 *
 * Sefa 19 May v68 (admin dashboard fix):
 * `listCustomerOrders()` user-bazlı (kendi user_id'siyle filtreli) —
 * admin login bile olsa SADECE kendi siparişlerini görür. Tüm siparişler
 * için bu helper `/api/admin/orders/list` endpoint'ini çağırır
 * (assertAdmin + RLS bypass).
 *
 * Kullanım:
 *   const orders = await fetchAllOrdersForAdmin();
 *   setOrders(orders);
 */

import type { CustomerOrder } from "./customer-order";

export interface FetchAllOrdersOptions {
  limit?: number;
  status?: string[]; // örn: ["proof_pending", "in_production"]
  signal?: AbortSignal;
}

export async function fetchAllOrdersForAdmin(
  opts: FetchAllOrdersOptions = {}
): Promise<CustomerOrder[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.status && opts.status.length > 0) {
    params.set("status", opts.status.join(","));
  }
  const qs = params.toString();
  const url = `/api/admin/orders/list${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: opts.signal,
    });
    if (!res.ok) {
      console.error("[admin-orders] fetch failed:", res.status);
      return [];
    }
    const data = (await res.json()) as { orders?: CustomerOrder[] };
    return data.orders ?? [];
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return [];
    console.error("[admin-orders] fetch exception:", err);
    return [];
  }
}
