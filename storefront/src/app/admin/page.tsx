/**
 * Pim Etiket — /admin (E.3 Dashboard 3.0 — Detaylı)
 *
 * Operatör/admin ana panel — tam veri zengini dashboard.
 *
 * Bölümler (sırasıyla):
 *   1. Header + time range toggle + last update
 *   2. Hero alert strip (SLA aşan / kuyrukta bekleyen)
 *   3. KPI grid 6 kart (ciro, AOV, sipariş, AI flag, prova, üretime) + trend
 *   4. Ciro trendi line chart + Ürün karışımı donut (yan yana)
 *   5. Üretim funnel (7 adım)
 *   6. Operasyonel metrikler 4 kart (AI flag rate, tamamlanma, iptal, prova yanıt)
 *   7. AI insights kartı + Hızlı aksiyonlar
 *   8. Saatlik heatmap (24x7)
 *   9. Top 5 müşteri + Top 5 şehir tabloları
 *  10. Son siparişler + Durum dağılımı (yatay bar)
 *
 * Veri kuralı: gerçek sipariş yokken "—" / "0" / "Veri yok" gösterir.
 */

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { StatusDot, type DotColor } from "@/components/admin/ui";
import { Card } from "@/components/ui";
import { LineChart, DonutChart, BarChart, HeatMap } from "@/components/charts";
import type { LinePoint, BarPoint } from "@/components/charts";
import { cn } from "@/lib/cn";
import type { CustomerOrder } from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";
import {
  AI_QC_ACTIVE_STATUSES,
  UNASSIGNED_PRODUCTION_STATUSES,
  adminOrdersListHref,
} from "@/lib/order";
import {
  formatHours,
  formatCurrency,
  formatShortDate,
  type ProductMix,
  type StatusCount,
  type OperationalMetrics,
  type ProofFlowStats30d,
  type InsightItem,
} from "@/lib/admin-analytics";
import {
  getDashboardRangeWindow,
  type DashboardTimeRange,
} from "@/lib/admin-dashboard-range";
import {
  fetchDashboardAggregate,
  type DashboardAggregateData,
} from "@/lib/admin-dashboard-aggregate";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { getAdminModuleLabel } from "@/lib/admin-rbac";
import { getAdminStatusMeta } from "@/lib/admin-status";
import { excludeTestOrders } from "@/lib/admin-order-filters";
import {
  dashboardRangeToFinancialParams,
  fetchFinancialSummary,
  type FinancialSummary,
} from "@/lib/admin-financial-metrics";

type TimeRange = DashboardTimeRange;

const EMPTY_PRODUCT_MIX: ProductMix = {
  etiket: 0,
  sticker: 0,
  etiketRevenue: 0,
  stickerRevenue: 0,
};

const EMPTY_OPS: OperationalMetrics = {
  aiFlagRate: 0,
  cancelRate: 0,
  avgFulfillmentHours: null,
  avgProofResponseHours: null,
};

const EMPTY_PROOF_STATS: ProofFlowStats30d = {
  approved: 0,
  cancelled: 0,
  total: 0,
  cancelRate: 0,
};

const EMPTY_HEATMAP = Array.from({ length: 7 }, () =>
  Array.from({ length: 24 }, () => 0)
);

const RANGE_LABEL: Record<TimeRange, string> = {
  today: "Bugün",
  "7d": "7 gün",
  mtd: "Bu ay",
  "30d": "30 gün",
  custom: "Özel",
};

interface TodoItem {
  id: string;
  /** Sıra: küçük olan üstte. AI flag (1) > Operatör (2) > Prova geç yanıt (3)
   * > Fason atama (4) > Kargoya verilecek (5) > Yorum onayı (6) */
  priority: number;
  iconKey: IconName;
  title: string;
  count: number;
  hint: string;
  href: string;
  urgent: boolean;
}

function formatProofWaitDuration(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} gün`;
  }
  return `${Math.floor(hours)} saat`;
}

function buildTodoList(
  orders: CustomerOrder[],
  stuckDesignCount = 0
): TodoItem[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const items: TodoItem[] = [];

  if (stuckDesignCount > 0) {
    items.push({
      id: "stuck-designs",
      priority: 1,
      iconKey: "Sparkle",
      title: "Tasarim dosyasi takili (analyzing)",
      count: stuckDesignCount,
      hint: "AI analizi 1 saatten uzun surdu — Tasarimlar sayfasindan onar",
      href: "/admin/tasarimlar",
      urgent: true,
    });
  }

  const aiQueue = orders.filter(
    (o) =>
      (AI_QC_ACTIVE_STATUSES as readonly string[]).includes(o.status) &&
      o.status !== "operator_review"
  ).length;
  if (aiQueue > 0) {
    items.push({
      id: "ai-queue",
      priority: 2,
      iconKey: "Sparkle",
      title: "AI / operatör incelemesi",
      count: aiQueue,
      hint: "Tasarım kontrolü veya prova üretimi bekliyor",
      href: "/admin/ai-qc",
      urgent: aiQueue > 3,
    });
  }

  const operatorReview = orders.filter(
    (o) => o.status === "operator_review"
  ).length;
  if (operatorReview > 0) {
    items.push({
      id: "operator-review",
      priority: 3,
      iconKey: "Eye",
      title: "Operatör incelemesi",
      count: operatorReview,
      hint: "Tasarımı incele, prova hazırla",
      href: "/admin/siparisler?status=operator_review",
      urgent: false,
    });
  }

  const stuckProofOrders = orders.filter(
    (o) => o.status === "proof_pending" && now - o.createdAt > 1.5 * day
  );
  const stuckProof = stuckProofOrders.length;
  if (stuckProof > 0) {
    const oldestWaitHours = Math.max(
      ...stuckProofOrders.map((o) => (now - o.createdAt) / 3600000)
    );
    items.push({
      id: "stuck-proof",
      priority: 3,
      iconKey: "Info",
      title: `Prova yanıtı yok · ${stuckProof} sipariş (en eski: ${formatProofWaitDuration(oldestWaitHours)})`,
      count: stuckProof,
      hint: "WhatsApp veya e-posta ile hatırlat",
      href: "/admin/prova",
      urgent: true,
    });
  }

  const unassigned = countByStatuses(orders, UNASSIGNED_PRODUCTION_STATUSES);
  if (unassigned > 0) {
    items.push({
      id: "unassigned",
      priority: 4,
      iconKey: "Package",
      title: "Partnere atanacak",
      count: unassigned,
      hint: "Üretime hazır siparişleri partnere ata",
      href: adminOrdersListHref(UNASSIGNED_PRODUCTION_STATUSES),
      urgent: unassigned > 0,
    });
  }

  // Bugün kargoya verilecek: üretimde + tahmini teslim bugün veya geçmiş
  const inProductionTotal = orders.filter((o) => o.status === "in_production")
    .length;
  const toShipOrders = orders.filter((o) => {
    if (o.status !== "in_production" || !o.estimatedDelivery) return false;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return new Date(o.estimatedDelivery).getTime() <= todayEnd.getTime();
  });
  if (toShipOrders.length > 0) {
    items.push({
      id: "to-ship",
      priority: 5,
      iconKey: "Box",
      title: "Bugün kargoya verilecek",
      count: toShipOrders.length,
      hint:
        inProductionTotal > toShipOrders.length
          ? `Tahmini teslim bugün/geçmiş (${inProductionTotal} üretimde toplam — hepsi değil)`
          : "Tahmini teslim tarihi bugün veya geçmiş üretimdeki siparişler",
      href: "/admin/siparisler?status=in_production",
      urgent: toShipOrders.length > 0,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

function countByStatuses(
  orders: CustomerOrder[],
  statuses: readonly OrderStatus[]
): number {
  const set = new Set<string>(statuses);
  return orders.filter((o) => set.has(o.status)).length;
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(timestamp).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function formatChange(curr: number, prev: number): { label: string; trend: "up" | "down" | "flat" } {
  if (prev === 0 && curr === 0) return { label: "—", trend: "flat" };
  if (prev === 0) return { label: "yeni", trend: "up" };
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { label: "≈ aynı", trend: "flat" };
  const sign = pct > 0 ? "+" : "";
  return {
    label: `${sign}${pct.toFixed(0)}%`,
    trend: pct > 0 ? "up" : "down",
  };
}

interface CustomerStats {
  total: number;
  weekNew: number;
  monthNew: number;
  todayNew: number;
}

interface FunnelMetric {
  avgSeconds: number;
  sampleCount: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sn`;
  const min = seconds / 60;
  if (min < 60) return `${Math.round(min)}dk`;
  const hr = min / 60;
  if (hr < 48) return `${hr.toFixed(1)}sa`;
  const day = hr / 24;
  return `${day.toFixed(1)}g`;
}

