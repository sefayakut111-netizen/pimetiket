/**
 * Pim Etiket — /siparislerim (E.2.2)
 *
 * Tüm siparişler — filtre + search + tablo/kart liste.
 * Mock data; gerçek API I adımında.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import {
  listCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";

// Müşteri view: ödeme öncesi state'leri (paid/qc_*) tek "kontrolde"
// olarak gösterilir, daha basit. Admin daha granuler görür.
type CustomerStatus =
  | "qc_pending"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

interface Order {
  id: string;
  date: string;
  title: string;
  qty: number;
  total: number;
  status: CustomerStatus;
}

/** Backend OrderStatus → customer-friendly bucket. */
function toCustomerStatus(s: OrderStatus): CustomerStatus {
  switch (s) {
    case "paid":
    case "qc_pending":
    case "qc_flagged":
    case "operator_review":
    case "proof_pending":
      return "qc_pending";
    case "in_production":
      return "in_production";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
}

/** CustomerOrder → list view row */
function toOrderRow(o: CustomerOrder): Order {
  const title =
    o.items.length === 1
      ? o.items[0].title
      : `${o.items.length} ürünlük sipariş`;
  const totalQty = o.items.reduce((sum, i) => sum + i.qty, 0);
  const date = new Date(o.createdAtIso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return {
    id: o.id,
    date,
    title,
    qty: totalQty,
    total: o.total,
    status: toCustomerStatus(o.status),
  };
}

const STATUS_META: Record<
  CustomerStatus,
  { label: string; color: string; bg: string }
> = {
  qc_pending: {
    label: "Kontrolde",
    color: "text-sari",
    bg: "bg-sari-soft",
  },
  in_production: {
    label: "Üretimde",
    color: "text-pim-mercan",
    bg: "bg-pim-mercan-tint",
  },
  shipped: {
    label: "Kargoda",
    color: "text-lacivert",
    bg: "bg-gri-100",
  },
  delivered: {
    label: "Teslim edildi",
    color: "text-yesil",
    bg: "bg-yesil-soft",
  },
  cancelled: {
    label: "İptal",
    color: "text-kirmizi",
    bg: "bg-gri-100",
  },
};

const FILTER_OPTIONS: { id: CustomerStatus | "all"; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "qc_pending", label: "Kontrolde" },
  { id: "in_production", label: "Üretimde" },
  { id: "shipped", label: "Kargoda" },
  { id: "delivered", label: "Teslim edildi" },
  { id: "cancelled", label: "İptal" },
];

// Type re-export — gelecek import'lar için (lib/order.ts kanonik)
export type { OrderStatus };

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function SiparislerimPage() {
  const [filter, setFilter] = useState<CustomerStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () =>
      setOrders(listCustomerOrders().map(toOrderRow));
    refresh();
    setHydrated(true);
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (search.length > 0) {
        const q = search.toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          o.title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, filter, search]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Hesabım</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Tüm siparişlerim
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {orders.length} sipariş — filtreleyerek bul, tekrar sipariş
              ver veya detayı incele.
            </p>
          </div>
          <Button variant="primary" size="lg" href="/etiket">
            <Icon.Plus size={16} /> Yeni sipariş
          </Button>
        </div>

        {/* Filters */}
        <Card padding="p-4" className="mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            {FILTER_OPTIONS.map((f) => (
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
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px]">
              <div className="relative">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sipariş ID veya isim ara…"
                  className="!h-11 !pl-10"
                />
                <Icon.Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gri-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Orders list */}
        {hydrated && orders.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Box size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Henüz siparişin yok
            </h3>
            <p className="text-base text-gri-700 mb-5">
              İlk siparişini ver — sonra burada görürsün.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={16} /> Etiket bastır
              </Button>
              <Button variant="secondary" size="lg" href="/sticker">
                <Icon.Sticker size={16} /> Sticker bastır
              </Button>
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Icon.Box size={48} className="text-gri-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Sonuç bulunamadı
            </h3>
            <p className="text-base text-gri-700 mb-5">
              Filtreyi gevşetmeyi veya arama metnini değiştirmeyi dene.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              Filtreyi sıfırla
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((o) => {
              const s = STATUS_META[o.status];
              return (
                <Card key={o.id} padding="p-5">
                  <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                          {o.id}
                        </span>
                        <span className="text-[11.5px] text-gri-500">·</span>
                        <span className="text-[11.5px] text-gri-500">
                          {o.date}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[12px] font-semibold",
                            s.bg,
                            s.color
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              s.color === "text-sari" && "bg-sari",
                              s.color === "text-pim-mercan" && "bg-pim-mercan",
                              s.color === "text-lacivert" && "bg-lacivert",
                              s.color === "text-yesil" && "bg-yesil",
                              s.color === "text-kirmizi" && "bg-kirmizi"
                            )}
                          />
                          {s.label}
                        </span>
                      </div>
                      <div className="font-semibold text-base mb-0.5 truncate">
                        {o.title}
                      </div>
                      <div className="text-[13px] text-gri-700">
                        {fmt(o.qty)} adet · {fmt(o.total)} TL
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {o.status === "delivered" && (
                        <Button variant="secondary" size="sm" href="/etiket">
                          Tekrar sipariş
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        href={`/siparis/${o.id}`}
                      >
                        Detay <Icon.ChevR size={12} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
