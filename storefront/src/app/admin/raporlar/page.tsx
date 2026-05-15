/**
 * Pim Etiket — /admin/raporlar
 *
 * Analytics: customer-orders'tan ciro, popüler boyut/malzeme,
 * sticker vs etiket kırılımı, aylık trend.
 *
 * Pure SVG bar chart — Recharts dep eklemeden basit gösterim.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

interface MonthlyBucket {
  key: string; // "2026-05"
  label: string; // "May 2026"
  count: number;
  revenue: number;
}

function aggregateMonthly(orders: CustomerOrder[]): MonthlyBucket[] {
  const map = new Map<string, MonthlyBucket>();
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  for (const o of orders) {
    const dt = new Date(o.createdAtIso);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const label = `${months[dt.getMonth()]} ${dt.getFullYear()}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.revenue += o.total;
    } else {
      map.set(key, { key, label, count: 1, revenue: o.total });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function topSizes(orders: CustomerOrder[], limit = 5) {
  const map = new Map<string, { size: string; product: string; count: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      const key = `${item.product}-${item.width}x${item.height}`;
      const sizeKey = `${item.width}×${item.height} mm`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { size: sizeKey, product: item.product, count: 1 });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function productSplit(orders: CustomerOrder[]): { sticker: number; etiket: number } {
  let sticker = 0;
  let etiket = 0;
  for (const o of orders) {
    for (const item of o.items) {
      if (item.product === "sticker") sticker++;
      else etiket++;
    }
  }
  return { sticker, etiket };
}

export default function AdminRaporlarPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    const refresh = () => setOrders(listCustomerOrders());
    refresh();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const monthly = useMemo(() => aggregateMonthly(orders), [orders]);
  const sizes = useMemo(() => topSizes(orders), [orders]);
  const split = useMemo(() => productSplit(orders), [orders]);

  // KPI hesapları
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalQty = orders.reduce(
    (s, o) => s + o.items.reduce((s2, i) => s2 + i.qty, 0),
    0
  );
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const cancelRate =
    totalOrders > 0 ? Math.round((cancelled / totalOrders) * 100) : 0;

  // Bar chart için max
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);
  const maxCount = sizes[0]?.count ?? 1;

  const totalSplitItems = split.sticker + split.etiket;
  const stickerPct =
    totalSplitItems > 0 ? Math.round((split.sticker / totalSplitItems) * 100) : 0;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <Eyebrow>Analytics</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Raporlar
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {totalOrders} sipariş · {fmt(totalRevenue)} TL ciro · {fmt(totalQty)}{" "}
            adet basıldı
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Toplam ciro", value: `${fmt(totalRevenue)} TL`, accent: "text-pim-mercan" },
            { label: "Toplam sipariş", value: totalOrders, accent: "text-lacivert" },
            { label: "Ortalama sepet", value: `${fmt(avgOrder)} TL`, accent: "text-yesil" },
            { label: "İptal oranı", value: `%${cancelRate}`, accent: cancelRate > 5 ? "text-kirmizi" : "text-gri-700" },
          ].map((k) => (
            <Card key={k.label} padding="p-5">
              <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold">
                {k.label}
              </div>
              <div className={cn("text-[28px] font-bold tabular-nums mt-1.5 leading-none", k.accent)}>
                {k.value}
              </div>
            </Card>
          ))}
        </div>

        {orders.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={140} />
            <h3 className="mt-4 text-xl font-semibold">Henüz veri yok</h3>
            <p className="mt-2 text-base text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              Sipariş geldikçe rapor grafikleri canlanacak.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Aylık ciro grafiği */}
            <Card padding="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Aylık ciro trendi</h2>
                <span className="text-[12px] text-gri-500">
                  {monthly.length} ay
                </span>
              </div>
              <div className="flex items-end gap-2 h-48">
                {monthly.map((m) => {
                  const h = (m.revenue / maxRevenue) * 100;
                  return (
                    <div
                      key={m.key}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-pim-mercan to-pim-mercan-soft relative group"
                        style={{ height: `${h}%` }}
                        title={`${m.label}: ${fmt(m.revenue)} TL`}
                      >
                        <div className="absolute inset-x-0 -top-7 text-center text-[11px] font-semibold text-lacivert opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                          {fmt(m.revenue)}
                        </div>
                      </div>
                      <div className="text-[10px] text-gri-700 tabular-nums">
                        {m.label.split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Ürün split */}
            <Card padding="p-6">
              <h2 className="text-lg font-semibold mb-4">Ürün dağılımı</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-semibold flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-pim-mercan" />
                      Sticker
                    </span>
                    <span className="tabular-nums text-gri-700">
                      {split.sticker} satır · %{stickerPct}
                    </span>
                  </div>
                  <div className="h-3 bg-gri-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pim-mercan transition-all"
                      style={{ width: `${stickerPct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-semibold flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-lacivert" />
                      Etiket
                    </span>
                    <span className="tabular-nums text-gri-700">
                      {split.etiket} satır · %{100 - stickerPct}
                    </span>
                  </div>
                  <div className="h-3 bg-gri-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lacivert transition-all"
                      style={{ width: `${100 - stickerPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gri-200">
                <div className="text-[11.5px] uppercase tracking-[0.04em] text-gri-700 font-semibold mb-2">
                  Toplam basılan adet
                </div>
                <div className="text-[28px] font-bold tabular-nums">
                  {fmt(totalQty)}
                </div>
              </div>
            </Card>

            {/* Top sizes */}
            <Card padding="p-6" className="lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4">
                Popüler boyutlar (Top 5)
              </h2>
              {sizes.length === 0 ? (
                <p className="text-[13px] text-gri-500">Henüz veri yok</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {sizes.map((s, i) => {
                    const w = (s.count / maxCount) * 100;
                    return (
                      <div key={`${s.product}-${s.size}`}>
                        <div className="flex justify-between text-[13px] mb-1">
                          <span className="font-semibold flex items-center gap-2">
                            <span className="text-gri-500 w-4 text-right tabular-nums">
                              {i + 1}.
                            </span>
                            {s.size}
                            <span
                              className={cn(
                                "inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-bold uppercase",
                                s.product === "sticker"
                                  ? "bg-pim-mercan-tint text-pim-mercan"
                                  : "bg-krem text-lacivert"
                              )}
                            >
                              {s.product}
                            </span>
                          </span>
                          <span className="tabular-nums text-gri-700 font-semibold">
                            {s.count} sipariş
                          </span>
                        </div>
                        <div className="h-2 bg-gri-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              s.product === "sticker"
                                ? "bg-pim-mercan"
                                : "bg-lacivert"
                            )}
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 text-[12px] text-gri-500">
          <Icon.Info size={14} />
          <span>
            Bu raporlar şu anki demo verisi üzerinden hesaplanır. Backend
            swap&rsquo;tan sonra (Faz 1.2) gerçek DB query&rsquo;leri devreye girer.
          </span>
        </div>
      </div>
    </main>
  );
}