function aggregateFunnelMetric(
  metrics: Record<string, FunnelMetric>,
  statuses: readonly OrderStatus[]
): FunnelMetric | null {
  let weightedSum = 0;
  let totalSamples = 0;
  for (const s of statuses) {
    const m = metrics[s];
    if (m && m.sampleCount > 0) {
      weightedSum += m.avgSeconds * m.sampleCount;
      totalSamples += m.sampleCount;
    }
  }
  if (totalSamples === 0) return null;
  return { avgSeconds: weightedSum / totalSamples, sampleCount: totalSamples };
}

interface SystemHealth {
  crons: {
    total: number;
    healthy: number;
    error: number;
    lastError?: string;
    failures?: Array<{ name: string; label: string; error?: string }>;
  };
  mail: { status: "ok" | "error"; sent24h: number; bounce: number };
  db: { status: "ok" | "error" };
  customers?: { status: "ok" | "error" };
}

interface PartnerProductionRow {
  name: string;
  activeCount: number;
  overdueCount: number;
}

interface ActivityFeedEvent {
  type: string;
  summary: string;
  createdAt: string;
  orderId: string;
  actorName: string | null;
}

type EventIndicator = { dot?: DotColor; icon?: IconName };

const EVENT_INDICATOR: Record<string, EventIndicator> = {
  paid: { dot: "yesil" },
  design_uploaded: { icon: "Doc" },
  proof_approved: { icon: "Check" },
  fason_assigned: { icon: "Package" },
  shipped: { icon: "Truck" },
  delivered: { dot: "yesil" },
  cancelled: { icon: "X" },
  refund: { icon: "Wallet" },
  user_registered: { icon: "User" },
  review_submitted: { icon: "Star" },
};

function EventIndicatorIcon({ indicator }: { indicator: EventIndicator }) {
  if (indicator.dot) {
    return <StatusDot color={indicator.dot} className="mt-1.5" />;
  }
  if (indicator.icon) {
    const I = Icon[indicator.icon];
    return <I size={14} className="shrink-0 mt-0.5" />;
  }
  return <StatusDot color="gri" className="mt-1.5" />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-56px)]" />}>
      <AdminDashboardPageInner />
    </Suspense>
  );
}

