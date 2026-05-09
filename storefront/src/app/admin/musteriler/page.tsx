/**
 * Pim Etiket — /admin/musteriler
 *
 * CRM: customer-orders'tan unique müşterileri çıkarır.
 * Her müşteri için: ad, email, telefon (adres'ten), sipariş sayısı,
 * toplam ciro, son sipariş tarihi, ortalama sipariş değeri.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

interface CustomerProfile {
  /** Email yoksa name olarak kullanılır (auth gelene kadar) */
  key: string;
  name: string;
  phone: string;
  city: string;
  orderCount: number;
  totalRevenue: number;
  avgOrder: number;
  lastOrderAt: number;
  lastOrderId: string;
  /** Aktif (delivered/cancelled hariç) sipariş sayısı */
  activeOrders: number;
}

function aggregateCustomers(orders: CustomerOrder[]): CustomerProfile[] {
  const map = new Map<string, CustomerProfile>();
  for (const o of orders) {
    const key = `${o.address.name.trim().toLowerCase()}|${o.address.phone}`;
    const existing = map.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalRevenue += o.total;
      if (o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
        existing.lastOrderId = o.id;
      }
      if (o.status !== "delivered" && o.status !== "cancelled") {
        existing.activeOrders += 1;
      }
    } else {
      map.set(key, {
        key,
        name: o.address.name,
        phone: o.address.phone,
        city: o.address.city,
        orderCount: 1,
        totalRevenue: o.total,
        avgOrder: o.total,
        lastOrderAt: o.createdAt,
        lastOrderId: o.id,
        activeOrders:
          o.status !== "delivered" && o.status !== "cancelled" ? 1 : 0,
      });
    }
  }
  for (const c of map.values()) {
    c.avgOrder = c.totalRevenue / c.orderCount;
  }
  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

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
    year: "numeric",
  });
}

export default function AdminMusterilerPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const refresh = () => {
      const orders = listCustomerOrders();
      setCustomers(aggregateCustomers(orders));
    };
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [customers, search]);

  // KPI'lar
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.totalRevenue, 0);
  const repeat = customers.filter((c) => c.orderCount > 1).length;
  const repeatRate =
    totalCustomers > 0 ? Math.round((repeat / totalCustomers) * 100) : 0;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6">
          <Eyebrow>CRM</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Müşteriler
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {totalCustomers} müşteri · {repeat} tekrar eden ({repeatRate}%) ·{" "}
            {fmt(totalRevenue)} TL toplam ciro
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Toplam müşteri", value: totalCustomers, accent: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
            { label: "Tekrar eden", value: `${repeat} (${repeatRate}%)`, accent: "text-yesil", bg: "bg-yesil-soft" },
            { label: "Toplam ciro", value: `${fmt(totalRevenue)} TL`, accent: "text-lacivert", bg: "bg-gri-100" },
            {
              label: "Ortalama sepet",
              value: totalCustomers > 0 ? `${fmt(totalRevenue / customers.reduce((s, c) => s + c.orderCount, 0))} TL` : "—",
              accent: "text-turuncu",
              bg: "bg-krem",
            },
          ].map((k) => (
            <Card key={k.label} padding="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("grid place-items-center w-10 h-10 rounded-xl shrink-0", k.bg, k.accent)}>
                  <Icon.User size={16} />
                </div>
                <div>
                  <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                    {k.label}
                  </div>
                  <div className={cn("text-2xl font-bold tabular-nums", k.accent)}>
                    {k.value}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search */}
        <Card padding="p-4" className="mb-5">
          <div className="relative">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim, telefon, şehir ara…"
              className="!h-11 !pl-10"
            />
            <Icon.Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
            />
          </div>
        </Card>

        {/* Table */}
        {filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold">
              {customers.length === 0
                ? "Henüz müşteri yok"
                : "Bu aramada sonuç yok"}
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              {customers.length === 0
                ? "Müşteriler sipariş verdikçe burada görünecek."
                : "Arama metnini değiştirmeyi dene."}
            </p>
          </Card>
        ) : (
          <Card padding="p-0" className="overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="border-b border-gri-200 bg-gri-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Müşteri
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Şehir
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                    Sipariş
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                    Ciro
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 text-right">
                    Ort. sepet
                  </th>
                  <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                    Son sipariş
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gri-100">
                {filtered.map((c) => (
                  <tr key={c.key} className="hover:bg-gri-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-lacivert">
                        {c.name}
                      </div>
                      <div className="text-[12px] text-gri-500">
                        {c.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gri-700">{c.city}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold">{c.orderCount}</span>
                      {c.activeOrders > 0 && (
                        <span className="ml-1.5 inline-flex items-center h-[20px] px-1.5 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10px] font-bold">
                          {c.activeOrders} aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {fmt(c.totalRevenue)} TL
                    </td>
                    <td className="px-4 py-3 text-right text-gri-700 tabular-nums">
                      {fmt(c.avgOrder)} TL
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-gri-700">
                      <Link
                        href={`/siparis/${c.lastOrderId}`}
                        className="font-mono text-pim-mercan hover:underline"
                      >
                        {c.lastOrderId}
                      </Link>
                      <div className="text-[11px] text-gri-500 mt-0.5">
                        {timeAgo(c.lastOrderAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm">
                        Detay <Icon.ChevR size={12} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </main>
  );
}
