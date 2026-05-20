/**
 * Pim Etiket — /admin/siparisler (E.3)
 *
 * Tüm siparişler — tablo görünümü, filtre, search, durum güncelleme.
 *
 * Yeni (13 May): Bulk işlemler + saved views.
 *   - Checkbox kolonu + master select all
 *   - Sticky bulk action bar (toplu durum değiştir, toplu manuel iptal)
 *   - 3 hazır saved view chip: "Bugün gelenler", "36h+ prova", "Üretime
 *     atanmamış" — tek tıkla filtre + sort kombinasyonu
 *   - URL ?status=paid → mount'ta filter otomatik
 */

"use client";

import { Suspense, useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Card, Input, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import {
  listCustomerOrders,
  updateCustomerOrderStatus,
  type CustomerOrder,
} from "@/lib/customer-order";
import { fetchAllOrdersForAdmin } from "@/lib/admin-orders";

type AdminStatus = OrderStatus;

interface AdminOrder {
  id: string;
  customer: string;
  product: string;
  qty: number;
  total: number;
  status: AdminStatus;
  date: string;
  /** Ham createdAt ms — saved view filtreleri için */
  createdAt: number;
  fason?: string;
}

const STATUS_META: Record<AdminStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Yeni", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  awaiting_upload: { label: "Tasarım bekleniyor", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_pending: { label: "AI kontrol", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  qc_flagged: { label: "AI flag", color: "text-sari-koyu", bg: "bg-sari-soft" },
  operator_review: { label: "Operatör", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  // Sefa 19 May v68 (DB↔TS sync): 5 yeni statü
  human_review: { label: "İnsan incelemesi", color: "text-pim-mercan", bg: "bg-pim-mercan-tint" },
  human_review_failed: { label: "Düzeltme isteniyor", color: "text-kirmizi-koyu", bg: "bg-kirmizi-soft" },
  proof_generating: { label: "Prova hazırlanıyor", color: "text-lacivert", bg: "bg-gri-100" },
  proof_pending: { label: "Müşteri onayı bekliyor", color: "text-lacivert", bg: "bg-gri-100" },
  proof_approved: { label: "Müşteri onayladı", color: "text-yesil", bg: "bg-yesil-soft" },
  ready_to_ship: { label: "Üretime hazır", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
  fason_assigned: { label: "Partnere atandı", color: "text-mavi-koyu", bg: "bg-mavi-soft" },
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

// ============================================================
// Saved views
// ============================================================
const DAY = 24 * 60 * 60 * 1000;

interface SavedView {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Filtre fonksiyonu — orders array'i alır, filtreler döndürür */
  apply: (orders: AdminOrder[]) => AdminOrder[];
}

const SAVED_VIEWS: SavedView[] = [
  {
    id: "today",
    label: "Bugün gelenler",
    emoji: "📅",
    description: "Son 24 saat içinde açılan siparişler",
    apply: (orders) => {
      const cutoff = Date.now() - DAY;
      return orders.filter((o) => o.createdAt > cutoff);
    },
  },
  {
    id: "stuck-proof",
    label: "36h+ prova",
    emoji: "⏰",
    description: "36 saatten uzun prova bekleyen — hatırlatma zamanı",
    apply: (orders) => {
      const cutoff = Date.now() - 1.5 * DAY;
      return orders.filter(
        (o) => o.status === "proof_pending" && o.createdAt < cutoff
      );
    },
  },
  {
    id: "unassigned",
    label: "Üretime atanmamış",
    emoji: "🏭",
    description: "Ödeme alındı ama henüz üretim partneri atanmadı",
    apply: (orders) => orders.filter((o) => o.status === "paid"),
  },
  {
    id: "high-value",
    label: "Yüksek tutar",
    emoji: "💰",
    description: "5.000 ₺ ve üstü — özel ilgi",
    apply: (orders) => orders.filter((o) => o.total >= 5000),
  },
];

/** CustomerOrder → AdminOrder row */
function toAdminOrderRow(o: CustomerOrder): AdminOrder {
  // Defensive: items/address bazı siparişlerde eksik gelirse JSX render
  // o satırı sessiz düşürüyor (Sefa 19 May v68 — PE-2026-8MAv1Rmy bug).
  const items = Array.isArray(o.items) ? o.items : [];
  const product =
    items.length === 1
      ? `${items[0].product === "sticker" ? "Sticker" : "Etiket"} × ${(items[0].qty ?? 0).toLocaleString("tr-TR")}`
      : items.length > 0
        ? `${items.length} ürün`
        : "—";
  const totalQty = items.reduce((sum, i) => sum + (i.qty ?? 0), 0);
  let date = "—";
  try {
    if (o.createdAtIso) {
      // Sefa 19 May v68 bug fix: timeZone explicit yoksa server UTC,
      // client TR (UTC+3) → React #418 hydration mismatch → satır düşürülüyor.
      // Hem server hem client'ı Istanbul'a sabitle.
      date = new Date(o.createdAtIso).toLocaleString("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      });
    }
  } catch {
    /* invalid date — '—' default */
  }
  return {
    id: o.id,
    customer:
      (o.address as { name?: string } | null)?.name ?? "(adres yok)",
    product,
    qty: totalQty,
    total: typeof o.total === "number" ? o.total : 0,
    status: o.status,
    date,
    createdAt: o.createdAt ?? Date.now(),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

export default function AdminSiparislerPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-56px)]" />}>
      <AdminSiparislerPageInner />
    </Suspense>
  );
}

function AdminSiparislerPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialFilter = (searchParams.get("status") as AdminStatus | null) ?? "all";
  const initialSearch = searchParams.get("q") ?? "";

  const [filter, setFilter] = useState<AdminStatus | "all">(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AdminStatus | "">("");

  // Sefa 18 May v68 (admin UX denetim): Filter + search → URL sync.
  // 2 sekmede farklı filtre tutmak için + paylaşılabilir link.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search.trim()) params.set("q", search.trim());
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  useEffect(() => {
    // İlk paint için local cache (LocalStorage / kendi user'ı)
    setOrders(listCustomerOrders().map(toAdminOrderRow));
    // Asıl liste: admin API → tüm müşterilerin siparişleri (RLS bypass)
    let cancelled = false;
    void fetchAllOrdersForAdmin({ limit: 500 }).then((all) => {
      if (!cancelled) setOrders(all.map(toAdminOrderRow));
    });
    const refresh = () => {
      setOrders(listCustomerOrders().map(toAdminOrderRow));
      void fetchAllOrdersForAdmin({ limit: 500 }).then((all) => {
        if (!cancelled) setOrders(all.map(toAdminOrderRow));
      });
    };
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("pim_customer_orders_updated", refresh);
    };
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: AdminStatus) => {
      updateCustomerOrderStatus(id, status);
      // Hemen local'i göster, sonra DB fresh çek
      setOrders(listCustomerOrders().map(toAdminOrderRow));
      void fetchAllOrdersForAdmin({ limit: 500 }).then((all) =>
        setOrders(all.map(toAdminOrderRow))
      );
    },
    []
  );

  /** Filtreli + aranmış + saved view uygulanmış siparişler */
  const filtered = useMemo(() => {
    let base = orders;

    // Saved view en geniş — diğer filtreler bunun üzerinde kısar
    if (activeView) {
      const view = SAVED_VIEWS.find((v) => v.id === activeView);
      if (view) base = view.apply(base);
    }

    return base.filter((o) => {
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
  }, [orders, filter, search, activeView]);

  // Selection helpers
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const someFilteredSelected =
    filtered.some((o) => selected.has(o.id)) && !allFilteredSelected;

  const toggleAll = useCallback(() => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach((o) => next.delete(o.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((o) => next.add(o.id));
      setSelected(next);
    }
  }, [allFilteredSelected, filtered, selected]);

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
    },
    [selected]
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /** Toplu durum güncelle */
  const applyBulkStatus = useCallback(() => {
    if (!bulkStatus || selected.size === 0) return;
    const targetLabel = STATUS_META[bulkStatus].label;
    if (
      !confirm(
        `${selected.size} siparişin durumu "${targetLabel}" olarak güncellensin mi?`
      )
    ) {
      return;
    }
    const count = selected.size;
    selected.forEach((id) => {
      updateCustomerOrderStatus(id, bulkStatus);
    });
    setOrders(listCustomerOrders().map(toAdminOrderRow));
    void fetchAllOrdersForAdmin({ limit: 500 }).then((all) =>
      setOrders(all.map(toAdminOrderRow))
    );
    clearSelection();
    setBulkStatus("");
    // PostHog: bulk update event
    void import("@/lib/analytics/posthog-events")
      .then(({ track }) => {
        track("admin_bulk_status_changed", {
          count,
          new_status: bulkStatus,
        });
      })
      .catch(() => {
        /* silent */
      });
  }, [bulkStatus, selected, clearSelection]);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[36px] font-semibold tracking-tight">
            Sipariş yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {filtered.length === orders.length ? (
              <>{orders.length} sipariş — filtrele ve durum güncelle</>
            ) : (
              <>
                <strong className="text-lacivert">{filtered.length}</strong>
                /{orders.length} sipariş gösteriliyor
                <span className="ml-2 text-[12.5px] text-gri-500">
                  ({orders.length - filtered.length} tanesi filtrelerle
                  gizleniyor)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                    setActiveView(null);
                  }}
                  className="ml-3 text-[12.5px] font-semibold text-pim-mercan hover:underline"
                >
                  ↻ Tüm filtreleri temizle
                </button>
              </>
            )}
          </p>
        </div>

        {/* Saved views chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold mr-1">
            Hızlı görünüm:
          </span>
          {SAVED_VIEWS.map((v) => {
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(isActive ? null : v.id)}
                title={v.description}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ring-1",
                  isActive
                    ? "bg-pim-mercan text-white ring-pim-mercan"
                    : "bg-white text-gri-700 ring-gri-200 hover:ring-pim-mercan hover:text-pim-mercan"
                )}
              >
                <span>{v.emoji}</span> {v.label}
              </button>
            );
          })}
          {activeView && (
            <button
              type="button"
              onClick={() => setActiveView(null)}
              className="text-[12px] font-semibold text-pim-mercan hover:underline"
            >
              Görünümü temizle
            </button>
          )}
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

        {/* Bulk action bar — sticky when items selected */}
        {selected.size > 0 && (
          <div className="sticky top-14 md:top-4 z-30 mb-4 rounded-xl bg-lacivert text-white shadow-2 px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-[13.5px]">
              {selected.size} sipariş seçildi
            </span>
            <span className="text-white/50">·</span>
            <div className="flex items-center gap-2">
              <label
                htmlFor="bulkStatus"
                className="text-[12px] text-white/80"
              >
                Durum:
              </label>
              <select
                id="bulkStatus"
                value={bulkStatus}
                onChange={(e) =>
                  setBulkStatus(e.target.value as AdminStatus | "")
                }
                className="h-9 px-2 pr-7 rounded-lg ring-1 ring-white/20 bg-white/10 text-[13px] font-semibold text-white focus:ring-white focus:outline-none"
              >
                <option value="" className="text-lacivert">
                  Seç…
                </option>
                {ALL_STATUSES.map((st) => (
                  <option
                    key={st}
                    value={st}
                    className="text-lacivert"
                  >
                    {STATUS_META[st].label}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={applyBulkStatus}
                disabled={!bulkStatus}
              >
                Uygula
              </Button>
            </div>
            <span className="ml-auto" />
            {/* Sefa 18 May v68 (admin UX denetim): CSV indir butonu */}
            <button
              type="button"
              onClick={() => {
                const rows = filtered.filter((o) => selected.has(o.id));
                const header = "ID,Müşteri,Ürün,Adet,Tutar,Durum,Tarih\n";
                const lines = rows
                  .map(
                    (o) =>
                      `"${o.id}","${o.customer}","${o.product}","${o.qty}","${o.total}","${o.status}","${new Date(o.createdAt).toISOString()}"`
                  )
                  .join("\n");
                const blob = new Blob([header + lines], {
                  type: "text/csv;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `siparisler-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-[12.5px] font-semibold text-white/80 hover:text-white"
            >
              📥 CSV indir
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[12.5px] font-semibold text-white/80 hover:text-white"
            >
              Seçimi temizle
            </button>
          </div>
        )}

        {/* Sefa 21 May v68 (admin UX denetim P0 #2): sticky thead'in ilk tr
            ile ~9px overlap'i vardı (ilk sipariş gizli kalıyordu). Sticky
            kaldırıldı — tablo zaten kısa (genelde <20 satır), sticky thead
            faydadan çok bug üretiyordu. Büyük listelerde scroll-padding-top
            ile geri eklenir. */}
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="border-b border-gri-200 bg-gri-50">
              <tr>
                <th className="px-3 py-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Tümünü seç"
                    className="h-4 w-4 accent-pim-mercan cursor-pointer"
                  />
                </th>
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
                  <td colSpan={9} className="px-4 py-12 text-center">
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
                  // Defensive: STATUS_META'da bilinmeyen status varsa fallback.
                  // Önce: undefined s.bg → crash → tüm satır render başarısız.
                  const s = STATUS_META[o.status] ?? {
                    label: o.status || "—",
                    bg: "bg-gri-100",
                    color: "text-gri-700",
                  };
                  const isSelected = selected.has(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "hover:bg-gri-50",
                        isSelected && "bg-pim-mercan-tint/40"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(o.id)}
                          aria-label={`${o.id} seç`}
                          className="h-4 w-4 accent-pim-mercan cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[12.5px]">
                        {o.id}
                      </td>
                      <td className="px-4 py-3 font-semibold text-lacivert">
                        {o.customer}
                      </td>
                      <td className="px-4 py-3 text-gri-700">{o.product}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmt(o.total)} ₺
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
                          href={`/admin/siparisler/${o.id}`}
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

        {filtered.length > 0 && (
          <p className="mt-3 text-[12px] text-gri-500 text-right">
            {filtered.length} sipariş · Toplam{" "}
            <span className="font-semibold text-lacivert">
              {fmt(filtered.reduce((s, o) => s + o.total, 0))} ₺
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
