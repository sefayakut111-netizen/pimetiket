/**
 * Pim Etiket — /admin/kargo
 *
 * Sefa 18 May v68 (kargo paneli ana sayfa):
 * Tüm kargo süreçlerini tek ekranda yönetme. KPI + filtre + tablo +
 * bulk action + trend chart + failed alarm.
 *
 * Yapı:
 *   - Üst: 6 KPI kart (bugün/yolda/dağıtım/teslim/failed/pending)
 *   - Ortada: Trend chart (son 14 gün) + ortalama teslim süresi + başarı oranı
 *   - Alt: Filtre chip + tablo + checkbox + bulk action toolbar
 *   - Detay linki: /admin/kargo/[orderId]
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  Card,
  Input,
  Eyebrow,
  Skeleton,
  Button,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AdminShipmentRow } from "@/app/api/admin/shipments/route";
import type { ShipmentStats } from "@/app/api/admin/shipments/stats/route";
import { ShipmentTrendChart } from "@/components/admin/ShipmentTrendChart";
import { DeliveryHistogram } from "@/components/admin/DeliveryHistogram";
import {
  GeoDistributionTreemap,
  type CityStat,
} from "@/components/admin/GeoDistributionTreemap";
import type { GeoDistributionResponse } from "@/app/api/admin/shipments/geo-distribution/route";

type StatusFilter =
  | "all"
  | "active"
  | "new"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned";

type DateRange = "today" | "week" | "month" | "all";

const STATUS_META: Record<
  Exclude<StatusFilter, "all" | "active">,
  { tr: string; emoji: string; color: string; bg: string }
> = {
  new: {
    tr: "Yeni",
    emoji: "📝",
    color: "text-gri-700",
    bg: "bg-gri-100",
  },
  in_transit: {
    tr: "Yolda",
    emoji: "🚚",
    color: "text-mavi-koyu",
    bg: "bg-mavi-soft",
  },
  out_for_delivery: {
    tr: "Dağıtımda",
    emoji: "🛵",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
  },
  delivered: {
    tr: "Teslim edildi",
    emoji: "✅",
    color: "text-yesil-koyu",
    bg: "bg-yesil-soft",
  },
  failed: {
    tr: "Başarısız",
    emoji: "⚠️",
    color: "text-kirmizi-koyu",
    bg: "bg-kirmizi-soft",
  },
  returned: {
    tr: "İade",
    emoji: "↩️",
    color: "text-mor",
    bg: "bg-mor/10",
  },
};

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // Sefa 20 May v68: timeZone Europe/Istanbul (hydration #418 fix)
  const opts: Intl.DateTimeFormatOptions = withTime
    ? {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      }
    : { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Istanbul" };
  return d.toLocaleString("tr-TR", opts);
}

function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  return formatDate(iso);
}

export default function AdminKargoPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shipments, setShipments] = useState<AdminShipmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ShipmentStats | null>(null);
  const [geo, setGeo] = useState<GeoDistributionResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch shipments
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      status: statusFilter,
      dateRange,
      limit: "100",
    });
    if (debounced) params.set("search", debounced);

    fetch(`/api/admin/shipments?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setShipments(data.shipments ?? []);
        setTotal(data.total ?? 0);
        setSelected(new Set()); // filtre değişince seçim sıfırla
      })
      .catch((e) => {
        if (!cancelled) toast.error(`Yükleme hatası: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, dateRange, debounced, toast]);

  // Fetch stats (KPI + trend + histogram) — sadece 1 kez
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/shipments/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setStats(data);
      });
    // Geo distribution (il bazlı) — paralel
    fetch("/api/admin/shipments/geo-distribution")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setGeo(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selected.size === shipments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(shipments.map((s) => s.assignment_id)));
    }
  }

  async function handleBulkPoll() {
    if (selected.size === 0) {
      toast.error("Önce seçim yap");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/admin/shipments/bulk-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Bulk poll başarısız");
        return;
      }
      const s = data.summary;
      toast.success(
        `Poll: ${s.polled} kargo, ${s.success} başarılı, ${s.newEvents} yeni event`
      );
      // Listeyi yenile
      window.location.reload();
    } catch (e) {
      toast.error(`Hata: ${(e as Error).message}`);
    } finally {
      setBulkSubmitting(false);
    }
  }

  const failedAlarm = (stats?.failed_recent ?? 0) > 0;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      {/* Üst */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Yurtiçi Kargo</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
            Kargo Yönetimi
          </h1>
          <p className="mt-1 text-sm text-gri-700">
            Tüm kargoları izle, toplu poll yap, manuel müdahale et.
          </p>
        </div>
        {stats?.last_poll && (
          <div className="text-right text-[11.5px] text-gri-500">
            Son cron poll:
            <br />
            {formatDate(stats.last_poll, true)}
          </div>
        )}
      </div>

      {/* Failed Alarm Banner */}
      {failedAlarm && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-kirmizi-soft p-3 ring-1 ring-kirmizi/30">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <div className="font-semibold text-kirmizi-koyu">
              {stats?.failed_recent} kargo son 7 günde başarısız teslim/iade
            </div>
            <p className="text-[12px] text-gri-700">
              Bu kargoları kontrol et — müşteriye haber verilmesi veya yeniden
              gönderim gerekebilir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter("failed")}
            className="rounded-full bg-kirmizi text-white px-3 py-1 text-[12px] font-semibold hover:bg-kirmizi-koyu"
          >
            Filtrele →
          </button>
        </div>
      )}

      {/* KPI Kartlar */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card className="cursor-pointer p-4 hover:ring-2 hover:ring-pim-mercan transition" onClick={() => { setDateRange("today"); setStatusFilter("active"); }}>
          <div className="text-[11px] text-gri-700">📦 Bugün</div>
          <div className="text-2xl font-bold text-lacivert mt-1">
            {stats ? stats.shipped_today : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
        <Card className="cursor-pointer p-4 hover:ring-2 hover:ring-mavi transition" onClick={() => setStatusFilter("in_transit")}>
          <div className="text-[11px] text-gri-700">🚚 Yolda</div>
          <div className="text-2xl font-bold text-mavi-koyu mt-1">
            {stats ? stats.in_transit : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
        <Card className="cursor-pointer p-4 hover:ring-2 hover:ring-sari transition" onClick={() => setStatusFilter("out_for_delivery")}>
          <div className="text-[11px] text-gri-700">🛵 Dağıtımda</div>
          <div className="text-2xl font-bold text-sari-koyu mt-1">
            {stats ? stats.out_for_delivery : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
        <Card className="cursor-pointer p-4 hover:ring-2 hover:ring-yesil transition" onClick={() => { setDateRange("week"); setStatusFilter("delivered"); }}>
          <div className="text-[11px] text-gri-700">✅ Teslim (7g)</div>
          <div className="text-2xl font-bold text-yesil-koyu mt-1">
            {stats ? stats.delivered_this_week : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
        <Card className={cn("cursor-pointer p-4 hover:ring-2 hover:ring-kirmizi transition", failedAlarm && "ring-2 ring-kirmizi-soft")} onClick={() => setStatusFilter("failed")}>
          <div className="text-[11px] text-gri-700">⚠️ Başarısız</div>
          <div className="text-2xl font-bold text-kirmizi-koyu mt-1">
            {stats ? stats.failed_recent : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] text-gri-700">⏳ Event yok</div>
          <div className="text-2xl font-bold text-gri-700 mt-1">
            {stats ? stats.pending_no_event : <Skeleton className="h-7 w-12" />}
          </div>
        </Card>
      </div>

      {/* Trend + İstatistikler */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-lacivert">
              Son 14 gün trend
            </h3>
            <span className="text-[11px] text-gri-500">Kargolanan vs Teslim</span>
          </div>
          {stats ? (
            <ShipmentTrendChart data={stats.daily_trend} />
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Card className="p-4">
            <div className="text-[11px] text-gri-700">
              Ort. teslim süresi
            </div>
            <div className="text-2xl font-bold text-lacivert mt-1">
              {stats?.avg_fulfillment_days != null
                ? `${stats.avg_fulfillment_days} gün`
                : "—"}
            </div>
            <p className="text-[11px] text-gri-500 mt-1">
              Son 30 günde shipped → delivered
            </p>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] text-gri-700">Başarı oranı</div>
            <div
              className={cn(
                "text-2xl font-bold mt-1",
                stats?.success_rate == null
                  ? "text-gri-500"
                  : stats.success_rate >= 90
                  ? "text-yesil-koyu"
                  : stats.success_rate >= 75
                  ? "text-sari-koyu"
                  : "text-kirmizi-koyu"
              )}
            >
              {stats?.success_rate != null ? `%${stats.success_rate}` : "—"}
            </div>
            <p className="text-[11px] text-gri-500 mt-1">
              delivered / (delivered + failed + returned)
            </p>
          </Card>
        </div>
      </div>

      {/* Faz 3: Histogram + Geo distribution */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-lacivert">
              Teslim süresi dağılımı
            </h3>
            <span className="text-[11px] text-gri-500">Son 90 gün</span>
          </div>
          {stats ? (
            <DeliveryHistogram data={stats.delivery_histogram ?? []} />
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-lacivert">
              İl bazlı dağılım
            </h3>
            <span className="text-[11px] text-gri-500">
              {geo?.total_cities ?? "—"} il · son 90 gün
            </span>
          </div>
          {geo ? (
            <GeoDistributionTreemap
              cities={geo.cities as CityStat[]}
              fastest={geo.fastest_city}
              slowest={geo.slowest_city}
            />
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </Card>
      </div>

      {/* Filtre + arama */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "active",
                "new",
                "in_transit",
                "out_for_delivery",
                "delivered",
                "failed",
                "returned",
                "all",
              ] as StatusFilter[]
            ).map((s) => {
              const meta = (STATUS_META as Record<string, { tr: string; emoji: string }>)[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition",
                    statusFilter === s
                      ? "bg-pim-mercan text-white"
                      : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                  )}
                >
                  {s === "all"
                    ? "Tümü"
                    : s === "active"
                    ? "🔥 Aktif"
                    : `${meta.emoji} ${meta.tr}`}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="rounded-lg border border-gri-200 px-2 py-1.5 text-[12.5px]"
            >
              <option value="today">Bugün</option>
              <option value="week">Son 7 gün</option>
              <option value="month">Son 30 gün</option>
              <option value="all">Tümü</option>
            </select>
            <Input
              placeholder="Sipariş no / takip no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
          </div>
        </div>
      </Card>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-mavi-soft px-4 py-2 ring-1 ring-mavi/30">
          <div className="text-[13px] text-mavi-koyu">
            <strong>{selected.size}</strong> kargo seçildi
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkPoll}
              disabled={bulkSubmitting}
            >
              🔄 {bulkSubmitting ? "İşleniyor..." : "Toplu poll yap"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSelected(new Set())}
            >
              İptal
            </Button>
          </div>
        </div>
      )}

      {/* Tablo */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gri-200 bg-gri-50 text-[12px] uppercase text-gri-600">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      shipments.length > 0 && selected.size === shipments.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-3 text-left font-semibold">Sipariş</th>
                <th className="px-3 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-3 py-3 text-left font-semibold">Takip no</th>
                <th className="px-3 py-3 text-left font-semibold">Durum</th>
                <th className="px-3 py-3 text-left font-semibold">
                  Son güncelleme
                </th>
                <th className="px-3 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gri-100">
                    <td colSpan={7} className="px-3 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : shipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-10 text-center text-gri-500"
                  >
                    Bu filtrede kargo yok.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => {
                  const meta = s.tracking_status
                    ? (STATUS_META as Record<string, { tr: string; emoji: string; color: string; bg: string }>)[s.tracking_status]
                    : STATUS_META.new;
                  return (
                    <tr
                      key={s.assignment_id}
                      className="border-b border-gri-100 last:border-0 hover:bg-gri-50"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(s.assignment_id)}
                          onChange={() => toggleSelect(s.assignment_id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/siparisler/${s.order_id}`}
                          className="font-mono text-[12.5px] text-pim-mercan hover:underline"
                        >
                          {s.order_id}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[13px] text-lacivert">
                          {s.customer_name ?? "—"}
                        </div>
                        <div className="text-[11px] text-gri-500">
                          {s.customer_email ?? "—"}
                          {s.city && ` · ${s.city}`}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <code className="rounded bg-gri-100 px-1.5 py-0.5 font-mono text-[11.5px]">
                          {s.tracking_number ?? "—"}
                        </code>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
                            meta?.bg ?? "bg-gri-100",
                            meta?.color ?? "text-gri-700"
                          )}
                        >
                          {meta?.emoji} {meta?.tr ?? s.tracking_status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px]">
                        {s.last_event_time ? (
                          <>
                            <div className="text-gri-700">
                              {s.last_event_description ?? "—"}
                            </div>
                            <div className="text-[11px] text-gri-500">
                              {daysAgo(s.last_event_time)}
                              {s.last_event_location &&
                                ` · ${s.last_event_location}`}
                            </div>
                          </>
                        ) : (
                          <span className="text-gri-500 text-[11.5px]">
                            Henüz event yok
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/kargo/${s.order_id}`}>
                          <Button size="sm" variant="secondary">
                            Detay
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 text-[12.5px] text-gri-500">
        Toplam {total} kargo · Cron <code className="rounded bg-gri-100 px-1">0 */4 * * *</code> (her 4 saatte)
      </div>
    </main>
  );
}
