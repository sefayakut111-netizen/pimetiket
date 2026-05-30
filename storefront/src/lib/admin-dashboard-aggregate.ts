/**
 * Dashboard aggregate — client fetch helper.
 */

import type {
  InsightItem,
  OperationalMetrics,
  ProductMix,
  ProofFlowStats30d,
  StatusCount,
  TopCity,
  TopCustomer,
} from "@/lib/admin-analytics";
import {
  dashboardRangeQueryParams,
  type DashboardTimeRange,
} from "@/lib/admin-dashboard-range";

export interface DashboardAggregateData {
  ok?: boolean;
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

export async function fetchDashboardAggregate(
  range: DashboardTimeRange,
  customFrom?: string,
  customTo?: string
): Promise<DashboardAggregateData | null> {
  const qs = dashboardRangeQueryParams(range, customFrom, customTo);
  const res = await fetch(`/api/admin/dashboard-aggregate?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as DashboardAggregateData & { ok?: boolean };
  if (json.ok === false) return null;
  return json;
}
