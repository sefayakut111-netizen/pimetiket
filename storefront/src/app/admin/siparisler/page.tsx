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
  ADMIN_STATUS_FILTER_CHIPS,
  UNASSIGNED_PRODUCTION_STATUSES,
  parseAdminStatusFilter,
  getCommonBulkTransitionTargets,
  getValidTransitions,
} from "@/lib/order";
// Sefa 22 May v68: updateCustomerOrderStatus kaldırıldı — auth mode'da
// no-op olduğu için admin "Uygula" sessizce başarısız oluyordu. Artık
// POST /api/admin/orders/[id]/status çağrılıyor (handleStatusChange +
// applyBulkStatus). listCustomerOrders sadece initial render fallback.
// listCustomerOrders kaldırıldı — admin liste yalnızca API'den gelir
import type { CustomerOrder } from "@/lib/customer-order";
import { fetchAllOrdersForAdmin } from "@/lib/admin-orders";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { canAccessModule } from "@/lib/admin-rbac";
import { getAdminStatusMeta } from "@/lib/admin-status";

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
  tracking_number?: string;
}

const FILTERS = ADMIN_STATUS_FILTER_CHIPS;

const PAGE_SIZE = 50;

const CANCEL_REASONS = [
  { id: "customer_request", label: "Müşteri talebi" },
  { id: "payment_issue", label: "Ödeme sorunu" },
  { id: "stock_unavailable", label: "Malzeme temin edilemedi" },
  { id: "quality_issue", label: "Kalite sorunu" },
  { id: "duplicate", label: "Mükerrer sipariş" },
  { id: "other", label: "Diğer" },
] as const;

type SortKey = "date" | "total" | "customer" | "status";
type SortDir = "asc" | "desc";

