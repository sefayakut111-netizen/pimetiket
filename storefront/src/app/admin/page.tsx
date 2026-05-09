/**
 * Pim Etiket — /admin (E.3 Dashboard)
 *
 * Operatör/admin ana panel — gerçek customer-orders store'undan KPI üretir.
 * Backend swap'te (Block C) Medusa order API'sine bağlanır.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import type { OrderStatus } from "@/lib/order";

interface KpiAggregate {
  todayCount: number;
  aiFlagged: number;
  proofPending: number;
  productionPending: number;
}

function aggregateKpis(orders: CustomerOrder[]): KpiAggregate {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  let todayCount = 0;
  let aiFlagged = 0;
  let proofPending = 0;
  let productionPending = 0;
  for (const o of orders) {
    if (o.createdAt >= todayTs) todayCount++;
    if (o.status === "qc_flagged") aiFlagged++;
    if (o.status === "proof_pending") proofPending++;
    if (o.status === "paid" || o.status === "operator_review") {
      productionPending++;
    }
  }
  return { todayCount, aiFlagged, proofPending, productionPending };
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

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => setOrders(listCustomerOrders());
    refresh();
    setNow(new Date());
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const kpis = aggregateKpis(orders);
  const recent = orders.slice(0, 4);

  const KPIS = [
    {
      label: "Bugünkü siparişler",
      value: kpis.todayCount.toString(),
      sub:
        kpis.todayCount > 0
          ? `${kpis.todayCount} yeni iş`
          : "Henüz yeni iş yok",
      accent: "text-pim-mercan",
    },
    {
      label: "AI flag bekleyen",
      value: kpis.aiFlagged.toString(),
      sub:
        kpis.aiFlagged > 0
          ? "manuel kontrol gerek"
          : "kuyruk temiz",
      accent: kpis.aiFlagged > 0 ? "text-sari" : "text-gri-500",
    },
    {
      label: "Prova bekleyen",
      value: kpis.proofPending.toString(),
      sub: kpis.proofPending > 0 ? "müşteriden onay" : "—",
      accent: "text-lacivert",
    },
    {
      label: "Üretime alınacak",
      value: kpis.productionPending.toString(),
      sub: kpis.productionPending > 0 ? "atama yapılacak" : "—",
      accent: kpis.productionPending > 0 ? "text-yesil" : "text-gri-500",
    },
  ];

  const QUICK_LINKS = [
    {
      href: "/admin/siparisler",
      label: "Tüm siparişler",
      icon: <Icon.Box size={20} />,
      count: orders.length,
    },
    {
      href: "/admin/ai-qc",
      label: "AI QC kuyruğu",
      icon: <Icon.Sparkle size={20} />,
      count: kpis.aiFlagged,
      accent: kpis.aiFlagged > 0,
    },
    {
      href: "/admin/prova",
      label: "Prova üretim",
      icon: <Icon.Check size={20} />,
      count: kpis.proofPending,
    },
    {
      href: "/admin/fason",
      label: "Fason atama",
      icon: <Icon.Truck size={20} />,
      count: kpis.productionPending,
    },
  ];

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

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Header */}
        <div className="mb-7">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            {dateLabel}
          </div>
          <h1 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Operatör paneli
          </h1>
          <p className="mt-1 text-base text-gri-700">
            Bugün dikkat etmen gereken işler — özet aşağıda.
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {KPIS.map((k) => (
            <Card key={k.label} padding="p-5">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                {k.label}
              </div>
              <div
                className={cn(
                  "text-[36px] font-bold mt-1.5 leading-none tabular-nums",
                  k.accent
                )}
              >
                {k.value}
              </div>
              <div className="text-[12.5px] text-gri-700 mt-1.5">{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cn(
                "rounded-lg p-5 ring-1 transition-transform hover:-translate-y-0.5 shadow-1 flex items-center gap-4",
                q.accent
                  ? "bg-pim-mercan text-white ring-pim-mercan"
                  : "bg-white text-lacivert ring-gri-200"
              )}
            >
              <div
                className={cn(
                  "grid place-items-center w-11 h-11 rounded-xl shrink-0",
                  q.accent ? "bg-white/20" : "bg-pim-mercan-tint text-pim-mercan"
                )}
              >
                {q.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[15px]">{q.label}</div>
                <div
                  className={cn(
                    "text-[12.5px] mt-0.5",
                    q.accent ? "opacity-80" : "text-gri-700"
                  )}
                >
                  {q.count} {q.count === 1 ? "kayıt" : "kayıt"}
                </div>
              </div>
              <Icon.ArrowR size={16} />
            </Link>
          ))}
        </div>

        {/* 2-col main */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
          {/* Recent orders */}
          <Card padding="p-0">
            <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Son siparişler</h2>
              <Link
                href="/admin/siparisler"
                className="text-[13px] font-semibold text-pim-mercan hover:underline"
              >
                Tümünü gör →
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-10 text-center">
                <Icon.Box size={40} className="text-gri-500 mx-auto mb-3" />
                <div className="font-semibold mb-1">Henüz sipariş yok</div>
                <div className="text-[13px] text-gri-700">
                  Müşteriler sipariş verdikçe burada görünecek.
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
                      className="px-6 py-4 flex items-center gap-4 hover:bg-gri-50 transition-colors"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold shrink-0",
                          meta.bg,
                          meta.color
                        )}
                      >
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] truncate">
                          {title}
                        </div>
                        <div className="text-[12px] text-gri-700 mt-0.5">
                          <span className="font-mono">{o.id}</span> ·{" "}
                          {timeAgo(o.createdAt)}
                        </div>
                      </div>
                      <Icon.ChevR size={14} className="text-gri-500" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Today's tasks */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Bugünün ajandası</h2>
            <ul className="space-y-3">
              {[
                {
                  t: "AI flag'lenenleri kontrol et",
                  c: kpis.aiFlagged,
                  accent: "text-sari",
                },
                {
                  t: "Prova bekleyen siparişler",
                  c: kpis.proofPending,
                  accent: "text-lacivert",
                },
                {
                  t: "Fason atama yap",
                  c: kpis.productionPending,
                  accent: "text-yesil",
                },
                {
                  t: "Toplam aktif iş",
                  c: orders.filter(
                    (o) =>
                      o.status !== "delivered" && o.status !== "cancelled"
                  ).length,
                  accent: "text-pim-mercan",
                },
              ].map((task, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gri-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-pim-mercan shrink-0"
                    aria-label={task.t}
                  />
                  <div className="flex-1">
                    <div className="text-[14px] leading-snug">{task.t}</div>
                    <div
                      className={cn(
                        "text-[11.5px] font-semibold mt-0.5 tabular-nums",
                        task.accent
                      )}
                    >
                      {task.c} adet
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
