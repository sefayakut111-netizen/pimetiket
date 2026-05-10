/**
 * Pim Etiket — /admin (E.3 Dashboard 2.0)
 *
 * Operatör/admin ana panel — gerçek customer-orders store'undan KPI üretir.
 * Veri yoksa boş gösterir (fake number YASAK — Sefa kuralı).
 *
 * Bölümler:
 *   1. Hero alert strip — SLA aşan / kuyrukta uzun bekleyen siparişler
 *   2. Time range toggle (bugün / 7g / 30g)
 *   3. KPI grid — 6 kart (sipariş / ciro / AOV / conversion / AI flag / prova)
 *   4. Production funnel — 7 adımlı yatay funnel
 *   5. Quick actions — 4 buton (manuel sipariş / kupon / fiyat / yorum)
 *   6. 3-col bottom — son sipariş + müşteri + yorum (mini)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

type TimeRange = "today" | "7d" | "30d";

interface KpiAggregate {
  count: number;
  prevCount: number;
  revenue: number;
  prevRevenue: number;
  aov: number;
  aiFlagged: number;
  proofPending: number;
  productionPending: number;
  inProduction: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

const RANGE_LABEL: Record<TimeRange, string> = {
  today: "Bugün",
  "7d": "7 gün",
  "30d": "30 gün",
};

function getRangeWindow(range: TimeRange): { start: number; prevStart: number } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (range === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return { start: startOfDay.getTime(), prevStart: startOfDay.getTime() - day };
  }
  if (range === "7d") return { start: now - 7 * day, prevStart: now - 14 * day };
  return { start: now - 30 * day, prevStart: now - 60 * day };
}

function aggregateKpis(orders: CustomerOrder[], range: TimeRange): KpiAggregate {
  const { start, prevStart } = getRangeWindow(range);
  let count = 0;
  let prevCount = 0;
  let revenue = 0;
  let prevRevenue = 0;
  let aiFlagged = 0;
  let proofPending = 0;
  let productionPending = 0;
  let inProduction = 0;
  let shipped = 0;
  let delivered = 0;
  let cancelled = 0;

  for (const o of orders) {
    if (o.createdAt >= start) {
      count++;
      revenue += o.total;
    } else if (o.createdAt >= prevStart) {
      prevCount++;
      prevRevenue += o.total;
    }
    // Bekleyen iş sayaçları (period bağımsız — şu anki kuyruğun resmi)
    if (o.status === "qc_flagged") aiFlagged++;
    if (o.status === "proof_pending") proofPending++;
    if (o.status === "paid" || o.status === "operator_review") productionPending++;
    if (o.status === "in_production") inProduction++;
    if (o.status === "shipped") shipped++;
    if (o.status === "delivered") delivered++;
    if (o.status === "cancelled") cancelled++;
  }

  const aov = count > 0 ? revenue / count : 0;
  return {
    count,
    prevCount,
    revenue,
    prevRevenue,
    aov,
    aiFlagged,
    proofPending,
    productionPending,
    inProduction,
    shipped,
    delivered,
    cancelled,
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

  // 1) AI kuyruğunda 24+ saat bekleyen flag
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

  // 2) Prova 48+ saat müşteri yanıt bekliyor
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

  // 3) Üretime atanmamış ödenmiş sipariş
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

const STATUS_LABEL: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Yeni", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_pending: { label: "AI kontrol", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_flagged: { label: "AI flag", color: "text-sari", bg: "bg-sari-soft" },
  operator_review: { label: "Operatör", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  proof_pending: { label: "Prova bekliyor", color: "text-lacivert", bg: "bg-gri-100" },
  in_production: { label: "Üretimde", color: "text-yesil", bg: "bg-yesil-soft" },
  shipped: { label: "Kargoda", color: "text-lacivert", bg: "bg-gri-100" },
  delivered: { label: "Teslim", color: "text-yesil", bg: "bg-yesil-soft" },
  cancelled: { label: "İptal", color: "text-kirmizi", bg: "bg-gri-100" },
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

function formatCurrency(n: number): string {
  if (n === 0) return "₺0";
  return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
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

interface FunnelStep {
  status: OrderStatus | "all";
  label: string;
  count: number;
  href: string;
}

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [range, setRange] = useState<TimeRange>("today");

  useEffect(() => {
    const refresh = () => setOrders(listCustomerOrders());
    refresh();
    setNow(new Date());
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const kpis = useMemo(() => aggregateKpis(orders, range), [orders, range]);
  const alerts = useMemo(() => detectAlerts(orders), [orders]);
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

  const countChange = formatChange(kpis.count, kpis.prevCount);
  const revenueChange = formatChange(kpis.revenue, kpis.prevRevenue);

  const KPIS = [
    {
      label: `${RANGE_LABEL[range]} sipariş`,
      value: kpis.count.toString(),
      sub: countChange.label,
      trend: countChange.trend,
      accent: "text-pim-mercan",
    },
    {
      label: `${RANGE_LABEL[range]} ciro`,
      value: formatCurrency(kpis.revenue),
      sub: revenueChange.label,
      trend: revenueChange.trend,
      accent: "text-yesil",
    },
    {
      label: "Sepet ortalaması",
      value: kpis.aov > 0 ? formatCurrency(kpis.aov) : "—",
      sub: kpis.count > 0 ? `${kpis.count} sipariş bazlı` : "veri yok",
      trend: "flat" as const,
      accent: "text-lacivert",
    },
    {
      label: "AI flag bekleyen",
      value: kpis.aiFlagged.toString(),
      sub: kpis.aiFlagged > 0 ? "manuel kontrol" : "kuyruk temiz",
      trend: "flat" as const,
      accent: kpis.aiFlagged > 0 ? "text-sari" : "text-gri-500",
    },
    {
      label: "Prova bekleyen",
      value: kpis.proofPending.toString(),
      sub: kpis.proofPending > 0 ? "müşteri yanıtı" : "—",
      trend: "flat" as const,
      accent: "text-lacivert",
    },
    {
      label: "Üretime alınacak",
      value: kpis.productionPending.toString(),
      sub: kpis.productionPending > 0 ? "atama yapılacak" : "—",
      trend: "flat" as const,
      accent: kpis.productionPending > 0 ? "text-yesil" : "text-gri-500",
    },
  ];

  // Production funnel: 7 adım, her adımda count + bekleme yoğunluğu
  const funnel: FunnelStep[] = [
    {
      status: "paid",
      label: "Yeni",
      count: orders.filter((o) => o.status === "paid").length,
      href: "/admin/siparisler?status=paid",
    },
    {
      status: "qc_pending",
      label: "AI kontrol",
      count: orders.filter((o) => o.status === "qc_pending").length,
      href: "/admin/siparisler?status=qc_pending",
    },
    {
      status: "operator_review",
      label: "Operatör",
      count: orders.filter((o) => o.status === "operator_review").length,
      href: "/admin/siparisler?status=operator_review",
    },
    {
      status: "proof_pending",
      label: "Prova",
      count: kpis.proofPending,
      href: "/admin/prova",
    },
    {
      status: "in_production",
      label: "Üretimde",
      count: kpis.inProduction,
      href: "/admin/fason",
    },
    {
      status: "shipped",
      label: "Kargoda",
      count: kpis.shipped,
      href: "/admin/siparisler?status=shipped",
    },
    {
      status: "delivered",
      label: "Teslim",
      count: kpis.delivered,
      href: "/admin/siparisler?status=delivered",
    },
  ];
  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);

  // Quick actions
  const QUICK_ACTIONS = [
    {
      href: "/admin/siparisler",
      label: "Tüm siparişler",
      desc: `${orders.length} kayıt`,
      icon: <Icon.Box size={18} />,
      tone: "white" as const,
    },
    {
      href: "/admin/fiyat-hesapla",
      label: "Hızlı teklif",
      desc: "Etiket/sticker fiyat",
      icon: <Icon.Bolt size={18} />,
      tone: "white" as const,
    },
    {
      href: "/admin/kuponlar",
      label: "Kupon ekle",
      desc: "İndirim kodu yarat",
      icon: <Icon.Plus size={18} />,
      tone: "white" as const,
    },
    {
      href: "/admin/yorumlar",
      label: "Yorum onayı",
      desc: "Bekleyen review",
      icon: <Icon.Star size={18} />,
      tone: "white" as const,
    },
  ];

  // Customer insights — şu an sadece sipariş tabanlı (auth user listesi henüz yok)
  const uniqueEmails = new Set(orders.map((o) => o.address.phone)); // phone proxy
  const repeatCustomers = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.address.phone] = (acc[o.address.phone] ?? 0) + 1;
    return acc;
  }, {});
  const repeatCount = Object.values(repeatCustomers).filter((c) => c > 1).length;
  const newCount = uniqueEmails.size - repeatCount;
  const vipCount = Object.values(repeatCustomers).filter((c) => c >= 3).length;

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              {dateLabel}
            </div>
            <h1 className="mt-2 text-[28px] md:text-[34px] font-semibold tracking-tight">
              Operatör paneli
            </h1>
            <p className="mt-1 text-[14.5px] text-gri-700">
              Bugün dikkat etmen gereken işler — özet aşağıda.
            </p>
          </div>

          {/* Time range toggle */}
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

        {/* KPI grid (6 cards) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {KPIS.map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 truncate">
                {k.label}
              </div>
              <div
                className={cn(
                  "text-[26px] font-bold mt-1 leading-none tabular-nums truncate",
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

        {/* Production funnel */}
        <Card padding="p-0" className="mb-6">
          <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold">Üretim akışı</h2>
              <p className="text-[12px] text-gri-700">
                Her adımdaki aktif iş — tıklayarak detaya in
              </p>
            </div>
            <span className="text-[12px] text-gri-500">
              Toplam: {orders.length}
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {funnel.map((step, i) => {
                const intensity = step.count / maxFunnel;
                return (
                  <Link
                    key={step.status}
                    href={step.href}
                    className="group relative bg-white ring-1 ring-gri-200 rounded-xl p-3 hover:ring-pim-mercan transition-all hover:-translate-y-0.5"
                  >
                    <div className="text-[10.5px] font-semibold text-gri-700 uppercase tracking-[0.03em] flex items-center gap-1">
                      <span className="grid place-items-center w-4 h-4 rounded-full bg-gri-100 text-[9px] font-bold">
                        {i + 1}
                      </span>
                      {step.label}
                    </div>
                    <div className="text-[22px] font-bold tabular-nums mt-1.5 text-lacivert">
                      {step.count}
                    </div>
                    {/* Intensity bar */}
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
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {QUICK_ACTIONS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="bg-white ring-1 ring-gri-200 rounded-xl p-4 hover:ring-pim-mercan hover:-translate-y-0.5 transition-all flex items-center gap-3 shadow-1"
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0">
                {q.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px] text-lacivert truncate">
                  {q.label}
                </div>
                <div className="text-[11.5px] text-gri-700 truncate">
                  {q.desc}
                </div>
              </div>
              <Icon.ArrowR size={14} className="text-gri-500 shrink-0" />
            </Link>
          ))}
        </div>

        {/* Bottom 3-col: recent orders + customer insights + recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
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
              <div className="p-8 text-center">
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
                      href={`/siparis/${o.id}`}
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

          {/* Customer insights */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Müşteri özeti</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gri-700">Toplam müşteri</span>
                <span className="text-[20px] font-bold text-lacivert tabular-nums">
                  {uniqueEmails.size}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gri-700">Yeni</span>
                <span className="text-[16px] font-semibold text-yesil tabular-nums">
                  {newCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gri-700">Tekrar eden</span>
                <span className="text-[16px] font-semibold text-pim-mercan tabular-nums">
                  {repeatCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gri-700 flex items-center gap-1">
                  VIP <Icon.Star size={11} className="text-sari" />
                </span>
                <span className="text-[16px] font-semibold text-sari tabular-nums">
                  {vipCount}
                </span>
              </div>
              <div className="pt-3 border-t border-gri-100">
                <Link
                  href="/admin/musteriler"
                  className="text-[12.5px] font-semibold text-pim-mercan hover:underline flex items-center gap-1"
                >
                  Müşteri listesi <Icon.ArrowR size={12} />
                </Link>
              </div>
            </div>
            {uniqueEmails.size === 0 && (
              <p className="text-[11.5px] text-gri-500 mt-3 italic">
                Sipariş geldikçe burası dolar.
              </p>
            )}
          </Card>

          {/* Status snapshot */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Durum özeti</h2>
            <div className="space-y-2">
              {[
                { label: "Aktif iş", count: orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length, color: "text-pim-mercan" },
                { label: "Üretimde", count: kpis.inProduction, color: "text-yesil" },
                { label: "Kargoda", count: kpis.shipped, color: "text-lacivert" },
                { label: "Teslim", count: kpis.delivered, color: "text-yesil" },
                { label: "İptal", count: kpis.cancelled, color: "text-kirmizi" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-[13px] text-gri-700">{row.label}</span>
                  <span
                    className={cn(
                      "text-[15px] font-semibold tabular-nums",
                      row.color
                    )}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
