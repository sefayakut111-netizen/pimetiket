/**
 * Pim Etiket — /siparislerim (E.2.2)
 *
 * Tüm siparişler — filtre + search + tablo/kart liste.
 * Mock data; gerçek API I adımında.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Pim } from "@/components/Pim";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { useT } from "@/lib/i18n/context";

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

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Tüm siparişlerim",
    subtitle: (n: number) =>
      `${n} sipariş — filtreleyerek bul, tekrar sipariş ver veya detayı incele.`,
    newOrder: "Yeni sipariş",
    searchPlaceholder: "Sipariş ID veya isim ara…",
    filterAll: "Tümü",
    statusQcPending: "Kontrolde",
    statusInProduction: "Üretimde",
    statusShipped: "Kargoda",
    statusDelivered: "Teslim edildi",
    statusCancelled: "İptal",
    emptyTitle: "Henüz siparişin yok",
    emptyDesc: "İlk siparişini ver — sonra burada görürsün.",
    printEtiket: "Etiket bastır",
    printSticker: "Sticker bastır",
    noResultsTitle: "Sonuç bulunamadı",
    noResultsDesc: "Filtreyi gevşetmeyi veya arama metnini değiştirmeyi dene.",
    resetFilter: "Filtreyi sıfırla",
    multiOrder: (n: number) => `${n} ürünlük sipariş`,
    pcs: "adet",
    currency: "TL",
    reorder: "Tekrar sipariş",
    detail: "Detay",
    locale: "tr-TR",
    dateFmt: { day: "numeric", month: "short", year: "numeric" } as const,
  },
  en: {
    eyebrow: "My account",
    title: "All my orders",
    subtitle: (n: number) =>
      `${n} order${n === 1 ? "" : "s"} — filter to find, reorder or view details.`,
    newOrder: "New order",
    searchPlaceholder: "Search order ID or name…",
    filterAll: "All",
    statusQcPending: "In review",
    statusInProduction: "In production",
    statusShipped: "In transit",
    statusDelivered: "Delivered",
    statusCancelled: "Cancelled",
    emptyTitle: "No orders yet",
    emptyDesc: "Place your first order — it will show up here.",
    printEtiket: "Print labels",
    printSticker: "Print stickers",
    noResultsTitle: "No results",
    noResultsDesc: "Try loosening the filter or changing the search text.",
    resetFilter: "Reset filter",
    multiOrder: (n: number) => `Order with ${n} items`,
    pcs: "units",
    currency: "TRY",
    reorder: "Reorder",
    detail: "Details",
    locale: "en-US",
    dateFmt: { day: "numeric", month: "short", year: "numeric" } as const,
  },
};

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

// Type re-export — gelecek import'lar için (lib/order.ts kanonik)
export type { OrderStatus };

export default function SiparislerimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const [filter, setFilter] = useState<CustomerStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const STATUS_META: Record<
    CustomerStatus,
    { label: string; color: string; bg: string }
  > = {
    qc_pending: {
      label: c.statusQcPending,
      color: "text-sari",
      bg: "bg-sari-soft",
    },
    in_production: {
      label: c.statusInProduction,
      color: "text-pim-mercan",
      bg: "bg-pim-mercan-tint",
    },
    shipped: {
      label: c.statusShipped,
      color: "text-lacivert",
      bg: "bg-gri-100",
    },
    delivered: {
      label: c.statusDelivered,
      color: "text-yesil",
      bg: "bg-yesil-soft",
    },
    cancelled: {
      label: c.statusCancelled,
      color: "text-kirmizi",
      bg: "bg-gri-100",
    },
  };

  const FILTER_OPTIONS: { id: CustomerStatus | "all"; label: string }[] = [
    { id: "all", label: c.filterAll },
    { id: "qc_pending", label: c.statusQcPending },
    { id: "in_production", label: c.statusInProduction },
    { id: "shipped", label: c.statusShipped },
    { id: "delivered", label: c.statusDelivered },
    { id: "cancelled", label: c.statusCancelled },
  ];

  /** CustomerOrder → list view row */
  function toOrderRow(o: CustomerOrder): Order {
    const title =
      o.items.length === 1 ? o.items[0].title : c.multiOrder(o.items.length);
    const totalQty = o.items.reduce((sum, i) => sum + i.qty, 0);
    const date = new Date(o.createdAtIso).toLocaleDateString(
      c.locale,
      c.dateFmt
    );
    return {
      id: o.id,
      date,
      title,
      qty: totalQty,
      total: o.total,
      status: toCustomerStatus(o.status),
    };
  }

  useEffect(() => {
    ensureAuthBindings();
    const refresh = () =>
      setOrders(listCustomerOrders().map(toOrderRow));
    void refreshCustomerOrders().then(() => {
      refresh();
      setHydrated(true);
    });
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

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
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              {c.title}
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {c.subtitle(orders.length)}
            </p>
          </div>
          <Button variant="primary" size="lg" href="/etiket">
            <Icon.Plus size={16} /> {c.newOrder}
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
                  placeholder={c.searchPlaceholder}
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
            <Pim pose="think" size={140} />
            <h3 className="mt-4 text-xl font-semibold mb-2">{c.emptyTitle}</h3>
            <p className="text-base text-gri-700 mb-5 max-w-[480px] mx-auto leading-relaxed">
              {c.emptyDesc}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={16} /> {c.printEtiket}
              </Button>
              <Button variant="secondary" size="lg" href="/sticker">
                <Icon.Sticker size={16} /> {c.printSticker}
              </Button>
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-4 text-xl font-semibold mb-2">{c.noResultsTitle}</h3>
            <p className="text-base text-gri-700 mb-5">{c.noResultsDesc}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              {c.resetFilter}
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
                        {fmt(o.qty)} {c.pcs} · {fmt(o.total)} {c.currency}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {o.status === "delivered" && (
                        <Button variant="secondary" size="sm" href="/etiket">
                          {c.reorder}
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        href={`/siparis/${o.id}`}
                      >
                        {c.detail} <Icon.ChevR size={12} />
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
