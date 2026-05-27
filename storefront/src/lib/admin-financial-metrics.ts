/**
 * Admin finans metrikleri — Dashboard, Finans ve Ödemeler aynı kaynaktan okur.
 * Kaynak: GET /api/admin/financials/summary
 */

export type FinancialRangeKey = "today" | "7d" | "mtd" | "30d" | "all" | "custom";

export interface FinancialSummary {
  ok?: boolean;
  range: string;
  grossOrderTotal: number;
  collectedTotal: number;
  cancelledOrderTotal: number;
  pendingTotal: number;
  refundedTotal: number;
  gap: number;
  orderCount: number;
  paymentCount: number;
}

export type DashboardTimeRange = "today" | "7d" | "mtd" | "30d" | "custom";

export function dashboardRangeToFinancialParams(
  range: DashboardTimeRange,
  customFrom?: string,
  customTo?: string
): { range: FinancialRangeKey; from?: string; to?: string } {
  if (range === "today") return { range: "today" };
  if (range === "7d") return { range: "7d" };
  if (range === "mtd") return { range: "mtd" };
  if (range === "30d") return { range: "30d" };
  if (range === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    return {
      range: "custom",
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
  return { range: "7d" };
}

export async function fetchFinancialSummary(
  params: {
    range: FinancialRangeKey;
    from?: string;
    to?: string;
    excludeTest?: boolean;
  }
): Promise<FinancialSummary | null> {
  const qs = new URLSearchParams({ range: params.range });
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.excludeTest) qs.set("excludeTest", "1");

  const res = await fetch(`/api/admin/financials/summary?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as FinancialSummary;
  if (json.ok === false) return null;
  return json;
}
