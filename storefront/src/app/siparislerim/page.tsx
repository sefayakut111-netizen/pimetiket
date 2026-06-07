/**
 * Pim Etiket — /siparislerim (E.2.2)
 *
 * Tüm siparişler — filtre + search + tablo/kart liste.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Pim } from "@/components/Pim";
import { Button, Card, Input, Eyebrow, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  fetchCustomerOrder,
  type CustomerOrder,
} from "@/lib/customer-order";
import { reorderFromOrder } from "@/lib/customer-reorder";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { useT } from "@/lib/i18n/context";
import { useToast } from "@/components/ui/Toast";
import {
  fetchShipmentsByOrderIds,
  type CustomerShipment,
} from "@/lib/shipping/customer-shipment";
import {
  getCustomerStatusInfo,
  CUSTOMER_STATUS_FILTER_GROUPS,
  type CustomerStatusGroup,
} from "@/lib/customer-status";

const ORDERS_PER_PAGE = 10;

interface Order {
  id: string;
  date: string;
  dateIso: string;
  title: string;
  qty: number;
  total: number;
  status: OrderStatus;
  previewUrl?: string;
  product: "sticker" | "etiket";
}

const COPY = {
  tr: {
    phases: [
      "Konfigüre",
      "Ödendi",
      "Yüklendi",
      "AI kontrol",
      "Onay",
      "Üretim",
      "Kargo",
      "Teslim",
    ],
    eyebrow: "Hesabım",
    title: "Tüm siparişlerim",
    subtitle: (n: number) =>
      `${n} sipariş — filtreleyerek bul, tekrar sipariş ver veya detayı incele.`,
    newOrder: "Yeni sipariş",
    searchPlaceholder: "Sipariş ID veya isim ara…",
    filterAll: "Tümü",
    sortDateDesc: "En yeni",
    sortDateAsc: "En eski",
    sortTotalDesc: "En yüksek tutar",
    emptyTitle: "Henüz siparişin yok",
    emptyDesc: "İlk siparişini ver — sonra burada görürsün.",
    emptyWelcome:
      "İlk siparişinde hoş geldin kredin otomatik uygulanır.",
    printEtiket: "Etiket bastır",
    printSticker: "Sticker bastır",
    noResultsTitle: "Sonuç bulunamadı",
    noResultsDesc: "Filtreyi gevşetmeyi veya arama metnini değiştirmeyi dene.",
    resetFilter: "Filtreyi sıfırla",
    multiOrder: (n: number) => `${n} ürünlük sipariş`,
    pcs: "adet",
    currency: "₺",
    reorder: "Tekrar sipariş",
    detail: "Detay",
    uploadDesign: "Tasarım yükle",
    approveProof: "Provayı onayla",
    fixDesign: "Tasarımı düzelt",
    showMore: (n: number) => `Daha fazla göster (${n} kaldı)`,
    trackPrefix: "🚚 Kargoda",
    trackCarrier: "Yurtiçi Kargo",
    trackingNo: "Takip",
    trackBtn: "Takip et",
    locale: "tr-TR",
    dateFmt: { day: "numeric", month: "long", year: "numeric" } as const,
  },
  en: {
    phases: [
      "Configure",
      "Paid",
      "Uploaded",
      "AI check",
      "Approval",
      "Production",
      "Shipping",
      "Delivered",
    ],
    eyebrow: "My account",
    title: "All my orders",
    subtitle: (n: number) =>
      `${n} order${n === 1 ? "" : "s"} — filter to find, reorder or view details.`,
    newOrder: "New order",
    searchPlaceholder: "Search order ID or name…",
    filterAll: "All",
    sortDateDesc: "Newest",
    sortDateAsc: "Oldest",
    sortTotalDesc: "Highest total",
    emptyTitle: "No orders yet",
    emptyDesc: "Place your first order — it will show up here.",
    emptyWelcome: "Welcome credit applies automatically on your first order.",
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
    uploadDesign: "Upload design",
    approveProof: "Approve proof",
    fixDesign: "Fix design",
    showMore: (n: number) => `Show more (${n} remaining)`,
    trackPrefix: "🚚 In transit",
    trackCarrier: "Yurtiçi Kargo",
    trackingNo: "Tracking",
    trackBtn: "Track",
    locale: "en-US",
    dateFmt: { day: "numeric", month: "short", year: "numeric" } as const,
  },
};

function phaseDotClass(
  phase: number,
  i: number,
  activeColor: string
): string {
  if (phase < 0) return "bg-gri-200";
  if (i < phase) return "bg-yesil";
  if (i === phase) {
    if (activeColor === "text-sari" || activeColor === "text-sari-koyu")
      return "bg-sari";
    if (activeColor === "text-pim-mercan") return "bg-pim-mercan";
    if (activeColor === "text-lacivert" || activeColor === "text-mavi-koyu")
      return "bg-lacivert";
    if (activeColor === "text-yesil") return "bg-yesil";
    if (activeColor === "text-kirmizi") return "bg-kirmizi";
    return "bg-gri-400";
  }
  return "bg-gri-200";
}

function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1;
    case "awaiting_upload":
      return 2;
    case "qc_pending":
    case "qc_flagged":
    case "human_review":
    case "human_review_failed":
    case "operator_review":
      return 3;
    case "proof_generating":
    case "proof_validating":
    case "proof_pending":
      return 4;
    case "proof_approved":
    case "ready_to_ship":
    case "fason_assigned":
    case "in_production":
      return 5;
    case "shipped":
      return 6;
    case "delivered":
      return 7;
    case "cancelled":
      return -1;
    default:
      return 0;
  }
}

export type { OrderStatus };

export default function SiparislerimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<CustomerStatusGroup | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "total_desc"
  >("date_desc");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [welcomeCreditActive, setWelcomeCreditActive] = useState(false);
  const [shipments, setShipments] = useState<
    Map<string, CustomerShipment | null>
  >(new Map());

  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const FILTER_OPTIONS = CUSTOMER_STATUS_FILTER_GROUPS.map((g) => ({
    id: g.id,
    label: locale === "en" ? g.labelEn : g.labelTr,
  }));

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
      dateIso: o.createdAtIso,
      title,
      qty: totalQty,
      total: o.total,
      status: o.status,
      previewUrl: o.items[0]?.designPreviewUrl,
      product: o.items[0]?.product ?? "sticker",
    };
  }

  useEffect(() => {
    ensureAuthBindings();
    const refresh = () =>
      setOrders(listCustomerOrders().map(toOrderRow));
    void refreshCustomerOrders().then(() => {
      refresh();
      setHydrated(true);
      const list = listCustomerOrders();
      const shippedOrDelivered = list
        .filter(
          (o) =>
            o.status === "shipped" ||
            o.status === "delivered" ||
            o.status === "in_production"
        )
        .map((o) => o.id);
      if (shippedOrDelivered.length > 0) {
        void fetchShipmentsByOrderIds(shippedOrDelivered).then(setShipments);
      }
    });
    void fetch("/api/public/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { settings?: { welcome_credit_try?: number } } | null) => {
        if ((data?.settings?.welcome_credit_try ?? 0) > 0) {
          setWelcomeCreditActive(true);
        }
      })
      .catch(() => {});
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const countByGroup = useMemo(() => {
    const map: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      const g = getCustomerStatusInfo(o.status).group;
      map[g] = (map[g] ?? 0) + 1;
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (
        filter !== "all" &&
        getCustomerStatusInfo(o.status).group !== filter
      )
        return false;
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

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "date_asc") {
      list.sort(
        (a, b) =>
          new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime()
      );
    } else if (sortBy === "total_desc") {
      list.sort((a, b) => b.total - a.total);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
      );
    }
    return list;
  }, [filtered, sortBy]);

  const paged = sorted.slice(0, page * ORDERS_PER_PAGE);
  const hasMore = sorted.length > paged.length;

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const order = await fetchCustomerOrder(orderId);
      if (!order) {
        toast.error(
          locale === "en" ? "Order not found" : "Sipariş bulunamadı"
        );
        return;
      }
      const r = await reorderFromOrder(order);
      if (r.ok) {
        toast.success(
          locale === "en"
            ? `${r.added} item(s) added to cart`
            : `${r.added} ürün sepete eklendi`
        );
        router.push("/sepet");
      } else {
        toast.error(r.reason ?? (locale === "en" ? "Could not reorder" : "Sepete eklenemedi"));
      }
    } catch {
      toast.error(
        locale === "en"
          ? "Reorder failed — refresh and try again"
          : "Tekrar sipariş açılamadı — sayfayı yenileyip tekrar dene"
      );
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
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

        <Card padding="p-4" className="mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                filter === "all"
                  ? "bg-lacivert text-white"
                  : "bg-gri-100 text-gri-700 hover:bg-gri-200"
              )}
            >
              {c.filterAll}
              <span className="ml-1 text-[10px] opacity-60">
                ({countByGroup.all ?? 0})
              </span>
            </button>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
                <span className="ml-1 text-[10px] opacity-60">
                  ({countByGroup[f.id] ?? 0})
                </span>
              </button>
            ))}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(
                  e.target.value as "date_desc" | "date_asc" | "total_desc"
                );
                setPage(1);
              }}
              className="h-11 px-3 rounded-lg border border-gri-200 bg-white text-[13px] font-semibold text-gri-700"
              aria-label={locale === "en" ? "Sort orders" : "Siparişleri sırala"}
            >
              <option value="date_desc">{c.sortDateDesc}</option>
              <option value="date_asc">{c.sortDateAsc}</option>
              <option value="total_desc">{c.sortTotalDesc}</option>
            </select>
            <div className="ml-auto w-full sm:w-auto sm:min-w-[280px]">
              <div className="relative">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
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

        {!hydrated ? (
          <div className="space-y-3">
            <Skeleton.OrderRow />
            <Skeleton.OrderRow />
            <Skeleton.OrderRow />
          </div>
        ) : orders.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={140} />
            <h3 className="mt-4 text-xl font-semibold mb-2">{c.emptyTitle}</h3>
            <p className="text-base text-gri-700 mb-2 max-w-[480px] mx-auto leading-relaxed">
              {c.emptyDesc}
            </p>
            {welcomeCreditActive && (
              <p className="text-sm text-gri-500 mb-5 max-w-[480px] mx-auto">
                {c.emptyWelcome}
              </p>
            )}
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
                setPage(1);
              }}
            >
              {c.resetFilter}
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {paged.map((o) => {
              const info = getCustomerStatusInfo(o.status);
              const s = {
                label: locale === "en" ? info.labelEn : info.label,
                color: info.color,
                bg: info.bg,
              };
              const phase = statusToPhaseIndex(o.status);
              const ship = shipments.get(o.id);
              const showShipRow =
                ship &&
                ship.hasShipment &&
                (o.status === "shipped" || o.status === "delivered");
              return (
                <Card key={o.id} padding="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-4 items-start">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gri-100">
                      {o.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.previewUrl}
                          alt={o.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : o.product === "sticker" ? (
                        <Icon.Sticker size={28} className="text-gri-500" />
                      ) : (
                        <Icon.Tag size={28} className="text-gri-500" />
                      )}
                    </div>
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

                      <div className="flex items-center gap-1 mt-3">
                        {c.phases.map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 flex items-center gap-1"
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                phaseDotClass(phase, i, info.color)
                              )}
                            />
                            {i < c.phases.length - 1 && (
                              <span
                                className={cn(
                                  "flex-1 h-0.5",
                                  phase >= 0 && i < phase
                                    ? "bg-yesil"
                                    : "bg-gri-200"
                                )}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:shrink-0 sm:items-end">
                      {o.status === "awaiting_upload" && (
                        <Button
                          variant="primary"
                          size="sm"
                          href={`/siparis/${o.id}/tasarim-yukle`}
                          className="!bg-pim-mercan"
                        >
                          {c.uploadDesign}
                        </Button>
                      )}
                      {(o.status === "proof_pending" ||
                        o.status === "proof_validating") && (
                        <Button
                          variant="primary"
                          size="sm"
                          href={`/onay/${o.id}`}
                        >
                          {c.approveProof}
                        </Button>
                      )}
                      {o.status === "human_review_failed" && (
                        <Button
                          variant="primary"
                          size="sm"
                          href={`/siparis/${o.id}/tasarim-yukle`}
                          className="!bg-pim-mercan"
                        >
                          {c.fixDesign}
                        </Button>
                      )}
                      {o.status === "delivered" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleReorder(o.id)}
                          disabled={reorderingId === o.id}
                        >
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

                  {showShipRow && ship && (
                    <div className="mt-3 pt-3 border-t border-gri-200 flex items-center gap-3 flex-wrap text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-yesil-koyu">
                        🚚 {ship.carrierLabel || c.trackCarrier}
                      </span>
                      <span className="text-gri-500">·</span>
                      <span className="text-gri-700">
                        {c.trackingNo}:{" "}
                        <code className="font-mono font-semibold text-lacivert">
                          {ship.trackingNumber}
                        </code>
                      </span>
                      {ship.shippedAt && (
                        <>
                          <span className="text-gri-500">·</span>
                          <span className="text-gri-500">
                            {new Date(ship.shippedAt).toLocaleDateString(
                              c.locale,
                              c.dateFmt
                            )}
                          </span>
                        </>
                      )}
                      {ship.trackingUrl && (
                        <a
                          href={ship.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto font-semibold text-pim-mercan hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.trackBtn} →
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                className="w-full mt-3"
              >
                {c.showMore(sorted.length - paged.length)}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
