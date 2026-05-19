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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { LineChart, DonutChart, BarChart, HeatMap } from "@/components/charts";
import type { LinePoint, BarPoint } from "@/components/charts";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";
import {
  buildDailySeries,
  buildHeatmapMatrix,
  aggregateProductMix,
  aggregateStatus,
  topCustomers,
  topCities,
  operationalMetrics,
  generateInsights,
  formatHours,
  formatCurrency,
  formatShortDate,
} from "@/lib/admin-analytics";

type TimeRange = "today" | "7d" | "mtd" | "30d";

const RANGE_LABEL: Record<TimeRange, string> = {
  today: "Bugün",
  "7d": "7 gün",
  mtd: "Bu ay",
  "30d": "30 gün",
};

interface RangeWindow {
  start: number;
  /** Önceki periyot başlangıcı (kıyas için) */
  prevStart: number;
  /** Önceki periyot bitişi (default: start) — MTD için ayrı */
  prevEnd: number;
  /** Chart için günlük serisinin gün sayısı */
  days: number;
}

function getRangeWindow(range: TimeRange): RangeWindow {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (range === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return {
      start: startOfDay.getTime(),
      prevStart: startOfDay.getTime() - day,
      prevEnd: startOfDay.getTime(),
      days: 1,
    };
  }
  if (range === "7d") {
    return {
      start: now - 7 * day,
      prevStart: now - 14 * day,
      prevEnd: now - 7 * day,
      days: 7,
    };
  }
  if (range === "mtd") {
    // Bu ayın 1'i 00:00 → şu an
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
    const elapsedMs = now - startOfMonth.getTime();
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / day));
    // Önceki ayın aynı süresi (1'den elapsedDays'e kadar)
    const prevEnd = startOfPrevMonth.getTime() + elapsedMs;
    return {
      start: startOfMonth.getTime(),
      prevStart: startOfPrevMonth.getTime(),
      prevEnd,
      days: elapsedDays,
    };
  }
  return {
    start: now - 30 * day,
    prevStart: now - 60 * day,
    prevEnd: now - 30 * day,
    days: 30,
  };
}

interface AlertItem {
  id: string;
  level: "critical" | "warn" | "info";
  message: string;
  href: string;
  cta: string;
}

