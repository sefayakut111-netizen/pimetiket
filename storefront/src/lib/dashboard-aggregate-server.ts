/**
 * Dashboard aggregate — DB'den sipariş çekip admin-analytics ile hesaplar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isTestOrderLike } from "@/lib/admin-order-filters";
import type { CustomerOrder, CustomerOrderAddress } from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";
import {
  aggregateProductMix,
  aggregateStatus,
  buildDailySeries,
  buildHeatmapMatrix,
  generateInsights,
  operationalMetrics,
  proofFlowStatsLast30Days,
  topCities,
  topCustomers,
  type InsightItem,
  type OperationalMetrics,
  type ProductMix,
  type ProofFlowStats30d,
  type StatusCount,
  type TopCity,
  type TopCustomer,
} from "@/lib/admin-analytics";
import type { DashboardRangeWindow } from "@/lib/admin-dashboard-range";

type AdminClient = SupabaseClient<Database>;

type DbOrderRow = {
  id: string;
  status: string;
  total: number | string;
  address: unknown;
  created_at: string;
  estimated_delivery: string | null;
  subtotal: number | string;
  shipping: number | string;
  invoice: unknown;
  payment: unknown;
};

type DbItemRow = {
  id: string;
  order_id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number | string;
  total: number | string;
  meta: unknown;
};

const PAGE_SIZE = 1000;

function parseAddress(raw: unknown): CustomerOrderAddress {
  const a = (raw ?? {}) as Partial<CustomerOrderAddress>;
  return {
    name: a.name ?? "",
    addr: a.addr ?? "",
    city: a.city ?? "",
    phone: a.phone ?? "",
    label: a.label,
  };
}

function rowToCustomerOrder(
  row: DbOrderRow,
  items: DbItemRow[] = []
): CustomerOrder {
  const ts = new Date(row.created_at).getTime();
  return {
    id: row.id,
    status: row.status as OrderStatus,
    items: items.map((i) => ({
      id: i.id,
      product: i.product,
      title: i.title,
      config: i.config,
      width: i.width,
      height: i.height,
      qty: i.qty,
      unit: Number(i.unit),
      total: Number(i.total),
      addedAt: ts,
    })),
    address: parseAddress(row.address),
    invoice: (row.invoice ?? { type: "individual" }) as CustomerOrder["invoice"],
    payment: (row.payment ?? { method: "card" }) as CustomerOrder["payment"],
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    createdAt: ts,
    createdAtIso: row.created_at,
    estimatedDelivery: row.estimated_delivery ?? undefined,
  };
}

async function fetchAllOrderRows(
  admin: AdminClient
): Promise<DbOrderRow[]> {
  const rows: DbOrderRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("orders")
      .select(
        "id, status, total, address, created_at, estimated_delivery, subtotal, shipping, invoice, payment"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DbOrderRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

async function fetchItemsForOrders(
  admin: AdminClient,
  orderIds: string[]
): Promise<Map<string, DbItemRow[]>> {
  const map = new Map<string, DbItemRow[]>();
  if (orderIds.length === 0) return map;

  const chunkSize = 200;
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from("order_items")
      .select(
        "id, order_id, product, title, config, width, height, qty, unit, total, meta"
      )
      .in("order_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as DbItemRow[]) {
      const list = map.get(row.order_id) ?? [];
      list.push(row);
      map.set(row.order_id, list);
    }
  }
  return map;
}

export interface DashboardAggregateResult {
  dailySeries: Array<{ date: string; count: number; revenue: number }>;
  productMix: ProductMix;
  statusDistribution: StatusCount;
  heatmapMatrix: number[][];
  topCustomers: TopCustomer[];
  topCities: TopCity[];
  operationalMetrics: OperationalMetrics;
  proofFlowStats30d: ProofFlowStats30d;
  insights: InsightItem[];
  totalOrderCount: number;
  prevPeriod: { count: number; revenue: number };
}

export async function computeDashboardAggregate(
  admin: AdminClient,
  rangeWindow: DashboardRangeWindow,
  excludeTest: boolean
): Promise<DashboardAggregateResult> {
  const dbRows = await fetchAllOrderRows(admin);
  const filteredRows = excludeTest
    ? dbRows.filter((r) => !isTestOrderLike({ id: r.id, address: r.address as { name?: string } }))
    : dbRows;

  const inRangeIds = filteredRows
    .filter(
      (r) =>
        new Date(r.created_at).getTime() >= rangeWindow.start &&
        (rangeWindow.end === undefined ||
          new Date(r.created_at).getTime() <= rangeWindow.end)
    )
    .map((r) => r.id);

  const itemMap = await fetchItemsForOrders(admin, inRangeIds);

  const orders: CustomerOrder[] = filteredRows.map((r) =>
    rowToCustomerOrder(r, itemMap.get(r.id) ?? [])
  );

  const inRange = orders.filter(
    (o) =>
      o.createdAt >= rangeWindow.start &&
      (rangeWindow.end === undefined || o.createdAt <= rangeWindow.end)
  );

  const inPrevRange = orders.filter(
    (o) =>
      o.createdAt >= rangeWindow.prevStart && o.createdAt < rangeWindow.prevEnd
  );

  const paidPrev = inPrevRange.filter((o) => o.status !== "cancelled");

  const daily = buildDailySeries(orders, rangeWindow.days);

  return {
    dailySeries: daily.map((d) => ({
      date: d.date.toISOString(),
      count: d.count,
      revenue: d.revenue,
    })),
    productMix: aggregateProductMix(inRange),
    statusDistribution: aggregateStatus(orders),
    heatmapMatrix: buildHeatmapMatrix(orders),
    topCustomers: topCustomers(orders, 5),
    topCities: topCities(orders, 5),
    operationalMetrics: operationalMetrics(orders),
    proofFlowStats30d: proofFlowStatsLast30Days(orders),
    insights: generateInsights(orders),
    totalOrderCount: orders.length,
    prevPeriod: {
      count: paidPrev.length,
      revenue: paidPrev.reduce((s, o) => s + o.total, 0),
    },
  };
}