function downloadCsv(rows: AdminOrder[], filePrefix: string) {
  const header = "ID,Müşteri,Ürün,Adet,Tutar,Durum,Partner,Tarih\n";
  const lines = rows
    .map(
      (o) =>
        `"${o.id}","${o.customer}","${o.product}","${o.qty}","${o.total}","${o.status}","${o.fason ?? ""}","${new Date(o.createdAt).toISOString()}"`
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + header + lines], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getOrderUrgency(
  o: AdminOrder,
  now: number
): "critical" | "warn" | "high_value" | null {
  const day = 24 * 60 * 60 * 1000;
  if (o.status === "proof_pending" && now - o.createdAt > 1.5 * day) {
    return "critical";
  }
  if (
    ["qc_pending", "qc_flagged", "human_review", "operator_review"].includes(
      o.status
    ) &&
    now - o.createdAt > day
  ) {
    return "warn";
  }
  if (o.total >= 5000) return "high_value";
  return null;
}

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
    description: "Üretime hazır ama henüz partnere atanmadı",
    apply: (orders) =>
      orders.filter((o) =>
        UNASSIGNED_PRODUCTION_STATUSES.includes(o.status)
      ),
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
    fason: (o as CustomerOrder & { fasonName?: string }).fasonName,
    tracking_number: (o as CustomerOrder & { trackingNumber?: string })
      .trackingNumber,
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
  const { permissions } = useAdminPermissions();
  const canUpdateOrders = canAccessModule(permissions, "orders", "update");
  const initialStatuses = parseAdminStatusFilter(
    searchParams.get("status"),
    searchParams.getAll("status")
  );
  const initialSearch = searchParams.get("q") ?? "";
  const initialFrom = searchParams.get("from") ?? "";
  const initialTo = searchParams.get("to") ?? "";

  const [statusFilters, setStatusFilters] = useState<OrderStatus[] | null>(
    initialStatuses
  );
  const [search, setSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<AdminStatus | "">("");

  const loadOrders = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/orders/list?limit=500", {
        cache: "no-store",
      });
      if (!res.ok) {
        setListError(
          res.status === 403
            ? "Sipariş listesine erişim yetkiniz yok."
            : `Liste yüklenemedi (HTTP ${res.status})`
        );
        setOrders([]);
        return;
      }
      const data = (await res.json()) as { orders?: CustomerOrder[] };
      setOrders((data.orders ?? []).map(toAdminOrderRow));
    } catch {
      setListError("Bağlantı hatası — sipariş listesi alınamadı.");
      setOrders([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Sefa 18 May v68 (admin UX denetim): Filter + search → URL sync.
  // 2 sekmede farklı filtre tutmak için + paylaşılabilir link.
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilters?.length) {
      params.set("status", statusFilters.join(","));
    }
    if (search.trim()) params.set("q", search.trim());
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilters, search, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [statusFilters, search, dateFrom, dateTo, activeView, sortKey, sortDir]);

  useEffect(() => {
    void loadOrders();
    const refresh = () => void loadOrders();
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () => {
      window.removeEventListener("pim_customer_orders_updated", refresh);
    };
  }, [loadOrders]);

  // Sefa 22 May v68: Tek satır status değiştirme de aynı bug'dan
  // muzdaripti — updateCustomerOrderStatus auth mode'da no-op.
  // POST /api/admin/orders/[id]/status ile gerçek update.
  const handleStatusChange = useCallback(
    async (id: string, status: AdminStatus) => {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note: "Tek satır güncelleme (admin)" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(`Güncelleme başarısız: ${j.error ?? res.status}`);
        return;
      }
      // Fresh çek
      void loadOrders();
    },
    [loadOrders]
  );

  /** Filtreli + aranmış + saved view uygulanmış siparişler */
  const filtered = useMemo(() => {
    let base = orders;

    if (activeView) {
      const view = SAVED_VIEWS.find((v) => v.id === activeView);
      if (view) base = view.apply(base);
    }

    return base.filter((o) => {
      if (statusFilters?.length && !statusFilters.includes(o.status)) {
        return false;
      }
      if (dateFrom) {
        const fromTs = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (o.createdAt < fromTs) return false;
      }
      if (dateTo) {
        const toTs = new Date(dateTo).setHours(23, 59, 59, 999);
        if (o.createdAt > toTs) return false;
      }
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
  }, [orders, statusFilters, search, activeView, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = a.createdAt - b.createdAt;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
        case "customer":
          cmp = a.customer.localeCompare(b.customer, "tr");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpiStats = useMemo(() => {
    const total = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    const pending = orders.filter((o) =>
      [
        "paid",
        "awaiting_upload",
        "qc_pending",
        "proof_pending",
        "operator_review",
        "human_review",
      ].includes(o.status)
    ).length;
    const todayStartTs = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
    const todayCount = orders.filter((o) => o.createdAt >= todayStartTs).length;
    return { total, totalRevenue, pending, todayCount };
  }, [orders]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "total" ? "desc" : "asc");
    }
  }, [sortKey]);

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

  const bulkTargetStatuses = useMemo(() => {
    const statuses = orders
      .filter((o) => selected.has(o.id))
      .map((o) => o.status);
    return getCommonBulkTransitionTargets(statuses);
  }, [orders, selected]);

  /** Toplu durum güncelle — POST /api/admin/orders/bulk-status */
  const applyBulkStatus = useCallback(
    async (reason?: string) => {
      if (!bulkStatus || selected.size === 0) return;
      const targetLabel = getAdminStatusMeta(bulkStatus).label;
      if (
        !reason &&
        !confirm(
          `${selected.size} siparişin durumunu "${targetLabel}" olarak değiştirmek istediğinize emin misiniz?`
        )
      ) {
        return;
      }
      const count = selected.size;
      const ids = Array.from(selected);
      const reasonLabel =
        reason &&
        CANCEL_REASONS.find((r) => r.id === reason)?.label;
      const reasonText = reasonLabel
        ? `Toplu iptal: ${reasonLabel}`
        : "Toplu güncelleme (admin panel)";

      const res = await fetch("/api/admin/orders/bulk-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderIds: ids,
          newStatus: bulkStatus,
          reason: reasonText,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };

      if (!res.ok || !json.ok) {
        alert(`Güncelleme başarısız: ${json.error ?? res.status}`);
        return;
      }

      const updated = json.updated ?? 0;
      const skipped = json.skipped ?? 0;
      if (skipped > 0) {
        alert(`${updated}/${count} sipariş güncellendi. ${skipped} atlandı.`);
      }

      void loadOrders();
      clearSelection();
      setBulkStatus("");
      void import("@/lib/analytics/posthog-events")
        .then(({ track }) => {
          track("admin_bulk_status_changed", {
            count: updated,
            new_status: bulkStatus,
          });
        })
        .catch(() => {
          /* silent */
        });
    },
    [bulkStatus, selected, clearSelection, loadOrders]
  );

  const handleBulkApply = useCallback(() => {
    if (bulkStatus === "cancelled") {
      setShowCancelModal(true);
      return;
    }
    void applyBulkStatus();
  }, [bulkStatus, applyBulkStatus]);

  const SortableHeader = ({
    label,
    sortField,
  }: {
    label: string;
    sortField: SortKey;
  }) => {
    const isActive = sortKey === sortField;
    return (
      <th
        className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700 cursor-pointer select-none hover:text-lacivert"
        onClick={() => toggleSort(sortField)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {isActive && (
            <span className="text-pim-mercan">
              {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
        </span>
      </th>
    );
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
          <h1 className="text-[28px] md:text-[36px] font-semibold tracking-tight">
            Sipariş yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {sorted.length === orders.length ? (
              <>{orders.length} sipariş — filtrele ve durum güncelle</>
            ) : (
              <>
                <strong className="text-lacivert">{sorted.length}</strong>
                /{orders.length} sipariş gösteriliyor
                <span className="ml-2 text-[12.5px] text-gri-500">
                  ({orders.length - sorted.length} tanesi filtrelerle
                  gizleniyor)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilters(null);
                    setSearch("");
                    setDateFrom("");
                    setDateTo("");
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
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => downloadCsv(orders, "tum-siparisler")}
              className="text-[12px] font-semibold text-gri-500 hover:text-pim-mercan"
            >
              📥 Tümünü indir ({orders.length})
            </button>
            {sorted.length !== orders.length && (
              <button
                type="button"
                onClick={() => downloadCsv(sorted, "filtreli-siparisler")}
                className="text-[12px] font-semibold text-gri-500 hover:text-pim-mercan"
              >
                📥 Filtreli indir ({sorted.length})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Toplam
            </div>
            <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">
              {kpiStats.total}
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Toplam Ciro
            </div>
            <div className="text-[22px] font-bold text-lacivert tabular-nums mt-1">
              {fmt(kpiStats.totalRevenue)} ₺
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Beklemede
            </div>
            <div className="text-[22px] font-bold text-pim-mercan tabular-nums mt-1">
              {kpiStats.pending}
            </div>
          </Card>
          <Card padding="p-3">
            <div className="text-[11px] uppercase tracking-wider text-gri-500 font-semibold">
              Bugün
            </div>
            <div className="text-[22px] font-bold text-yesil tabular-nums mt-1">
              {kpiStats.todayCount}
            </div>
          </Card>
        </div>

        {listError && (
          <div className="mb-4 rounded-xl bg-kirmizi-soft text-kirmizi-koyu px-4 py-3 text-[13.5px] font-semibold">
            {listError}
          </div>
        )}

        {listLoading && orders.length === 0 && !listError && (
          <p className="mb-4 text-[13.5px] text-gri-700">Siparişler yükleniyor…</p>
        )}

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
                onClick={() =>
                  setStatusFilters(f.id === "all" ? null : [f.id as AdminStatus])
                }
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  (f.id === "all" && !statusFilters) ||
                    (f.id !== "all" &&
                      statusFilters?.length === 1 &&
                      statusFilters[0] === f.id)
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
              </button>
            ))}
            {statusFilters && statusFilters.length > 1 && (
              <span className="text-[12px] font-semibold text-pim-mercan px-2">
                {statusFilters.length} durum filtresi aktif
              </span>
            )}
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
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gri-100 w-full flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.04em] text-gri-500 font-semibold">
              Tarih:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="h-9 px-2 text-[12.5px] border border-gri-200 rounded-lg focus:border-pim-mercan focus:outline-none"
            />
            <span className="text-gri-400 text-[12px]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={new Date().toISOString().slice(0, 10)}
              className="h-9 px-2 text-[12.5px] border border-gri-200 rounded-lg focus:border-pim-mercan focus:outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-[11px] text-pim-mercan font-semibold hover:underline"
              >
                Temizle
              </button>
            )}
          </div>
        </Card>

        {/* Bulk action bar — sticky when items selected */}
        {canUpdateOrders && selected.size > 0 && (
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
                {bulkTargetStatuses.length === 0 ? (
                  <option value="" disabled className="text-lacivert">
                    Ortak geçiş yok
                  </option>
                ) : (
                  bulkTargetStatuses.map((st) => (
                    <option
                      key={st}
                      value={st}
                      className="text-lacivert"
                    >
                      {getAdminStatusMeta(st).label}
                    </option>
                  ))
                )}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkApply}
                disabled={!bulkStatus || bulkTargetStatuses.length === 0}
              >
                Uygula
              </Button>
            </div>
            <span className="ml-auto" />
            {/* Sefa 18 May v68 (admin UX denetim): CSV indir butonu */}
            <button
              type="button"
              onClick={() => {
                const rows = sorted.filter((o) => selected.has(o.id));
                downloadCsv(rows, "secili-siparisler");
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
                <th className="w-1 p-0" aria-hidden />
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
                <SortableHeader label="Müşteri" sortField="customer" />
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Ürün
                </th>
                <SortableHeader label="Tutar" sortField="total" />
                <SortableHeader label="Durum" sortField="status" />
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Partner
                </th>
                <SortableHeader label="Tarih" sortField="date" />
                <th className="px-4 py-3 font-semibold text-[11.5px] uppercase tracking-[0.04em] text-gri-700">
                  Durum güncelle
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gri-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
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
                paged.map((o) => {
                  const s = getAdminStatusMeta(o.status);
                  const isSelected = selected.has(o.id);
                  const urgency = getOrderUrgency(o, Date.now());
                  const validTargets = getValidTransitions(o.status);
                  return (
                    <tr
                      key={o.id}
                      className={cn(
                        "hover:bg-gri-50",
                        isSelected && "bg-pim-mercan-tint/40",
                        !isSelected && urgency === "critical" && "bg-kirmizi-soft/20",
                        !isSelected && urgency === "warn" && "bg-sari-soft/20",
                        !isSelected && urgency === "high_value" && "bg-mavi-soft/10"
                      )}
                    >
                      <td className="w-1 p-0">
                        {urgency === "critical" && (
                          <div className="w-1 min-h-[48px] bg-kirmizi" />
                        )}
                        {urgency === "warn" && (
                          <div className="w-1 min-h-[48px] bg-sari" />
                        )}
                        {urgency === "high_value" && (
                          <div className="w-1 min-h-[48px] bg-mavi" />
                        )}
                      </td>
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
                      <td className="px-4 py-3 text-[12px] text-gri-700">
                        {o.fason ? (
                          <span className="inline-flex items-center gap-1">
                            🏭 {o.fason}
                          </span>
                        ) : (
                          <span className="text-gri-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gri-700 text-[12.5px]">
                        {o.date}
                        {o.status === "shipped" && o.tracking_number && (
                          <div className="text-[10px] text-gri-500 mt-0.5 font-mono">
                            📦 {o.tracking_number}
                          </div>
                        )}
                        {(o.status === "shipped" || o.status === "delivered") &&
                          !o.tracking_number && (
                            <Link
                              href={`/admin/kargo?search=${encodeURIComponent(o.id)}`}
                              className="text-[10px] text-pim-mercan mt-0.5 inline-block hover:underline"
                            >
                              Kargo takip →
                            </Link>
                          )}
                      </td>
                      <td className="px-4 py-3">
                        {canUpdateOrders ? (
                          <select
                            value={o.status}
                            onChange={(e) =>
                              handleStatusChange(
                                o.id,
                                e.target.value as AdminStatus
                              )
                            }
                            disabled={validTargets.length === 0}
                            aria-label={`${o.id} statüsü güncelle`}
                            className="h-8 px-2 pr-7 rounded-lg ring-1 ring-gri-200 bg-white text-[12.5px] font-semibold text-lacivert hover:ring-pim-mercan focus:ring-pim-mercan focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value={o.status}>
                              {s.label} (mevcut)
                            </option>
                            {validTargets.map((st) => (
                              <option key={st} value={st}>
                                → {getAdminStatusMeta(st).label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                              s.bg,
                              s.color
                            )}
                          >
                            {s.label}
                          </span>
                        )}
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gri-100">
              <span className="text-[12px] text-gri-500">
                {sorted.length} sipariş · Sayfa {page}/{totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
                >
                  ««
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
                >
                  «
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(
                    1,
                    Math.min(page - 2, totalPages - 4)
                  );
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-8 h-8 text-[12px] rounded font-semibold",
                        p === page
                          ? "bg-lacivert text-white"
                          : "hover:bg-gri-100 text-gri-700"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
                >
                  »
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-[12px] rounded hover:bg-gri-100 disabled:opacity-30"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </Card>

        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <Card padding="p-6" className="w-full max-w-md">
              <h3 className="text-lg font-semibold text-lacivert mb-4">
                {selected.size} siparişi iptal et
              </h3>
              <p className="text-sm text-gri-700 mb-4">
                İptal sebebini seçin — bu bilgi audit log&apos;a kaydedilir.
              </p>
              <div className="space-y-2 mb-4">
                {CANCEL_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={r.id}
                      checked={cancelReason === r.id}
                      onChange={() => setCancelReason(r.id)}
                      className="accent-pim-mercan"
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="primary"
                  disabled={!cancelReason}
                  onClick={() => {
                    void applyBulkStatus(cancelReason);
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                  className="!bg-kirmizi hover:!bg-kirmizi/90"
                >
                  İptal et
                </Button>
              </div>
            </Card>
          </div>
        )}

        {sorted.length > 0 && (
          <p className="mt-3 text-[12px] text-gri-500 text-right">
            {sorted.length} sipariş · Toplam{" "}
            <span className="font-semibold text-lacivert">
              {fmt(sorted.reduce((s, o) => s + o.total, 0))} ₺
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