function detectAlerts(orders: CustomerOrder[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const stuckAi = orders.filter(
    (o) => o.status === "qc_flagged" && now - o.createdAt > day
  );
  if (stuckAi.length > 0) {
    alerts.push({
      id: "stuck-ai",
      level: "critical",
      message: `${stuckAi.length} sipariş 24 saatten uzun süredir AI flag'inde — incele`,
      href: "/admin/ai-qc",
      cta: "AI QC kuyruğu",
    });
  }

  const stuckProof = orders.filter(
    (o) => o.status === "proof_pending" && now - o.createdAt > 2 * day
  );
  if (stuckProof.length > 0) {
    alerts.push({
      id: "stuck-proof",
      level: "warn",
      message: `${stuckProof.length} müşteriden 48 saatten fazla prova yanıtı yok`,
      href: "/admin/prova",
      cta: "Prova listesi",
    });
  }

  const unassigned = orders.filter((o) => o.status === "paid").length;
  if (unassigned >= 5) {
    alerts.push({
      id: "unassigned",
      level: "warn",
      message: `${unassigned} ödenmiş sipariş henüz üretime atanmadı`,
      href: "/admin/fason",
      cta: "Fason atama",
    });
  }

  return alerts;
}

// ============================================================
// "Bugün ne yapmalıyım" — günün iş kuyruğu
// Alert strip = SLA patlamak üzere / Bugün widgetı = rutin iş listesi
// ============================================================
interface TodoItem {
  id: string;
  /** Sıra: küçük olan üstte. AI flag (1) > Operatör (2) > Prova geç yanıt (3)
   * > Fason atama (4) > Kargoya verilecek (5) > Yorum onayı (6) */
  priority: number;
  emoji: string;
  title: string;
  count: number;
  hint: string;
  href: string;
  urgent: boolean;
}

function buildTodoList(orders: CustomerOrder[]): TodoItem[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const items: TodoItem[] = [];

  const aiFlag = orders.filter((o) => o.status === "qc_flagged").length;
  if (aiFlag > 0) {
    items.push({
      id: "ai-flag",
      priority: 1,
      emoji: "🤖",
      title: "AI flag — manuel kontrol",
      count: aiFlag,
      hint: "AI tasarımı sorunlu buldu, sen karar ver",
      href: "/admin/ai-qc",
      urgent: aiFlag > 3,
    });
  }

  const operatorReview = orders.filter(
    (o) => o.status === "operator_review"
  ).length;
  if (operatorReview > 0) {
    items.push({
      id: "operator-review",
      priority: 2,
      emoji: "👀",
      title: "Operatör incelemesi",
      count: operatorReview,
      hint: "Tasarımı incele, prova hazırla",
      href: "/admin/siparisler?status=operator_review",
      urgent: false,
    });
  }

  const stuckProof = orders.filter(
    (o) => o.status === "proof_pending" && now - o.createdAt > 1.5 * day
  ).length;
  if (stuckProof > 0) {
    items.push({
      id: "stuck-proof",
      priority: 3,
      emoji: "⏰",
      title: "36+ saattir prova yanıtı yok",
      count: stuckProof,
      hint: "WhatsApp ile hatırlat",
      href: "/admin/prova",
      urgent: true,
    });
  }

  const unassigned = orders.filter((o) => o.status === "paid").length;
  if (unassigned > 0) {
    items.push({
      id: "unassigned",
      priority: 4,
      emoji: "🏭",
      title: "Üretime atanacak",
      count: unassigned,
      hint: "Fason ata + teslim tarihi belirle",
      href: "/admin/fason",
      urgent: unassigned >= 5,
    });
  }

  // Bugün kargoya verilecek: in_production + estimatedDelivery=bugün veya geçmiş
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const todayTs = today.getTime();
  const toShip = orders.filter(
    (o) =>
      o.status === "in_production" &&
      o.estimatedDelivery &&
      new Date(o.estimatedDelivery).getTime() <= todayTs
  ).length;
  if (toShip > 0) {
    items.push({
      id: "to-ship",
      priority: 5,
      emoji: "📦",
      title: "Bugün kargoya verilecek",
      count: toShip,
      hint: "Üretim tamamsa kargo tetikle",
      href: "/admin/siparisler?status=in_production",
      urgent: toShip > 0,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const STATUS_LABEL: Record<OrderStatus, { label: string; color: string; bg: string; hex: string }> = {
  paid: { label: "Yeni", color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#FF4D4F" },
  qc_pending: { label: "AI kontrol", color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#FF8585" },
  qc_flagged: { label: "AI flag", color: "text-sari-koyu", bg: "bg-sari-soft", hex: "#FFC53D" },
  operator_review: { label: "Operatör", color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#FFA39E" },
  // Sefa 19 May v68 (DB↔TS sync): 5 yeni statü
  human_review: { label: "İnsan inceleme", color: "text-pim-mercan", bg: "bg-pim-mercan-tint", hex: "#FFA39E" },
  human_review_failed: { label: "Düzeltme iste", color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft", hex: "#CF1322" },
  proof_generating: { label: "Prova hazırlanıyor", color: "text-lacivert", bg: "bg-gri-100", hex: "#94A3B8" },
  proof_pending: { label: "Prova", color: "text-lacivert", bg: "bg-gri-100", hex: "#1F2A4D" },
  ready_to_ship: { label: "Üretime hazır", color: "text-mavi-koyu", bg: "bg-mavi-soft", hex: "#1D4ED8" },
  fason_assigned: { label: "Fasona atandı", color: "text-mavi-koyu", bg: "bg-mavi-soft", hex: "#2563EB" },
  in_production: { label: "Üretimde", color: "text-yesil", bg: "bg-yesil-soft", hex: "#52C41A" },
  shipped: { label: "Kargoda", color: "text-lacivert", bg: "bg-gri-100", hex: "#597EF7" },
  delivered: { label: "Teslim", color: "text-yesil", bg: "bg-yesil-soft", hex: "#389E0D" },
  cancelled: { label: "İptal", color: "text-kirmizi", bg: "bg-gri-100", hex: "#CF1322" },
};

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

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [range, setRange] = useState<TimeRange>("7d");
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [funnelMetrics, setFunnelMetrics] = useState<Record<string, FunnelMetric>>({});
  const [auditorPending, setAuditorPending] = useState<{
    critical: number;
    warning: number;
    total: number;
  }>({ critical: 0, warning: 0, total: 0 });

  useEffect(() => {
    const refresh = () => {
      setOrders(listCustomerOrders());
      setLastUpdate(Date.now());
    };
    refresh();
    setNow(new Date());
    // Müşteri istatistiklerini çek (auth.users + profiles)
    fetch("/api/admin/customer-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CustomerStats | null) => data && setCustomerStats(data))
      .catch(() => {
        /* silently — endpoint yoksa eski davranış */
      });
    // Funnel ortalama bekleme süreleri
    fetch("/api/admin/funnel-metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { metrics?: Record<string, FunnelMetric> } | null) => {
        if (data?.metrics) setFunnelMetrics(data.metrics);
      })
      .catch(() => {
        /* silently */
      });
    // Auditor pending action sayımı (üst alert strip için)
    fetch("/api/admin/auditors")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          ok?: boolean;
          pending?: { criticalPending: number; warningPending: number; totalPending: number };
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
      .catch(() => {
        /* silently */
      });
    const w = globalThis.window;
    w.addEventListener("pim_customer_orders_updated", refresh);
    // 30 saniyede bir auto refresh ("last update X sn önce" göstergesini canlı tutar)
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      w.removeEventListener("pim_customer_orders_updated", refresh);
      clearInterval(tick);
    };
  }, []);

  const rangeWindow = getRangeWindow(range);

  // Window içindeki siparişler (KPI ve chart'lar bunu kullanır)
  const inRange = useMemo(
    () => orders.filter((o) => o.createdAt >= rangeWindow.start),
    [orders, rangeWindow.start]
  );
  const inPrevRange = useMemo(
    () =>
      orders.filter(
        (o) => o.createdAt >= rangeWindow.prevStart && o.createdAt < rangeWindow.prevEnd
      ),
    [orders, rangeWindow.prevStart, rangeWindow.prevEnd]
  );

  // KPI hesaplamaları
  const count = inRange.length;
  const prevCount = inPrevRange.length;
  const revenue = inRange.reduce((s, o) => s + o.total, 0);
  const prevRevenue = inPrevRange.reduce((s, o) => s + o.total, 0);
  const aov = count > 0 ? revenue / count : 0;
  const aiFlagged = orders.filter((o) => o.status === "qc_flagged").length;
  const proofPending = orders.filter((o) => o.status === "proof_pending").length;
  const productionPending = orders.filter(
    (o) => o.status === "paid" || o.status === "operator_review"
  ).length;

  const countChange = formatChange(count, prevCount);
  const revenueChange = formatChange(revenue, prevRevenue);

  const alerts = useMemo(() => {
    const baseAlerts = detectAlerts(orders);
    // Auditor pending action varsa en üste ekle
    if (auditorPending.total > 0) {
      baseAlerts.unshift({
        id: "auditor-pending",
        level: auditorPending.critical > 0 ? "critical" : "warn",
        message:
          auditorPending.critical > 0
            ? `🔴 ${auditorPending.critical} kritik denetçi aksiyonu onayını bekliyor`
            : `🟡 ${auditorPending.total} denetçi aksiyonu onayını bekliyor`,
        href: "/admin/denetciler/bekleyen",
        cta: "Onay paneli",
      });
    }
    return baseAlerts;
  }, [orders, auditorPending]);
  const todoList = useMemo(() => buildTodoList(orders), [orders]);

  // Chart datası — daima rangeWindow.days kullan
  const dailySeries = useMemo(
    () => buildDailySeries(orders, rangeWindow.days),
    [orders, rangeWindow.days]
  );
  const revenueSeries: LinePoint[] = dailySeries.map((d) => ({
    x: formatShortDate(d.date),
    y: d.revenue,
  }));
  const orderSeries: LinePoint[] = dailySeries.map((d) => ({
    x: formatShortDate(d.date),
    y: d.count,
  }));

  const productMix = useMemo(() => aggregateProductMix(inRange), [inRange]);
  const statusDistribution = useMemo(() => aggregateStatus(orders), [orders]);
  const heatmapMatrix = useMemo(() => buildHeatmapMatrix(orders), [orders]);
  const tops = useMemo(() => topCustomers(orders, 5), [orders]);
  const cities = useMemo(() => topCities(orders, 5), [orders]);
  const ops = useMemo(() => operationalMetrics(orders), [orders]);
  const insights = useMemo(() => generateInsights(orders), [orders]);

  const recent = orders.slice(0, 5);

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

  // KPI cards
  const KPIS = [
    {
      label: `${RANGE_LABEL[range]} ciro`,
      value: formatCurrency(revenue),
      sub: revenueChange.label,
      trend: revenueChange.trend,
      accent: "text-yesil",
    },
    {
      label: `${RANGE_LABEL[range]} sipariş`,
      value: count.toString(),
      sub: countChange.label,
      trend: countChange.trend,
      accent: "text-pim-mercan",
    },
    {
      label: "Sepet ortalaması",
      value: aov > 0 ? formatCurrency(aov) : "—",
      sub: count > 0 ? `${count} sipariş bazlı` : "veri yok",
      trend: "flat" as const,
      accent: "text-lacivert",
    },
    {
      label: "AI flag bekleyen",
      value: aiFlagged.toString(),
      sub: aiFlagged > 0 ? "manuel kontrol" : "kuyruk temiz",
      trend: "flat" as const,
      accent: aiFlagged > 0 ? "text-sari-koyu" : "text-gri-500",
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

  // Production funnel — 7 step
  const funnel = [
    { status: "paid" as OrderStatus, label: "Yeni", count: statusDistribution.paid, href: "/admin/siparisler?status=paid" },
    { status: "qc_pending" as OrderStatus, label: "AI kontrol", count: statusDistribution.qc_pending, href: "/admin/siparisler?status=qc_pending" },
    { status: "operator_review" as OrderStatus, label: "Operatör", count: statusDistribution.operator_review, href: "/admin/siparisler?status=operator_review" },
    { status: "proof_pending" as OrderStatus, label: "Prova", count: statusDistribution.proof_pending, href: "/admin/prova" },
    { status: "in_production" as OrderStatus, label: "Üretimde", count: statusDistribution.in_production, href: "/admin/fason" },
    { status: "shipped" as OrderStatus, label: "Kargoda", count: statusDistribution.shipped, href: "/admin/siparisler?status=shipped" },
    { status: "delivered" as OrderStatus, label: "Teslim", count: statusDistribution.delivered, href: "/admin/siparisler?status=delivered" },
  ];
  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);

  // Quick actions
  const QUICK_ACTIONS = [
    { href: "/admin/siparis-ekle", label: "Manuel sipariş", desc: "Telefon / WhatsApp", icon: <Icon.Plus size={18} />, accent: true },
    { href: "/admin/fiyat-hesapla", label: "Hızlı teklif", desc: "Etiket/sticker", icon: <Icon.Bolt size={18} /> },
    { href: "/admin/kuponlar", label: "Kupon ekle", desc: "İndirim kodu", icon: <Icon.Sparkle size={18} /> },
    { href: "/admin/yorumlar", label: "Yorum onayı", desc: "Bekleyen review", icon: <Icon.Star size={18} /> },
  ];

  // Status distribution as horizontal bar
  const statusBars: BarPoint[] = (Object.keys(statusDistribution) as OrderStatus[])
    .filter((s) => statusDistribution[s] > 0)
    .map((s) => ({
      label: STATUS_LABEL[s].label,
      value: statusDistribution[s],
      color: STATUS_LABEL[s].hex,
    }));

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[1320px] px-6">
        {/* Header — sidebar topbar zaten "Operatör paneli" gösteriyor, burada özet */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              {dateLabel}
            </div>
            <p className="mt-1 text-[13.5px] text-gri-700 flex items-center gap-1.5">
              Tüm metrikler — son güncelleme {updateAgoLabel}
              <span className="inline-flex w-1.5 h-1.5 rounded-full bg-yesil animate-pulse" />
            </p>
          </div>

          <div className="bg-white rounded-full ring-1 ring-gri-200 p-1 inline-flex gap-1 shrink-0">
            {(Object.keys(RANGE_LABEL) as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "h-8 px-3.5 rounded-full text-[12.5px] font-semibold transition-colors",
                  range === r
                    ? "bg-lacivert text-white"
                    : "text-gri-700 hover:text-lacivert"
                )}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Alert strip */}
        {alerts.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alerts.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className={cn(
                  "rounded-xl px-5 py-3.5 ring-1 flex items-center gap-3 text-[13.5px] hover:shadow-1 transition-shadow",
                  a.level === "critical"
                    ? "bg-kirmizi/5 ring-kirmizi/20 text-kirmizi"
                    : a.level === "warn"
                      ? "bg-sari-soft ring-sari/30 text-lacivert"
                      : "bg-pim-mercan-tint ring-pim-mercan/20 text-pim-mercan"
                )}
              >
                <span
                  className={cn(
                    "inline-flex w-2 h-2 rounded-full shrink-0",
                    a.level === "critical"
                      ? "bg-kirmizi animate-pulse"
                      : a.level === "warn"
                        ? "bg-sari"
                        : "bg-pim-mercan"
                  )}
                />
                <span className="flex-1 font-semibold">{a.message}</span>
                <span className="text-[12px] font-bold flex items-center gap-1">
                  {a.cta} <Icon.ArrowR size={14} />
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* "Bugün ne yapmalıyım" — günün iş kuyruğu */}
        {todoList.length > 0 && (
          <Card padding="p-0" className="mb-6 ring-1 ring-pim-mercan/15">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between bg-pim-mercan-tint">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">☀️</span>
                <div>
                  <h2 className="text-[15px] font-semibold text-pim-mercan">
                    Bugün ne yapmalıyım?
                  </h2>
                  <p className="text-[11.5px] text-pim-mercan/80">
                    {todoList.length} sıradaki iş — sırayla bitirince hat boş
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-pim-mercan bg-white rounded-full h-7 min-w-7 px-2.5 grid place-items-center">
                {todoList.reduce((s, t) => s + t.count, 0)}
              </span>
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
                  <span className="text-[22px] shrink-0">{t.emoji}</span>
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
              <span className="text-[28px]">🎉</span>
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

        {/* KPI grid 6 cards — Sefa 18 May v68 (admin UX denetim):
            1400px ekran sınırında 6 kart yan yana sığmıyordu, sağdaki kart
            kesiliyor + scrollbar belirmiyordu. auto-fit + minmax(180px,1fr)
            ile responsive: 6→4→3→2 düzeyinde otomatik kırılır. */}
        <div
          className="grid gap-3 mb-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
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
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-6">
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
              <h2 className="text-[15px] font-semibold">Üretim akışı</h2>
              <p className="text-[12px] text-gri-700">
                Her adımdaki aktif iş — tıklayarak detaya in
              </p>
            </div>
            <span className="text-[12px] text-gri-500">
              Toplam: {orders.length}
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {funnel.map((step, i) => {
                const intensity = step.count / maxFunnel;
                const metric = funnelMetrics[step.status];
                const hasMetric = metric && metric.sampleCount > 0;
                // Bekleme süresi yüksek mi? 24+ saat bekleyen aşamalar uyarı
                const slowWarning =
                  hasMetric && metric.avgSeconds > 24 * 3600;
                return (
                  <Link
                    key={step.status}
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
                    {/* Ortalama bekleme — sample varsa göster */}
                    <div
                      className={cn(
                        "mt-1.5 text-[10.5px] tabular-nums flex items-center gap-1",
                        slowWarning
                          ? "text-sari-koyu font-semibold"
                          : "text-gri-500"
                      )}
                      title={
                        hasMetric
                          ? `${metric.sampleCount} sipariş örnekleminden ortalama`
                          : "Henüz veri yok"
                      }
                    >
                      <span className="opacity-70">⏱</span>
                      {hasMetric ? formatDuration(metric.avgSeconds) : "—"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Operational metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              AI flag oranı
            </div>
            <div className={cn(
              "text-[22px] font-bold mt-1 tabular-nums",
              ops.aiFlagRate > 30 ? "text-kirmizi" : ops.aiFlagRate > 0 ? "text-sari-koyu" : "text-gri-500"
            )}>
              {orders.length > 0 ? `%${ops.aiFlagRate.toFixed(0)}` : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {orders.length > 0 ? "hedef <%10" : "veri yok"}
            </div>
          </Card>

          <Card padding="p-4">
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

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              İptal oranı
            </div>
            <div className={cn(
              "text-[22px] font-bold mt-1 tabular-nums",
              ops.cancelRate > 15 ? "text-kirmizi" : ops.cancelRate > 0 ? "text-sari-koyu" : "text-gri-500"
            )}>
              {orders.length > 0 ? `%${ops.cancelRate.toFixed(0)}` : "—"}
            </div>
            <div className="text-[11px] text-gri-700 mt-1">
              {orders.length > 0 ? "hedef <%5" : "veri yok"}
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              {customerStats ? "Yeni kayıt (7g)" : "Tekrar müşteri"}
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
        {customerStats !== null && customerStats.total > 0 && (
          <Card padding="p-5" className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Üyelik istatistikleri</h2>
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
          </Card>
        )}

        {/* AI insights + Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6">
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

          <div className="grid grid-cols-2 gap-3 content-start">
            {QUICK_ACTIONS.map((q) => (
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
            ))}
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
            <HeatMap
              matrix={heatmapMatrix}
              emptyLabel="Yeterli sipariş gelince saatlik dağılım açılır"
            />
          </Card>
        </div>

        {/* Top customers + Top cities + Status bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
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

          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200">
              <h2 className="text-[15px] font-semibold">Top şehirler</h2>
            </div>
            {cities.length === 0 ? (
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
                          </span>{" "}
                          · {formatCurrency(c.revenue)}
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
                const meta = STATUS_LABEL[o.status];
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
                        {timeAgo(o.createdAt)} · {formatCurrency(o.total)}
                      </div>
                    </div>
                    <Icon.ChevR size={12} className="text-gri-500 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
