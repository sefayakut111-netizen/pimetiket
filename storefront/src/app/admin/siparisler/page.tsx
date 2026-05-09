/**
 * Pim Etiket — /admin/siparisler (E.3)
 *
 * Tüm siparişler — tablo görünümü, filtre, search, durum güncelleme.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";

// Admin tüm 9 OrderStatus'u görür (müşteri view'inde paid/qc_pending
// "Kontrolde" tek başlığa indirgeniyor; admin granuler kalıyor).
type AdminStatus = OrderStatus;

interface AdminOrder {
  id: string;
  customer: string;
  product: string;
  qty: number;
  total: number;
  status: AdminStatus;
  date: string;
  fason?: string;
}

const STATUS_META: Record<AdminStatus, { label: string; color: string; bg: string }> = {
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

const FILTERS: { id: AdminStatus | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "paid", label: "Yeni" },
  { id: "qc_flagged", label: "AI flag (acil)" },
  { id: "operator_review", label: "Operatör" },
  { id: "proof_pending", label: "Prova" },
  { id: "in_production", label: "Üretim" },
  { id: "shipped", label: "Kargo" },
];

/** Tüm AdminStatus'lar — durum güncelleme dropdown'u için */
const ALL_STATUSES: AdminStatus[] = [
  "paid",
  "qc_pending",
  "qc_flagged",
  "operator_review",
  "proof_pending",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
];

/** CustomerOrder → AdminOrder row */
function toAdminOrderRow(o: CustomerOrder): AdminOrder {
  const product =
    o.items.length === 1
      ? `${o.items[0].product === "sticker" ? "Sticker" : "Etiket"} × ${o.items[0].qty.toLocaleString("tr-TR")}`
      : `${o.items.length} ürün`;
  const totalQty = o.items.reduce((sum, i) => sum + i.qty, 0);
  const date = new Date(o.createdAtIso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    id: o.id,
    customer: o.address.name,
    product,
    qty: totalQty,
    total: o.total,
    status: o.status,
    date,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function AdminSiparislerPage() {
  const [filter, setFilter] = useState<AdminStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    const refresh = () =>
      setOrders(listCustomerOrders().map(toAdminOrderRow));
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const handleStatusChange = (id: string, status: AdminStatus) => {
    updateCustomerOrderStatus(id, status);
    // Event listener refresh yapacak — manuel da tetikle (storage event gelmeden)
    setOrders(listCustomerOrders().map(toAdminOrderRow));
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (search.length > 0) {
        const q = search.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, filter, search]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[36px] font-semibold tracking-tight">
            Sipariş yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {orders.length} sipariş — filtrele ve durum güncelle
          </p>
        </div>

        {/* Filters */}
        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px] relative">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ID / müşteri / ürün ara…"
                className="!h-11 !pl-10"
              />
              <Icon.Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="border-b border-gri-200 bg-gri-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Sipariş
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Müşteri
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Ürün
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                  Tutar
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Durum
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Tarih
                </th>
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Durum güncelle
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gri-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Icon.Box size={48} className="text-gri-500 mx-auto mb-3" />
                    <div className="font-semibold mb-1">
                      {orders.length === 0
                        ? "Henüz sipariş yok"
                        : "Sonuç yok"}
                    </div>
                    <div className="text-gri-700">
                      {orders.length === 0
                        ? "Müşteriler sipariş verdikçe burada görünecek."
                        : "Filtreyi gevşet veya aramayı temizle."}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const s = STATUS_META[o.status];
                  return (
                    <tr key={o.id} className="hover:bg-gri-50">
                      <td className="px-4 py-3 font-mono text-[12.5px]">
                        {o.id}
                      </td>
                      <td className="px-4 py-3 font-semibold text-lacivert">
                        {o.customer}
                      </td>
                      <td className="px-4 py-3 text-gri-700">{o.product}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmt(o.total)} TL
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            s.bg,
                            s.color
                          )}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gri-700 text-[12.5px]">
                        {o.date}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            handleStatusChange(
                              o.id,
                              e.target.value as AdminStatus
                            )
                          }
                          aria-label={`${o.id} statüsü güncelle`}
                          className="h-8 px-2 pr-7 rounded-lg ring-1 ring-gri-200 bg-white text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan focus:ring-pim-mercan focus:outline-none"
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {STATUS_META[st].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/siparis/${o.id}`}
                          className="text-pim-mercan font-semibold hover:underline"
                        >
                          Detay →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </main>
  );
}