function AdminDashboardPageInner() {
  const searchParams = useSearchParams();
  const deniedModule = searchParams.get("denied");
  const {
    canViewFinancials,
    canView,
    loading: permLoading,
  } = useAdminPermissions();
  const canViewOrders = canView("orders");
  const canViewCustomers = canView("customers");
  const canViewAuditors = canView("auditors");
  const canViewSettings = canView("settings");
  const canViewFason = canView("fason");
  const canViewDesigns = canView("designs");
  const canViewReviews = canView("reviews");
  const showFinancials = !permLoading && canViewFinancials;
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [range, setRange] = useState<TimeRange>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [funnelError, setFunnelError] = useState(false);
  const [auditorError, setAuditorError] = useState(false);
  const [funnelMetrics, setFunnelMetrics] = useState<Record<string, FunnelMetric>>({});
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [partnerProduction, setPartnerProduction] = useState<{
    partners: PartnerProductionRow[];
    totals: { active: number; overdue: number };
  } | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEvent[]>([]);
  const [auditorPending, setAuditorPending] = useState<{
    critical: number;
    warning: number;
    total: number;
  }>({ critical: 0, warning: 0, total: 0 });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersTruncated, setOrdersTruncated] = useState(false);
  const [financialSummary, setFinancialSummary] =
    useState<FinancialSummary | null>(null);
  const [todayFinancial, setTodayFinancial] =
    useState<FinancialSummary | null>(null);
  const [stuckDesignCount, setStuckDesignCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [aggregate, setAggregate] = useState<DashboardAggregateData | null>(
    null
  );
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateError, setAggregateError] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!canViewOrders) {
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError(null);
      setOrdersTruncated(false);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetch("/api/admin/orders/list?limit=500", {
        cache: "no-store",
      });
      if (!res.ok) {
        setOrdersError(
          res.status === 403
            ? "Sipariş listesine erişim yetkiniz yok."
            : `Sipariş listesi yüklenemedi (HTTP ${res.status})`
        );
        setOrders([]);
        setOrdersTruncated(false);
        return;
      }
      const data = (await res.json()) as { orders?: CustomerOrder[] };
      const list = data.orders ?? [];
      setOrders(list);
      setOrdersTruncated(list.length >= 500);
      setLastUpdate(Date.now());
    } catch {
      setOrdersError("Bağlantı hatası — sipariş listesi alınamadı.");
      setOrders([]);
      setOrdersTruncated(false);
    } finally {
      setOrdersLoading(false);
    }
  }, [canViewOrders]);

  useEffect(() => {
    if (permLoading) return;

    void loadOrders();
    setNow(new Date());

    if (canViewCustomers) {
      fetch("/api/admin/customer-stats")
        .then((r) => {
          if (!r.ok) {
            setStatsError(true);
            return null;
          }
          setStatsError(false);
          return r.json();
        })
        .then((data: CustomerStats | null) => data && setCustomerStats(data))
        .catch(() => setStatsError(true));
    } else {
      setCustomerStats(null);
      setStatsError(false);
    }

    if (canViewAuditors) {
      fetch("/api/admin/auditors")
        .then((r) => {
          if (!r.ok) {
            setAuditorError(true);
            return null;
          }
          setAuditorError(false);
          return r.json();
        })
        .then(
          (data: {
            ok?: boolean;
            pending?: {
              criticalPending: number;
              warningPending: number;
              totalPending: number;
            };
          } | null) => {
            if (data?.ok && data.pending) {
              setAuditorPending({
                critical: data.pending.criticalPending,
                warning: data.pending.warningPending,
                total: data.pending.totalPending,
              });
            }
          }
        )
        .catch(() => setAuditorError(true));
    } else {
      setAuditorError(false);
    }

    if (canViewSettings) {
      fetch("/api/admin/system-health")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ok?: boolean; crons?: SystemHealth["crons"]; mail?: SystemHealth["mail"]; db?: SystemHealth["db"]; customers?: SystemHealth["customers"] } | null) => {
          if (data?.ok && data.crons && data.mail && data.db) {
            setSystemHealth({
              crons: data.crons,
              mail: data.mail,
              db: data.db,
              customers: data.customers,
            });
          }
        })
        .catch(() => {
          /* opsiyonel strip */
        });
    }

    if (canViewFason) {
      fetch("/api/admin/partner-production-summary")
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: {
            ok?: boolean;
            partners?: PartnerProductionRow[];
            totals?: { active: number; overdue: number };
          } | null) => {
            if (data?.ok && data.partners && data.totals) {
              setPartnerProduction({
                partners: data.partners,
                totals: data.totals,
              });
            }
          }
        )
        .catch(() => {
          /* sessiz */
        });
    }

    if (canViewOrders) {
      fetch("/api/admin/activity-feed?hours=24&limit=15")
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (data: { ok?: boolean; events?: ActivityFeedEvent[] } | null) => {
            if (data?.ok && data.events) setActivityFeed(data.events);
          }
        )
        .catch(() => {
          /* sessiz */
        });
    }

    if (canViewReviews) {
      fetch("/api/admin/reviews", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { reviews?: Array<{ status?: string }> } | null) => {
          const pending = (json?.reviews ?? []).filter(
            (r) => r.status === "pending"
          ).length;
          setPendingReviews(pending);
        })
        .catch(() => {
          /* sessiz */
        });
    }

    if (canViewDesigns) {
      fetch("/api/admin/designs/repair-stuck", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { stuckCount?: number } | null) => {
          setStuckDesignCount(json?.stuckCount ?? 0);
        })
        .catch(() => {
          /* sessiz */
        });
    }

    const w = globalThis.window;
    const refresh = () => void loadOrders();
    w.addEventListener("pim_customer_orders_updated", refresh);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      w.removeEventListener("pim_customer_orders_updated", refresh);
      clearInterval(tick);
    };
  }, [permLoading, loadOrders, canViewCustomers, canViewAuditors, canViewSettings, canViewFason, canViewOrders, canViewDesigns, canViewReviews]);

  useEffect(() => {
    if (!showFinancials) {
      setFinancialSummary(null);
      setTodayFinancial(null);
      return;
    }
    const params = dashboardRangeToFinancialParams(range, customFrom, customTo);
    void fetchFinancialSummary({
      range: params.range,
      from: params.from,
      to: params.to,
      excludeTest: true,
    }).then(setFinancialSummary);
    void fetchFinancialSummary({
      range: "today",
      excludeTest: true,
    }).then(setTodayFinancial);
  }, [showFinancials, range, customFrom, customTo]);

  useEffect(() => {
    if (permLoading || !canViewOrders) {
      setAggregate(null);
      setAggregateLoading(false);
      setAggregateError(false);
      return;
    }
    setAggregateLoading(true);
    setAggregateError(false);
    void fetchDashboardAggregate(range, customFrom, customTo)
      .then((data) => {
        if (data) setAggregate(data);
        else setAggregateError(true);
      })
      .catch(() => setAggregateError(true))
      .finally(() => setAggregateLoading(false));
  }, [permLoading, canViewOrders, range, customFrom, customTo]);

  useEffect(() => {
    if (permLoading || !canViewOrders) return;
    fetch("/api/admin/funnel-metrics")
      .then((r) => {
        if (!r.ok) {
          setFunnelError(true);
          return null;
        }
        setFunnelError(false);
        return r.json();
      })
      .then((data: { metrics?: Record<string, FunnelMetric> } | null) => {
        if (data?.metrics) setFunnelMetrics(data.metrics);
      })
      .catch(() => setFunnelError(true));
  }, [permLoading, canViewOrders]);

  const rangeWindow = getDashboardRangeWindow(range, customFrom, customTo);

  const customLabel =
    customFrom && customTo
      ? `${new Date(customFrom).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${new Date(customTo).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`
      : "Özel";

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const metricOrders = useMemo(() => excludeTestOrders(orders), [orders]);

  const todayOrders = useMemo(
    () => metricOrders.filter((o) => o.createdAt >= todayStart),
    [metricOrders, todayStart]
  );
  const todayPaidOrders = todayOrders.filter((o) => o.status !== "cancelled");
  const todayRevenue =
    todayFinancial?.grossOrderTotal ??
    todayPaidOrders.reduce((s, o) => s + o.total, 0);
  const todayCount =
    todayFinancial?.orderCount ?? todayPaidOrders.length;

  const proofResponseMetric = funnelMetrics.proof_pending;
  const proofResponseHours =
    proofResponseMetric && proofResponseMetric.sampleCount > 0
      ? proofResponseMetric.avgSeconds / 3600
      : null;

  // Window içindeki siparişler (KPI ve chart'lar bunu kullanır)
  const inRange = useMemo(
    () =>
      metricOrders.filter(
        (o) =>
          o.createdAt >= rangeWindow.start &&
          (rangeWindow.end === undefined || o.createdAt <= rangeWindow.end)
      ),
    [metricOrders, rangeWindow.start, rangeWindow.end]
  );
  const inPrevRange = useMemo(
    () =>
      metricOrders.filter(
        (o) =>
          o.createdAt >= rangeWindow.prevStart &&
          o.createdAt < rangeWindow.prevEnd
      ),
    [metricOrders, rangeWindow.prevStart, rangeWindow.prevEnd]
  );

  // KPI hesaplamaları — brüt ciro iptal hariç; API varsa ortak kaynak
  const paidInRange = useMemo(
    () => inRange.filter((o) => o.status !== "cancelled"),
    [inRange]
  );
  const paidInPrevRange = useMemo(
    () => inPrevRange.filter((o) => o.status !== "cancelled"),
    [inPrevRange]
  );
  const count = financialSummary?.orderCount ?? paidInRange.length;
  const prevCount =
    aggregate?.prevPeriod.count ?? paidInPrevRange.length;
  const revenue =
    financialSummary?.grossOrderTotal ??
    paidInRange.reduce((s, o) => s + o.total, 0);
  const collectedRevenue = financialSummary?.collectedTotal;
  const prevRevenue =
    aggregate?.prevPeriod.revenue ??
    paidInPrevRange.reduce((s, o) => s + o.total, 0);
  const aov = count > 0 ? revenue / count : 0;
  const aiFlagged = countByStatuses(metricOrders, AI_QC_ACTIVE_STATUSES);
  const aiQueueDirty = aiFlagged > 0 || stuckDesignCount > 0;
  const proofPending = metricOrders.filter(
    (o) => o.status === "proof_pending"
  ).length;
  const productionPending = countByStatuses(
    metricOrders,
    UNASSIGNED_PRODUCTION_STATUSES
  );

  const countChange = formatChange(count, prevCount);
  const revenueChange = formatChange(revenue, prevRevenue);

  const todoList = useMemo(
    () =>
      canViewOrders ? buildTodoList(metricOrders, stuckDesignCount) : [],
    [metricOrders, canViewOrders, stuckDesignCount]
  );

  const aggregateOrderCount = aggregate?.totalOrderCount ?? 0;
  const dailySeries = aggregate?.dailySeries ?? [];
  const revenueSeries: LinePoint[] = dailySeries.map((d) => ({
    x: formatShortDate(new Date(d.date)),
    y: d.revenue,
  }));
  const orderSeries: LinePoint[] = dailySeries.map((d) => ({
    x: formatShortDate(new Date(d.date)),
    y: d.count,
  }));

  const productMix = aggregate?.productMix ?? EMPTY_PRODUCT_MIX;
  const statusDistribution =
    aggregate?.statusDistribution ??
    ({
      paid: 0,
      awaiting_upload: 0,
      qc_pending: 0,
      qc_flagged: 0,
      operator_review: 0,
      human_review: 0,
      human_review_failed: 0,
      proof_generating: 0,
      proof_pending: 0,
      proof_validating: 0,
      proof_approved: 0,
      operator_print_review: 0,
      ready_to_ship: 0,
      fason_assigned: 0,
      in_production: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    } satisfies StatusCount);
  const heatmapMatrix = aggregate?.heatmapMatrix ?? EMPTY_HEATMAP;
  const tops = aggregate?.topCustomers ?? [];
  const cities = aggregate?.topCities ?? [];
  const ops = aggregate?.operationalMetrics ?? EMPTY_OPS;
  const proofStats30d = aggregate?.proofFlowStats30d ?? EMPTY_PROOF_STATS;
  const isCancelOverTarget =
    ops.cancelRate > 5 && aggregateOrderCount > 0;
  const isZeroDelivered =
    statusDistribution.delivered === 0 && aggregateOrderCount > 0;
  const showUrgentOpsBanner = isCancelOverTarget || isZeroDelivered;
  const isProofCancelOverTarget =
    proofStats30d.cancelRate > 30 && proofStats30d.total > 0;
  const insights: InsightItem[] = aggregate?.insights ?? [];

  // Sefa 21 May v68 (admin denetim P2 #14): orders kaynak sıralaması statü
  // bazlı olabiliyordu — Son siparişler kullanıcının beklediği kronoloji
  // (createdAt DESC) ile gözüksün diye explicit sort.
  const recent = useMemo(
    () =>
      [...metricOrders]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 5),
    [metricOrders]
  );

  const dateLabel = now
    ? now
        .toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          weekday: "long",
        })
        .toUpperCase() +
      " · " +
      now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const updateAgo = Math.floor((Date.now() - lastUpdate) / 1000);
  const updateAgoLabel =
    updateAgo < 5
      ? "az önce"
      : updateAgo < 60
        ? `${updateAgo} sn önce`
        : `${Math.floor(updateAgo / 60)} dk önce`;

  // KPI cards — finans yetkisi olmayan rollere ciro/AOV gizlenir
  const KPIS = [
    ...(showFinancials
      ? [
          {
            label: `${RANGE_LABEL[range]} ciro (brut)`,
            value: formatCurrency(revenue),
            sub:
              collectedRevenue != null
                ? `Tahsil: ${formatCurrency(collectedRevenue)} · ${revenueChange.label}`
                : revenueChange.label,
            trend: revenueChange.trend,
            accent: "text-yesil",
          },
        ]
      : []),
    ...(showFinancials
      ? [
          {
            label: "Sepet ortalaması",
            value: aov > 0 ? formatCurrency(aov) : "—",
            sub: count > 0 ? `${count} sipariş bazlı` : "veri yok",
            trend: "flat" as const,
            accent: "text-lacivert",
          },
        ]
      : []),
    {
      label: "AI / operatör kuyruğu",
      value: aiQueueDirty
        ? String(aiFlagged + stuckDesignCount)
        : aiFlagged.toString(),
      sub: stuckDesignCount > 0
        ? `${stuckDesignCount} dosya takili · ${aiFlagged} siparis kuyrugu`
        : aiFlagged > 0
          ? "inceleme bekliyor"
          : "kuyruk temiz",
      trend: "flat" as const,
      accent: aiQueueDirty ? "text-sari-koyu" : "text-gri-500",
    },
    {
      label: "Prova bekleyen",
      value: proofPending.toString(),
      sub: proofPending > 0 ? "müşteri yanıtı" : "—",
      trend: "flat" as const,
      accent: "text-lacivert",
    },
    {
      label: "Üretime alınacak",
      value: productionPending.toString(),
      sub: productionPending > 0 ? "atama yapılacak" : "—",
      trend: "flat" as const,
      accent: productionPending > 0 ? "text-yesil" : "text-gri-500",
    },
  ];

  // Production funnel — modern akış (grouped counts)
  const funnel = [
    {
      key: "new",
      label: "Yeni",
      statuses: ["paid", "awaiting_upload"] as const,
      count: statusDistribution.paid + statusDistribution.awaiting_upload,
      href: adminOrdersListHref(["paid", "awaiting_upload"]),
    },
    {
      key: "ai-qc",
      label: "AI kontrol",
      statuses: ["qc_pending", "qc_flagged"] as const,
      count: statusDistribution.qc_pending + statusDistribution.qc_flagged,
      href: adminOrdersListHref(["qc_pending", "qc_flagged"]),
    },
    {
      key: "review",
      label: "İnceleme",
      statuses: [
        "human_review",
        "operator_review",
        "proof_generating",
        "human_review_failed",
      ] as const,
      count:
        statusDistribution.human_review +
        statusDistribution.operator_review +
        statusDistribution.proof_generating +
        statusDistribution.human_review_failed,
      href: "/admin/ai-qc",
    },
    {
      key: "proof",
      label: "Prova",
      statuses: ["proof_pending"] as const,
      count: statusDistribution.proof_pending,
      href: "/admin/prova",
    },
    {
      key: "ready",
      label: "Üretime hazır",
      statuses: ["proof_approved", "ready_to_ship"] as const,
      count:
        statusDistribution.proof_approved + statusDistribution.ready_to_ship,
      href: adminOrdersListHref(["proof_approved", "ready_to_ship"]),
    },
    {
      key: "production",
      label: "Üretimde",
      statuses: ["fason_assigned", "in_production"] as const,
      count:
        statusDistribution.fason_assigned + statusDistribution.in_production,
      href: adminOrdersListHref(["fason_assigned", "in_production"]),
    },
    {
      key: "shipped",
      label: "Kargoda",
      statuses: ["shipped"] as const,
      count: statusDistribution.shipped,
      href: adminOrdersListHref("shipped"),
    },
    {
      key: "delivered",
      label: "Teslim",
      statuses: ["delivered"] as const,
      count: statusDistribution.delivered,
      href: adminOrdersListHref("delivered"),
    },
  ];
  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);
  const funnelTotal = funnel.reduce((sum, s) => sum + s.count, 0);

  const funnelDisplay = useMemo(() => {
    let lastWithOrders = -1;
    for (let i = funnel.length - 1; i >= 0; i--) {
      if (funnel[i].count > 0) {
        lastWithOrders = i;
        break;
      }
    }
    if (lastWithOrders < 0) {
      return {
        visible: [] as typeof funnel,
        emptyTailSummary: "Üretim akışında henüz sipariş yok",
      };
    }
    const visible = funnel.slice(0, lastWithOrders + 1);
    const tail = funnel.slice(lastWithOrders + 1);
    const emptyTailSummary =
      tail.length > 0
        ? `${tail.map((s) => s.label.toLowerCase()).join(" ve ")}: henüz sipariş yok`
        : null;
    return { visible, emptyTailSummary };
  }, [funnel]);

  const QUICK_ACTIONS = [
    ...(canView("manual_order")
      ? [{ href: "/admin/siparis-ekle", label: "Manuel sipariş", desc: "Telefon / WhatsApp", icon: <Icon.Plus size={18} />, accent: true }]
      : []),
    ...(canView("pricing")
      ? [{ href: "/admin/fiyat-hesapla", label: "Hızlı teklif", desc: "Etiket/sticker", icon: <Icon.Bolt size={18} /> }]
      : []),
    ...(canViewReviews && pendingReviews > 0
      ? [
          {
            href: "/admin/yorumlar",
            label: "Yorum onayi",
            desc: `${pendingReviews} bekleyen`,
            icon: <Icon.Star size={18} />,
          },
        ]
      : []),
  ];

  // Status distribution as horizontal bar
  const statusBars: BarPoint[] = (Object.keys(statusDistribution) as OrderStatus[])
    .filter((s) => statusDistribution[s] > 0)
    .map((s) => {
      const meta = getAdminStatusMeta(s);
      return {
        label: meta.label,
        value: statusDistribution[s],
        color: meta.hex ?? "#64748B",
      };
    });

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[1320px] px-4 md:px-6">
        {/* Header — sidebar topbar zaten "Operatör paneli" gösteriyor, burada özet */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              {dateLabel}
            </div>
            <p className="mt-1 text-[13.5px] text-gri-700 flex items-center gap-1.5">
              {canViewOrders
                ? ordersLoading
                  ? "Sipariş verileri yükleniyor…"
                  : ordersError
                    ? "Sipariş verileri yüklenemedi"
                    : `Tüm metrikler — son güncelleme ${updateAgoLabel}`
                : "Sipariş metrikleri yetkiniz dışında"}
              {canViewOrders && !ordersLoading && !ordersError && (
                <span className="inline-flex w-1.5 h-1.5 rounded-full bg-yesil animate-pulse" />
              )}
              {range === "custom" && customFrom && customTo && (
                <span className="text-[12px] text-gri-500 ml-2">({customLabel})</span>
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="bg-white rounded-full ring-1 ring-gri-200 p-1 inline-flex gap-1">
              {(Object.keys(RANGE_LABEL) as TimeRange[])
                .filter((r) => r !== "custom")
                .map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRange(r);
                    setShowDatePicker(false);
                  }}
                  className={cn(
                    "min-h-11 h-11 sm:min-h-8 sm:h-8 px-3.5 rounded-full text-[12.5px] font-semibold transition-colors",
                    range === r
                      ? "bg-lacivert text-white"
                      : "text-gri-700 hover:text-lacivert"
                  )}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowDatePicker((s) => !s);
                  if (range !== "custom") setRange("custom");
                }}
                className={cn(
                  "min-h-11 h-11 sm:min-h-8 sm:h-8 px-3.5 rounded-full text-[12.5px] font-semibold transition-colors",
                  range === "custom"
                    ? "bg-lacivert text-white"
                    : "text-gri-700 hover:text-lacivert"
                )}
              >
                <Icon.Calendar size={14} className="inline mr-1" />
                Özel
              </button>
            </div>
            {showDatePicker && (
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg ring-1 ring-gri-200 shadow-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-gri-700">Başlangıç:</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    max={customTo || undefined}
                    className="text-[13px] border border-gri-200 rounded px-2 py-1 focus:border-pim-mercan focus:outline-none"
                  />
                </div>
                <span className="text-gri-400">→</span>
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-gri-700">Bitiş:</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    min={customFrom || undefined}
                    max={new Date().toISOString().slice(0, 10)}
                    className="text-[13px] border border-gri-200 rounded px-2 py-1 focus:border-pim-mercan focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (customFrom && customTo) {
                      setRange("custom");
                      setShowDatePicker(false);
                    }
                  }}
                  disabled={!customFrom || !customTo}
                  className="px-3 py-1.5 bg-pim-mercan text-white text-[12.5px] font-medium rounded-lg disabled:opacity-40"
                >
                  Uygula
                </button>
              </div>
            )}
          </div>
        </div>

        {deniedModule && (
          <div className="mb-6 rounded-xl px-5 py-3.5 ring-1 bg-sari-soft ring-sari/30 text-lacivert text-[13.5px] flex items-center gap-3">
            <Icon.Info size={18} className="shrink-0 text-sari-koyu" aria-hidden />
            <span>
              <strong>{getAdminModuleLabel(deniedModule)}</strong> modülüne
              erişim yetkiniz yok — yönlendirildiniz.
            </span>
          </div>
        )}

        {!permLoading && !canViewOrders && (
          <Card padding="p-5" className="mb-6 ring-1 ring-gri-200">
            <h2 className="text-[15px] font-semibold text-lacivert mb-1">
              Sipariş verileri gizli
            </h2>
            <p className="text-[13px] text-gri-700">
              Bu rol için sipariş KPI, funnel ve liste widget&apos;ları
              gösterilmiyor. Yetkili bir yöneticiyle iletişime geçin.
            </p>
          </Card>
        )}

        {canViewOrders && ordersError && (
          <div className="mb-6 rounded-xl px-5 py-3.5 ring-1 bg-kirmizi/5 ring-kirmizi/20 text-kirmizi flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13.5px] font-semibold">{ordersError}</span>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="text-[12.5px] font-bold underline hover:no-underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {canViewOrders && ordersLoading && (
          <Card padding="p-8" className="mb-6 text-center text-gri-700">
            Sipariş verileri yükleniyor…
          </Card>
        )}

        {canViewOrders && aggregateError && !aggregateLoading && (
          <div className="mb-4 rounded-lg border border-kirmizi/30 bg-kirmizi-soft/20 px-4 py-3 text-sm text-lacivert">
            <Icon.Info size={14} className="inline shrink-0 text-kirmizi mr-1" />
            Dashboard metrikleri yüklenemedi — grafikler güncel olmayabilir.
          </div>
        )}

        {canViewOrders && ordersTruncated && !ordersLoading && !ordersError && (
          <div className="mb-4 rounded-lg border border-sari bg-sari-soft/30 px-4 py-3 text-sm text-lacivert">
            <Icon.Info size={14} className="inline shrink-0 text-sari-koyu mr-1" />
            <strong>Son 500 sipariş gösteriliyor.</strong> Grafik ve KPI
            metrikleri tam veritabanından hesaplanır; yalnızca &quot;Son
            siparişler&quot; listesi bu limite tabidir. Tam finans için{" "}
            <Link href="/admin/finans" className="underline font-semibold">
              Finans &amp; Raporlar
            </Link>{" "}
            sayfasını kullanın.
          </div>
        )}

        {canViewOrders && !ordersLoading && !ordersError && showUrgentOpsBanner && (
          <div className="mb-4 rounded-xl px-5 py-3.5 ring-2 ring-kirmizi bg-kirmizi/10 text-kirmizi-koyu">
            <div className="text-[14px] font-semibold text-kirmizi">
              Operasyonel uyari
            </div>
            <ul className="mt-2 space-y-1 text-[13px] list-disc list-inside">
              {isCancelOverTarget && (
                <li>
                  Iptal orani %{ops.cancelRate.toFixed(0)} — hedef %5 uzerinde
                </li>
              )}
              {isZeroDelivered && (
                <li>
                  Henuz teslim edilmis siparis yok ({aggregateOrderCount} aktif
                  kayit)
                </li>
              )}
            </ul>
          </div>
        )}

        {canViewOrders && !ordersLoading && !ordersError && systemHealth && (
          <div
            className={cn(
              "mb-4 rounded-lg px-4 py-2.5 flex items-center gap-4 text-[12.5px] flex-wrap",
              systemHealth.crons.error > 0 ||
                systemHealth.mail.status === "error" ||
                systemHealth.db.status === "error" ||
                systemHealth.customers?.status === "error"
                ? "bg-kirmizi/10 text-kirmizi"
                : "bg-yesil-soft/30 text-yesil-koyu"
            )}
          >
            <span className="inline-flex items-center gap-1">
              <Icon.Cog size={14} />
              Cron: {systemHealth.crons.healthy}/{systemHealth.crons.total}
              {systemHealth.crons.error > 0 && (
                <Link
                  href="/admin/sistem/cronlar"
                  className="underline ml-1 font-semibold"
                  title={
                    systemHealth.crons.failures?.length
                      ? systemHealth.crons.failures
                          .map(
                            (f) =>
                              `${f.name}${f.error ? `: ${f.error}` : ""}`
                          )
                          .join("\n")
                      : systemHealth.crons.lastError
                  }
                >
                  {systemHealth.crons.error} hata
                </Link>
              )}
            </span>
            <span className="text-gri-300">|</span>
            <span>
              Mail: {systemHealth.mail.sent24h} gönderildi
              {systemHealth.mail.bounce > 0 && (
                <span className="text-kirmizi ml-1 font-semibold">
                  {systemHealth.mail.bounce} bounce
                </span>
              )}
            </span>
            <span className="text-gri-300">|</span>
            <span className="inline-flex items-center gap-1">
              DB:{" "}
              {systemHealth.db.status === "ok" ? (
                <Icon.Check size={12} className="text-yesil" />
              ) : (
                <Icon.X size={12} className="text-kirmizi" />
              )}
            </span>
            {systemHealth.customers && (
              <>
                <span className="text-gri-300">|</span>
                <span className="inline-flex items-center gap-1">
                  Musteri API:{" "}
                  {systemHealth.customers.status === "ok" ? (
                    <Icon.Check size={12} className="text-yesil" />
                  ) : (
                    <Link
                      href="/admin/musteriler"
                      className="inline-flex items-center gap-0.5 text-kirmizi font-semibold underline"
                    >
                      <Icon.X size={12} /> hata
                    </Link>
                  )}
                </span>
              </>
            )}
          </div>
        )}

        {canViewOrders && !ordersLoading && !ordersError && (
          <>
        {/* "Bugün ne yapmalıyım" — günün iş kuyruğu */}
        {todoList.length > 0 && (
          <Card padding="p-0" className="mb-6 ring-1 ring-pim-mercan/15">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between bg-pim-mercan-tint">
              <div className="flex items-center gap-2">
                <Icon.Sparkle size={18} className="text-pim-mercan" />
                <div>
                  <h2 className="text-[15px] font-semibold text-pim-mercan">
                    Bugün ne yapmalıyım?
                  </h2>
                  <p className="text-[11.5px] text-pim-mercan/80">
                    {todoList.length} is satiri — toplam{" "}
                    {todoList.reduce((s, t) => s + t.count, 0)} kayit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/kuyruk"
                  className="text-[12px] font-semibold text-pim-mercan hover:underline whitespace-nowrap"
                >
                  Tüm acil işleri gör →
                </Link>
                <span
                  className="text-[12px] font-bold tabular-nums text-pim-mercan bg-white rounded-full h-7 min-w-7 px-2.5 grid place-items-center"
                  title="Is kategorisi sayisi"
                >
                  {todoList.length} satir
                </span>
              </div>
            </div>
            <div className="divide-y divide-gri-100">
              {todoList.map((t) => (
                <Link
                  key={t.id}
                  href={t.href}
                  className={cn(
                    "px-5 py-3.5 flex items-center gap-3 hover:bg-gri-50 transition-colors",
                    t.urgent && "bg-sari-soft/40"
                  )}
                >
                  {(() => {
                    const TodoIcon = Icon[t.iconKey];
                    return (
                      <TodoIcon size={22} className="shrink-0 text-pim-mercan" />
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13.5px] text-lacivert">
                        {t.title}
                      </span>
                      {t.urgent && (
                        <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-kirmizi text-white text-[9.5px] font-bold uppercase tracking-[0.05em]">
                          Acil
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-gri-700 mt-0.5">
                      {t.hint}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[20px] font-bold tabular-nums leading-none",
                        t.urgent ? "text-kirmizi" : "text-pim-mercan"
                      )}
                    >
                      {t.count}
                    </span>
                    <Icon.ChevR
                      size={14}
                      className="text-gri-500 group-hover:text-pim-mercan"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {todoList.length === 0 && orders.length > 0 && (
          <Card padding="p-5" className="mb-6 bg-yesil-soft ring-yesil/20">
            <div className="flex items-center gap-3">
              <Icon.Check size={28} className="text-yesil shrink-0" />
              <div>
                <h2 className="text-[15px] font-semibold text-lacivert">
                  Hat boş — tüm acil işler tamam
                </h2>
                <p className="text-[12.5px] text-gri-700 mt-0.5">
                  Yeni sipariş geldikçe burada gözükecek. Bir kahve hak ettin.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* KPI grid — Bugün kartı + metrikler */}
        <div
          className="grid gap-3 mb-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          <Card
            padding="p-4"
            className="!bg-pim-mercan-tint/20 ring-1 ring-pim-mercan/20"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-pim-mercan">
              Bugün
            </div>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              {showFinancials && (
                <span className="text-[28px] font-bold text-lacivert tabular-nums">
                  {formatCurrency(todayRevenue)}
                </span>
              )}
              <span className="text-[13px] text-gri-700">
                {todayCount} sipariş
              </span>
            </div>
            {showFinancials && todayCount > 0 && (
              <div className="mt-1 text-[11px] text-gri-500">
                Ort. sepet: {formatCurrency(todayRevenue / todayCount)}
              </div>
            )}
          </Card>
          {KPIS.map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 truncate">
                {k.label}
              </div>
              <div
                className={cn(
                  "text-[24px] font-bold mt-1 leading-none tabular-nums truncate",
                  k.accent
                )}
              >
                {k.value}
              </div>
              <div
                className={cn(
                  "text-[11.5px] mt-1.5 flex items-center gap-1",
                  k.trend === "up"
                    ? "text-yesil font-semibold"
                    : k.trend === "down"
                      ? "text-kirmizi font-semibold"
                      : "text-gri-700"
                )}
              >
                {k.trend === "up" && "↑"}
                {k.trend === "down" && "↓"}
                <span className="truncate">{k.sub}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Revenue trend + Product mix */}
        <div
          className={cn(
            "grid gap-4 mb-6",
            showFinancials
              ? "grid-cols-1 lg:grid-cols-[1.6fr_1fr]"
              : "grid-cols-1"
          )}
        >
          {showFinancials && (
            <Card padding="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-semibold">Ciro trendi</h2>
                  <p className="text-[12px] text-gri-700">
                    Son {rangeWindow.days} gün
                  </p>
                </div>
                <span className="text-[13px] font-bold text-yesil tabular-nums">
                  {formatCurrency(revenue)}
                </span>
              </div>
              <LineChart
                points={revenueSeries}
                height={140}
                color="text-yesil"
                formatY={formatCurrency}
                emptyLabel="Sipariş geldikçe ciro burada birikir"
              />
            </Card>
          )}

          <Card padding="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Ürün karışımı</h2>
              <p className="text-[12px] text-gri-700">Etiket vs sticker</p>
            </div>
            <DonutChart
              slices={[
                { label: "Etiket", value: productMix.etiket, color: "#FF4D4F" },
                { label: "Sticker", value: productMix.sticker, color: "#1F2A4D" },
              ]}
              size={150}
              centerLabel="Toplam"
              centerValue={(productMix.etiket + productMix.sticker).toString()}
              emptyLabel="İlk siparişten sonra dağılım gözükür"
            />
          </Card>
        </div>

        {/* Production funnel */}
        <Card padding="p-0" className="mb-6">
          <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                Üretim akışı
                {funnelError && (
                  <span
                    className="text-[10px] text-kirmizi font-normal"
                    title="API hatası — veri yüklenemedi"
                  >
                     yüklenemedi
                  </span>
                )}
              </h2>
              <p className="text-[12px] text-gri-700">
                Her adımdaki aktif iş — tıklayarak detaya in
              </p>
            </div>
            <span className="text-[12px] text-gri-500">
              Akıştaki toplam: {funnelTotal}
            </span>
          </div>
          <div className="p-4">
            {funnelDisplay.visible.length === 0 ? (
              <p className="text-[13px] text-gri-500 py-4 text-center">
                {funnelDisplay.emptyTailSummary}
              </p>
            ) : (
              <>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(funnelDisplay.visible.length, 4)}, minmax(0, 1fr))`,
                  }}
                >
                  {funnelDisplay.visible.map((step, i) => {
                const intensity = step.count / maxFunnel;
                const metric = aggregateFunnelMetric(
                  funnelMetrics,
                  step.statuses
                );
                const hasMetric = metric !== null && metric.sampleCount > 0;
                const slowWarning =
                  hasMetric && metric.avgSeconds > 24 * 3600;
                return (
                  <Link
                    key={step.key}
                    href={step.href}
                    className={cn(
                      "group bg-white ring-1 rounded-xl p-3 transition-all hover:-translate-y-0.5",
                      slowWarning
                        ? "ring-sari/40 hover:ring-sari"
                        : "ring-gri-200 hover:ring-pim-mercan"
                    )}
                  >
                    <div className="text-[10.5px] font-semibold text-gri-700 uppercase tracking-[0.03em] flex items-center gap-1">
                      <span className="grid place-items-center w-4 h-4 rounded-full bg-gri-100 text-[9px] font-bold">
                        {i + 1}
                      </span>
                      {step.label}
                    </div>
                    <div className="text-[20px] font-bold tabular-nums mt-1.5 text-lacivert">
                      {step.count}
                    </div>
                    <div className="mt-2 h-1 bg-gri-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          step.count === 0
                            ? "bg-gri-200"
                            : intensity > 0.5
                              ? "bg-pim-mercan"
                              : "bg-pim-mercan/50"
                        )}
                        style={{ width: `${Math.max(intensity * 100, 4)}%` }}
                      />
                    </div>
                    {step.count > 0 && hasMetric && metric && (
                    <div
                      className={cn(
                        "mt-1.5 text-[10.5px] tabular-nums flex items-center gap-1",
                        slowWarning
                          ? "text-sari-koyu font-semibold"
                          : "text-gri-500"
                      )}
                      title={`${metric.sampleCount} sipariş örnekleminden ortalama`}
                    >
                      <Icon.Calendar size={10} className="opacity-70" />
                      {formatDuration(metric.avgSeconds)}
                    </div>
                    )}
                  </Link>
                );
              })}
                </div>
                {funnelDisplay.emptyTailSummary && (
                  <p className="mt-3 text-[12.5px] text-gri-500 text-center">
                    {funnelDisplay.emptyTailSummary}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Operational metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 items-stretch">
          <Card padding="p-4" className="h-full flex flex-col">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              AI flag oranı
            </div>
            <div className={cn(
              "text-[22px] font-bold mt-1 tabular-nums",
              ops.aiFlagRate > 30 ? "text-kirmizi" : ops.aiFlagRate > 0 ? "text-sari-koyu" : "text-gri-500"
            )}>
              {aggregateOrderCount > 0 ? `%${ops.aiFlagRate.toFixed(0)}` : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {aggregateOrderCount > 0 ? "hedef <%10" : "veri yok"}
            </div>
          </Card>

          <Card padding="p-4" className="h-full flex flex-col">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Ort. tamamlanma
            </div>
            <div className="text-[22px] font-bold mt-1 tabular-nums text-lacivert">
              {formatHours(ops.avgFulfillmentHours)}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {ops.avgFulfillmentHours !== null
                ? "sipariş → teslim"
                : "henüz teslimat yok"}
            </div>
          </Card>

          <Link
            href="/admin/siparisler?status=cancelled"
            className="block h-full rounded-xl transition-shadow hover:ring-1 hover:ring-gri-200"
          >
          <Card
            padding="p-4"
            className={cn(
              "h-full flex flex-col",
              isCancelOverTarget && "ring-2 ring-kirmizi bg-kirmizi-soft/10"
            )}
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              İptal oranı
            </div>
            <div
              className={cn(
                "text-[22px] font-bold mt-1 tabular-nums",
                aggregateOrderCount === 0
                  ? "text-gri-500"
                  : ops.cancelRate > 5
                    ? "text-kirmizi"
                    : ops.cancelRate > 0
                      ? "text-yesil"
                      : "text-gri-500"
              )}
            >
              {aggregateOrderCount > 0 ? `%${ops.cancelRate.toFixed(0)}` : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {aggregateOrderCount > 0 ? (
                ops.cancelRate > 5 ? (
                  <span className="text-xs font-semibold text-kirmizi">
                    Hedefin {(ops.cancelRate / 5).toFixed(1)}x üstünde (hedef
                    &lt;%5)
                  </span>
                ) : (
                  "hedef <%5"
                )
              ) : (
                "veri yok"
              )}
            </div>
          </Card>
          </Link>

          <Link href="/admin/prova" className="block h-full rounded-xl transition-shadow hover:ring-1 hover:ring-gri-200">
          <Card
            padding="p-4"
            className={cn(
              "h-full flex flex-col",
              isProofCancelOverTarget && "ring-2 ring-kirmizi bg-kirmizi-soft/10"
            )}
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Prova iptal oranı
            </div>
            <div
              className={cn(
                "text-[22px] font-bold mt-1 tabular-nums",
                proofStats30d.total === 0
                  ? "text-gri-500"
                  : isProofCancelOverTarget
                    ? "text-kirmizi"
                    : proofStats30d.cancelRate > 0
                      ? "text-lacivert"
                      : "text-gri-500"
              )}
            >
              {proofStats30d.total > 0
                ? `%${proofStats30d.cancelRate.toFixed(0)}`
                : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {proofStats30d.total > 0 ? (
                isProofCancelOverTarget ? (
                  <span className="text-xs font-semibold text-kirmizi">
                    {proofStats30d.approved} onay / {proofStats30d.cancelled}{" "}
                    iptal — hedef &lt;%30
                  </span>
                ) : (
                  `${proofStats30d.approved} onay / ${proofStats30d.cancelled} iptal (30g)`
                )
              ) : (
                "henüz veri yok"
              )}
            </div>
          </Card>
          </Link>

          <Card padding="p-4" className="h-full flex flex-col">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Prova bekleme
            </div>
            <div className="text-[22px] font-bold mt-1 tabular-nums text-lacivert">
              {proofResponseHours !== null
                ? formatHours(proofResponseHours)
                : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {proofResponseHours !== null
                ? "prova sonrası müşteri yanıt süresi"
                : "henüz veri yok"}
            </div>
          </Card>

          <Card padding="p-4" className="h-full flex flex-col">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 flex items-center gap-1">
              {customerStats ? "Yeni kayıt (7g)" : "Tekrar müşteri"}
              {statsError && (
                <span
                  className="text-[9px] text-kirmizi normal-case inline-flex items-center gap-0.5"
                  title="API hatası — veri yüklenemedi"
                >
                  <Icon.Info size={10} />
                  yüklenemedi
                </span>
              )}
              {auditorError && canViewAuditors && (
                <span
                  className="text-[9px] text-kirmizi normal-case inline-flex items-center gap-0.5"
                  title="Denetçi API hatası"
                >
                  <Icon.Info size={10} />
                  yüklenemedi
                </span>
              )}
            </div>
            <div className="text-[22px] font-bold mt-1 tabular-nums text-pim-mercan">
              {customerStats !== null
                ? customerStats.weekNew
                : tops.filter((t) => t.orderCount > 1).length}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {customerStats !== null
                ? `${customerStats.total} toplam kullanıcı`
                : "2+ sipariş veren"}
            </div>
          </Card>
        </div>

        {/* Müşteri kayıt istatistikleri (varsa) */}
        {canViewCustomers && (customerStats !== null || statsError) && (
          <Card padding="p-5" className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  Üyelik istatistikleri
                  {statsError && (
                    <span
                      className="text-[10px] text-kirmizi font-normal"
                      title="API hatası — veri yüklenemedi"
                    >
                       yüklenemedi
                    </span>
                  )}
                </h2>
                <p className="text-[12px] text-gri-700">
                  Hesap açan ziyaretçiler — sipariş vermeden önce
                </p>
              </div>
              <Link
                href="/admin/musteriler"
                className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                Müşteri listesi →
              </Link>
            </div>
            {statsError ? (
              <p className="text-[13px] text-gri-700">
                Müşteri istatistikleri yüklenemedi. Sayfayı yenileyin veya yetkinizi
                kontrol edin.
              </p>
            ) : customerStats && customerStats.total > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gri-50 ring-1 ring-gri-200 p-3.5">
                <div className="text-[10.5px] font-semibold uppercase text-gri-700 tracking-[0.04em]">
                  Bugün
                </div>
                <div className="text-[24px] font-bold tabular-nums mt-0.5 text-yesil">
                  +{customerStats.todayNew}
                </div>
              </div>
              <div className="rounded-lg bg-gri-50 ring-1 ring-gri-200 p-3.5">
                <div className="text-[10.5px] font-semibold uppercase text-gri-700 tracking-[0.04em]">
                  7 gün
                </div>
                <div className="text-[24px] font-bold tabular-nums mt-0.5 text-pim-mercan">
                  +{customerStats.weekNew}
                </div>
              </div>
              <div className="rounded-lg bg-gri-50 ring-1 ring-gri-200 p-3.5">
                <div className="text-[10.5px] font-semibold uppercase text-gri-700 tracking-[0.04em]">
                  Bu ay
                </div>
                <div className="text-[24px] font-bold tabular-nums mt-0.5 text-lacivert">
                  +{customerStats.monthNew}
                </div>
              </div>
              <div className="rounded-lg bg-pim-mercan-tint p-3.5">
                <div className="text-[10.5px] font-semibold uppercase text-pim-mercan tracking-[0.04em]">
                  Toplam
                </div>
                <div className="text-[24px] font-bold tabular-nums mt-0.5 text-pim-mercan">
                  {customerStats.total}
                </div>
              </div>
            </div>
            ) : (
              <p className="text-[13px] text-gri-500">Henüz kayıtlı müşteri yok.</p>
            )}
          </Card>
        )}

        {canViewFason &&
          partnerProduction &&
          partnerProduction.partners.length > 0 && (
            <Card padding="p-0" className="mb-6">
              <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold">Üretim partnerleri</h2>
                  <p className="text-[12px] text-gri-700">
                    Aktif atamalar — partner bazlı özet
                  </p>
                </div>
                <Link
                  href="/admin/fason"
                  className="text-[12px] font-semibold text-pim-mercan hover:underline"
                >
                  Tümü →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-gri-50 text-[11px] uppercase text-gri-700">
                      <th className="text-left px-5 py-2 font-semibold">Partner</th>
                      <th className="text-right px-5 py-2 font-semibold">Üretimde</th>
                      <th className="text-right px-5 py-2 font-semibold">Gecikmeli</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gri-100">
                    {partnerProduction.partners.map((p) => (
                      <tr
                        key={p.name}
                        className={cn(
                          p.overdueCount > 0 && "bg-kirmizi/5"
                        )}
                      >
                        <td className="px-5 py-2.5 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {p.name}
                            {p.overdueCount > 0 && (
                              <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-kirmizi text-white text-[9.5px] font-bold uppercase">
                                Acil
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {p.activeCount}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-2.5 text-right tabular-nums",
                            p.overdueCount > 0 && "text-kirmizi font-semibold"
                          )}
                        >
                          {p.overdueCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {p.overdueCount}
                              <Icon.Info size={12} className="text-kirmizi" />
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gri-100 text-[12px] text-gri-700">
                Toplam: {partnerProduction.totals.active} üretimde
                {partnerProduction.totals.overdue > 0 && (
                  <span className="text-kirmizi font-semibold ml-1">
                    · {partnerProduction.totals.overdue} gecikmeli
                  </span>
                )}
              </div>
            </Card>
          )}

        {/* AI insights + Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
          {aggregateOrderCount >= 10 ? (
          <Card padding="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon.Sparkle size={16} className="text-pim-mercan" />
              <h2 className="text-[15px] font-semibold">Otomatik içgörüler</h2>
            </div>
            <ul className="space-y-2.5">
              {insights.map((ins, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-lg px-3.5 py-2.5 ring-1 text-[13px] leading-relaxed flex items-start gap-2.5",
                    ins.level === "good"
                      ? "bg-yesil-soft ring-yesil/20 text-lacivert"
                      : ins.level === "warn"
                        ? "bg-sari-soft ring-sari/20 text-lacivert"
                        : "bg-gri-50 ring-gri-200 text-gri-700"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                      ins.level === "good"
                        ? "bg-yesil"
                        : ins.level === "warn"
                          ? "bg-sari"
                          : "bg-gri-500"
                    )}
                  />
                  <span>{ins.text}</span>
                </li>
              ))}
            </ul>
          </Card>
          ) : (
            <Card padding="p-5" className="!bg-gri-50">
              <div className="flex items-center gap-3 text-gri-500 text-sm">
                <Icon.Sparkle size={24} className="text-gri-500 shrink-0" />
                <div>
                  <div className="font-medium">Otomatik içgörüler</div>
                  <div className="text-[12px]">
                    10+ sipariş sonrası aktif ({aggregateOrderCount}/10)
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 content-start">
            {QUICK_ACTIONS.length === 0 ? (
              <Card padding="p-4" className="col-span-2 text-[13px] text-gri-700">
                Yetkiniz olan hızlı aksiyon bulunmuyor.
              </Card>
            ) : (
              QUICK_ACTIONS.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className={cn(
                  "rounded-xl p-4 hover:-translate-y-0.5 transition-all flex items-center gap-3 shadow-1 ring-1",
                  q.accent
                    ? "bg-pim-mercan text-white ring-pim-mercan hover:bg-pim-mercan/90"
                    : "bg-white text-lacivert ring-gri-200 hover:ring-pim-mercan"
                )}
              >
                <span
                  className={cn(
                    "grid place-items-center w-9 h-9 rounded-xl shrink-0",
                    q.accent
                      ? "bg-white/20 text-white"
                      : "bg-pim-mercan-tint text-pim-mercan"
                  )}
                >
                  {q.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[12.5px] truncate">
                    {q.label}
                  </div>
                  <div
                    className={cn(
                      "text-[10.5px] truncate",
                      q.accent ? "opacity-80" : "text-gri-700"
                    )}
                  >
                    {q.desc}
                  </div>
                </div>
              </Link>
              ))
            )}
          </div>
        </div>

        {/* Daily order chart + heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card padding="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Sipariş sayısı</h2>
                <p className="text-[12px] text-gri-700">
                  Günlük — son {rangeWindow.days} gün
                </p>
              </div>
              <span className="text-[13px] font-bold text-pim-mercan tabular-nums">
                {count}
              </span>
            </div>
            <LineChart
              points={orderSeries}
              height={140}
              color="text-pim-mercan"
              formatY={(n) => `${n} sipariş`}
              emptyLabel="Günlük sipariş trendi"
            />
          </Card>

          <Card padding="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Sipariş yoğunluk haritası</h2>
              <p className="text-[12px] text-gri-700">
                Hangi gün-saatte sipariş geliyor
              </p>
            </div>
            {aggregateOrderCount >= 50 ? (
              <HeatMap
                matrix={heatmapMatrix}
                emptyLabel="Bu aralıkta saatlik dağılım henüz oluşmadı"
              />
            ) : (
              <div className="h-[140px] flex items-center gap-3 text-gri-500 text-sm px-2">
                <Icon.Info size={24} className="text-gri-500 shrink-0" />
                <div>
                  <div className="font-medium">Saatlik yoğunluk haritası</div>
                  <div className="text-[12px]">
                    50+ sipariş sonrası aktif ({aggregateOrderCount}/50)
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Top customers + Top cities + Status bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {showFinancials && (
          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Top müşteriler</h2>
              <Link
                href="/admin/musteriler"
                className="text-[12px] font-semibold text-pim-mercan hover:underline"
              >
                Tümü →
              </Link>
            </div>
            {tops.length === 0 ? (
              <div className="p-6 text-center text-[12.5px] text-gri-500 italic">
                Sipariş geldikçe top liste oluşacak
              </div>
            ) : (
              <ul className="divide-y divide-gri-100">
                {tops.map((c, i) => {
                  const isVip = c.orderCount >= 3;
                  return (
                    <li key={i} className="px-5 py-3 flex items-center gap-3">
                      <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan-tint text-pim-mercan text-[12px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13px] truncate flex items-center gap-1.5">
                          {c.name}
                          {isVip && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 h-[16px] rounded-full bg-sari-soft text-sari-koyu text-[9.5px] font-bold uppercase tracking-[0.04em] shrink-0"
                              title={`VIP — ${c.orderCount} sipariş`}
                            >
                              <Icon.Star size={9} /> VIP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gri-500 truncate tabular-nums">
                          {c.orderCount} sipariş · {timeAgo(c.lastOrderAt)}
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-yesil tabular-nums shrink-0">
                        {formatCurrency(c.totalRevenue)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          )}

          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200">
              <h2 className="text-[15px] font-semibold">Top şehirler</h2>
            </div>
            {aggregateOrderCount >= 30 ? (
              cities.length === 0 ? (
              <div className="p-6 text-center text-[12.5px] text-gri-500 italic">
                Coğrafi dağılım için sipariş bekleniyor
              </div>
            ) : (
              <ul className="divide-y divide-gri-100">
                {cities.map((c, i) => {
                  const max = cities[0].count;
                  const pct = (c.count / max) * 100;
                  return (
                    <li key={i} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-[13px]">
                          {c.city}
                        </span>
                        <span className="text-[12px] tabular-nums text-gri-700">
                          <span className="font-semibold text-lacivert">
                            {c.count}
                          </span>
                          {showFinancials && (
                            <> · {formatCurrency(c.revenue)}</>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gri-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pim-mercan rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
            ) : (
              <div className="p-6 flex items-center gap-3 text-gri-500 text-sm">
                <Icon.Info size={24} className="text-gri-500 shrink-0" />
                <div>
                  <div className="font-medium">Şehir dağılımı</div>
                  <div className="text-[12px]">
                    30+ sipariş sonrası aktif ({aggregateOrderCount}/30)
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Durum dağılımı</h2>
            <BarChart
              bars={statusBars}
              height={180}
              emptyLabel="Sipariş geldikçe dağılım gözükür"
            />
          </Card>
        </div>

        {/* Recent orders */}
        <Card padding="p-0">
          <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Son siparişler</h2>
            <Link
              href="/admin/siparisler"
              className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
            >
              Tümü →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-10 text-center">
              <Icon.Box size={36} className="text-gri-500 mx-auto mb-2" />
              <div className="font-semibold text-[14px] mb-1">
                Henüz sipariş yok
              </div>
              <div className="text-[12px] text-gri-700">
                Müşteriler sipariş verdikçe burada görünür.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gri-100">
              {recent.map((o) => {
                const meta = getAdminStatusMeta(o.status);
                const title =
                  o.items.length === 1
                    ? `${o.address.name} — ${o.items[0].product === "sticker" ? "sticker" : "etiket"} × ${o.items[0].qty.toLocaleString("tr-TR")}`
                    : `${o.address.name} — ${o.items.length} ürün`;
                return (
                  <Link
                    key={o.id}
                    href={`/admin/siparisler/${o.id}`}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-gri-50 transition-colors"
                  >
                    <span
                      className={cn(
                        "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-semibold shrink-0",
                        meta.bg,
                        meta.color
                      )}
                    >
                      {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] truncate">
                        {title}
                      </div>
                      <div className="text-[11px] text-gri-700 mt-0.5">
                        <span className="font-mono">{o.id}</span> ·{" "}
                        {timeAgo(o.createdAt)}
                        {showFinancials && (
                          <> · {formatCurrency(o.total)}</>
                        )}
                      </div>
                    </div>
                    <Icon.ChevR size={12} className="text-gri-500 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {activityFeed.length > 0 && (
          <Card padding="p-0" className="mt-6">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Son 24 saat</h2>
              <Link
                href="/admin/siparisler"
                className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                Tümünü gör →
              </Link>
            </div>
            <ul className="divide-y divide-gri-100">
              {activityFeed.map((ev, i) => {
                const indicator =
                  EVENT_INDICATOR[ev.type] ?? ({ dot: "gri" } as EventIndicator);
                const time = new Date(ev.createdAt).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li
                    key={`${ev.createdAt}-${i}`}
                    className="px-5 py-2.5 text-[13px] flex items-start gap-2"
                  >
                    <EventIndicatorIcon indicator={indicator} />
                    <span className="text-gri-500 tabular-nums shrink-0 w-12">
                      {time}
                    </span>
                    <span className="text-lacivert flex-1 min-w-0">
                      {ev.summary}
                      {ev.orderId && (
                        <Link
                          href={`/admin/siparisler/${ev.orderId}`}
                          className="text-pim-mercan hover:underline ml-1 font-mono text-[11px]"
                        >
                          #{ev.orderId.slice(-8)}
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
          </>
        )}
      </div>
    </main>
  );
}
