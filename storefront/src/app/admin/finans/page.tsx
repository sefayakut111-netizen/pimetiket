/**
 * Pim Etiket — /admin/finans
 *
 * Finansal panel — operatör için tek bakışta:
 *   - Ciro KPI (toplam, KDV, AOV, ort. günlük) + dönem karşılaştırma
 *   - Günlük ciro trend chart
 *   - Ödeme yöntemi dağılımı (kart vs havale)
 *   - Top 5 ürün karışımı (ciro bazlı)
 *   - Top 10 müşteri (LTV)
 *   - Top kuponlar (kullanım sayısı + indirim TL)
 *   - PayTR uzlaşma yer tutucu (mali pencere açılınca aktifleşecek)
 *   - KDV %20 ayrımı
 *
 * Veri kuralı: gerçek sipariş yokken "—" / "₺0" — fake data YOK.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow } from "@/components/ui";
import { LineChart, DonutChart } from "@/components/charts";
import type { LinePoint } from "@/components/charts";
import { cn } from "@/lib/cn";
import {
  listCustomerOrders,
  refreshCustomerOrders,
  type CustomerOrder,
} from "@/lib/customer-order";
import {
  buildDailySeries,
  topCustomers,
  formatCurrency,
  formatShortDate,
} from "@/lib/admin-analytics";

type TimeRange = "7d" | "mtd" | "30d" | "all";

const RANGE_LABEL: Record<TimeRange, string> = {
  "7d": "7 gün",
  mtd: "Bu ay",
  "30d": "30 gün",
  all: "Tüm zamanlar",
};

const DAY = 24 * 60 * 60 * 1000;
const KDV_RATE = 0.2; // %20 KDV (TR standart, etiket/sticker dahil)

interface CouponSnapshot {
  code: string;
  type: "percent" | "fixed";
  value: number;
  usedCount: number;
  active: boolean;
}

function loadCoupons(): CouponSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("pim_coupons_v1");
    if (!raw) return [];
    return JSON.parse(raw) as CouponSnapshot[];
  } catch {
    return [];
  }
}

interface RangeWindow {
  start: number;
  prevStart: number;
  prevEnd: number;
  days: number;
}

function getRangeWindow(range: TimeRange): RangeWindow {
  const now = Date.now();
  if (range === "7d") {
    return {
      start: now - 7 * DAY,
      prevStart: now - 14 * DAY,
      prevEnd: now - 7 * DAY,
      days: 7,
    };
  }
  if (range === "mtd") {
    const today = new Date();
    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const startOfPrevMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
      0,
      0,
      0,
      0
    );
    const elapsedMs = now - startOfMonth.getTime();
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / DAY));
    const prevEnd = startOfPrevMonth.getTime() + elapsedMs;
    return {
      start: startOfMonth.getTime(),
      prevStart: startOfPrevMonth.getTime(),
      prevEnd,
      days: elapsedDays,
    };
  }
  if (range === "30d") {
    return {
      start: now - 30 * DAY,
      prevStart: now - 60 * DAY,
      prevEnd: now - 30 * DAY,
      days: 30,
    };
  }
  // "all"
  return {
    start: 0,
    prevStart: 0,
    prevEnd: 0,
    days: 90,
  };
}

function formatPercentChange(curr: number, prev: number): {
  label: string;
  trend: "up" | "down" | "flat";
} {
  if (prev === 0 && curr === 0) return { label: "—", trend: "flat" };
  if (prev === 0) return { label: "yeni", trend: "up" };
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { label: "≈ aynı", trend: "flat" };
  const sign = pct > 0 ? "+" : "";
  return {
    label: `${sign}${pct.toFixed(0)}%`,
    trend: pct > 0 ? "up" : "down",
  };
}

export default function AdminFinansPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [range, setRange] = useState<TimeRange>("mtd");
  const [coupons, setCoupons] = useState<CouponSnapshot[]>([]);

  useEffect(() => {
    const refresh = () => setOrders(listCustomerOrders());
    refresh();
    setCoupons(loadCoupons());
    refreshCustomerOrders()
      .then((o) => setOrders(o))
      .catch(() => {
        /* silent */
      });
    window.addEventListener("pim_customer_orders_updated", refresh);
    return () =>
      window.removeEventListener("pim_customer_orders_updated", refresh);
  }, []);

  const rangeWindow = getRangeWindow(range);

  const inRange = useMemo(
    () =>
      range === "all"
        ? orders
        : orders.filter((o) => o.createdAt >= rangeWindow.start),
    [orders, rangeWindow.start, range]
  );

  const inPrevRange = useMemo(() => {
    if (range === "all") return [];
    return orders.filter(
      (o) =>
        o.createdAt >= rangeWindow.prevStart &&
        o.createdAt < rangeWindow.prevEnd
    );
  }, [orders, rangeWindow.prevStart, rangeWindow.prevEnd, range]);

  // Sadece tamamlanan/üretimdeki/teslim olan siparişler "kazanç" sayılır.
  // İptal edilen ciro hesabına girmez.
  const paidOrders = useMemo(
    () => inRange.filter((o) => o.status !== "cancelled"),
    [inRange]
  );
  const prevPaidOrders = useMemo(
    () => inPrevRange.filter((o) => o.status !== "cancelled"),
    [inPrevRange]
  );

  // KPI hesaplamaları
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevPaidOrders.reduce((s, o) => s + o.total, 0);
  const cancelledRevenue = inRange
    .filter((o) => o.status === "cancelled")
    .reduce((s, o) => s + o.total, 0);

  // KDV ayrımı: total KDV dahildir, net = total / 1.20, kdv = total - net
  const netRevenue = totalRevenue / (1 + KDV_RATE);
  const kdvAmount = totalRevenue - netRevenue;

  const aov = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const dailyAvg =
    rangeWindow.days > 0 ? totalRevenue / rangeWindow.days : 0;

  const shippingRevenue = paidOrders.reduce((s, o) => s + (o.shipping || 0), 0);

  const revenueChange = formatPercentChange(totalRevenue, prevRevenue);
  const orderCountChange = formatPercentChange(
    paidOrders.length,
    prevPaidOrders.length
  );

  // Ödeme yöntemi dağılımı
  const cardOrders = paidOrders.filter((o) => o.payment.method === "card");
  const transferOrders = paidOrders.filter(
    (o) => o.payment.method === "transfer"
  );
  const cardRevenue = cardOrders.reduce((s, o) => s + o.total, 0);
  const transferRevenue = transferOrders.reduce((s, o) => s + o.total, 0);

  // Trend chart
  const dailySeries = useMemo(
    () => buildDailySeries(paidOrders, Math.min(rangeWindow.days, 30)),
    [paidOrders, rangeWindow.days]
  );
  const trendPoints: LinePoint[] = dailySeries.map((d) => ({
    x: formatShortDate(d.date),
    y: d.revenue,
  }));

  // Top 10 müşteri (LTV bazlı)
  const tops = useMemo(() => topCustomers(paidOrders, 10), [paidOrders]);

  // Kupon ROI
  const activeCoupons = coupons
    .filter((c) => c.usedCount > 0)
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, 5);

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[1320px] px-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <Eyebrow>Finans</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Mali tablo
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              Sipariş bazlı brüt ciro · KDV dahil tutarlar üzerinden
            </p>
          </div>

          {/* Time range toggle */}
          <div className="bg-white rounded-full ring-1 ring-gri-200 p-1 inline-flex gap-1 shrink-0">
            {(Object.keys(RANGE_LABEL) as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "h-8 px-3.5 rounded-full text-[12.5px] font-semibold transition-colors",
                  range === r
                    ? "bg-lacivert text-white"
                    : "text-gri-700 hover:text-lacivert"
                )}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {/* PayTR uzlaşma uyarısı (mali pencere açılana kadar) */}
        <Card padding="p-4" className="mb-6 bg-sari-soft ring-sari/20">
          <div className="flex items-start gap-3">
            <span className="text-[20px]">⏳</span>
            <div className="flex-1">
              <h2 className="text-[13.5px] font-semibold text-lacivert">
                PayTR uzlaşma henüz aktif değil
              </h2>
              <p className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
                Sanal POS başvurusu mali haftada yapılacak. PayTR aktifleşince
                "tahsil edilen vs PayTR'da bekleyen" kırılımı bu sayfada
                gözükecek. Şu an gösterilen rakamlar sipariş bazlı brüt ciro.
              </p>
            </div>
          </div>
        </Card>

        {/* Ana KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              {RANGE_LABEL[range]} ciro
            </div>
            <div className="text-[28px] font-bold mt-1 leading-none tabular-nums text-yesil">
              {formatCurrency(totalRevenue)}
            </div>
            <div
              className={cn(
                "text-[11.5px] mt-1.5 font-semibold",
                revenueChange.trend === "up"
                  ? "text-yesil"
                  : revenueChange.trend === "down"
                    ? "text-kirmizi"
                    : "text-gri-700"
              )}
            >
              {revenueChange.trend === "up" && "↑ "}
              {revenueChange.trend === "down" && "↓ "}
              {revenueChange.label} {range !== "all" && "(öncekine göre)"}
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Net (KDV hariç)
            </div>
            <div className="text-[24px] font-bold mt-1 leading-none tabular-nums text-lacivert">
              {formatCurrency(netRevenue)}
            </div>
            <div className="text-[11.5px] mt-1.5 text-gri-700">
              KDV: {formatCurrency(kdvAmount)}
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Sepet ortalaması
            </div>
            <div className="text-[24px] font-bold mt-1 leading-none tabular-nums text-pim-mercan">
              {paidOrders.length > 0 ? formatCurrency(aov) : "—"}
            </div>
            <div className="text-[11.5px] mt-1.5 text-gri-700">
              {paidOrders.length} sipariş ·{" "}
              <span
                className={cn(
                  orderCountChange.trend === "up"
                    ? "text-yesil"
                    : orderCountChange.trend === "down"
                      ? "text-kirmizi"
                      : "text-gri-700"
                )}
              >
                {orderCountChange.label}
              </span>
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Günlük ortalama
            </div>
            <div className="text-[24px] font-bold mt-1 leading-none tabular-nums text-lacivert">
              {formatCurrency(dailyAvg)}
            </div>
            <div className="text-[11.5px] mt-1.5 text-gri-700">
              {rangeWindow.days} gün üzerinden
            </div>
          </Card>
        </div>

        {/* İkincil metrikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Kargo geliri
            </div>
            <div className="text-[20px] font-bold mt-1 tabular-nums text-lacivert">
              {formatCurrency(shippingRevenue)}
            </div>
            <div className="text-[11px] mt-1 text-gri-700">
              Ürün dışı tahsilat
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              İptal kaybı
            </div>
            <div
              className={cn(
                "text-[20px] font-bold mt-1 tabular-nums",
                cancelledRevenue > 0 ? "text-kirmizi" : "text-gri-500"
              )}
            >
              {formatCurrency(cancelledRevenue)}
            </div>
            <div className="text-[11px] mt-1 text-gri-700">
              {totalRevenue > 0
                ? `%${((cancelledRevenue / (totalRevenue + cancelledRevenue)) * 100).toFixed(1)} oran`
                : "—"}
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Kart ödemesi
            </div>
            <div className="text-[20px] font-bold mt-1 tabular-nums text-yesil">
              {formatCurrency(cardRevenue)}
            </div>
            <div className="text-[11px] mt-1 text-gri-700">
              {cardOrders.length} sipariş
            </div>
          </Card>

          <Card padding="p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
              Havale
            </div>
            <div className="text-[20px] font-bold mt-1 tabular-nums text-pim-mercan">
              {formatCurrency(transferRevenue)}
            </div>
            <div className="text-[11px] mt-1 text-gri-700">
              {transferOrders.length} sipariş
            </div>
          </Card>
        </div>

        {/* Trend + Ödeme dağılımı */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mb-6">
          <Card padding="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Ciro trendi</h2>
                <p className="text-[12px] text-gri-700">
                  Günlük — {rangeWindow.days} gün
                </p>
              </div>
              <span className="text-[13px] font-bold text-yesil tabular-nums">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
            <LineChart
              points={trendPoints}
              height={180}
              color="text-yesil"
              formatY={formatCurrency}
              emptyLabel="Tahsilat geldikçe trend burada birikir"
            />
          </Card>

          <Card padding="p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">Ödeme yöntemi</h2>
              <p className="text-[12px] text-gri-700">Kart vs havale</p>
            </div>
            <DonutChart
              slices={[
                { label: "Kart", value: cardRevenue, color: "#52C41A" },
                { label: "Havale", value: transferRevenue, color: "#FF4D4F" },
              ]}
              size={150}
              centerLabel="Toplam"
              centerValue={formatCurrency(cardRevenue + transferRevenue)}
              emptyLabel="İlk tahsilattan sonra dağılım gözükür"
            />
          </Card>
        </div>

        {/* Top müşteriler (LTV) + Kupon ROI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">
                  En değerli müşteriler
                </h2>
                <p className="text-[12px] text-gri-700">
                  Bu dönemdeki ciro bazlı top 10
                </p>
              </div>
              <Link
                href="/admin/musteriler"
                className="text-[12px] font-semibold text-pim-mercan hover:underline"
              >
                Tümü →
              </Link>
            </div>
            {tops.length === 0 ? (
              <div className="p-8 text-center text-[12.5px] text-gri-500 italic">
                Sipariş geldikçe burası dolar
              </div>
            ) : (
              <ul className="divide-y divide-gri-100">
                {tops.map((c, i) => {
                  const customerKey = encodeURIComponent(
                    `${c.name.toLowerCase()}|${c.phone}`
                  );
                  const pct = (c.totalRevenue / totalRevenue) * 100;
                  return (
                    <li key={i} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan-tint text-pim-mercan text-[12px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/admin/musteriler/${customerKey}`}
                            className="font-semibold text-[13.5px] text-lacivert hover:text-pim-mercan truncate block"
                          >
                            {c.name}
                          </Link>
                          <div className="text-[11.5px] text-gri-500">
                            {c.orderCount} sipariş ·{" "}
                            {totalRevenue > 0 && `%${pct.toFixed(0)} pay`}
                          </div>
                        </div>
                        <span className="text-[14px] font-bold text-yesil tabular-nums shrink-0">
                          {formatCurrency(c.totalRevenue)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card padding="p-0">
            <div className="px-5 py-3.5 border-b border-gri-200 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Kupon performansı</h2>
                <p className="text-[12px] text-gri-700">
                  Kullanılan kuponlar
                </p>
              </div>
              <Link
                href="/admin/kuponlar"
                className="text-[12px] font-semibold text-pim-mercan hover:underline"
              >
                Yönet →
              </Link>
            </div>
            {activeCoupons.length === 0 ? (
              <div className="p-8 text-center">
                <Icon.Sparkle
                  size={28}
                  className="text-gri-500 mx-auto mb-2"
                />
                <div className="text-[12.5px] text-gri-700 italic">
                  Henüz kullanılan kupon yok
                </div>
                <Link
                  href="/admin/kuponlar"
                  className="mt-2 inline-block text-[12.5px] font-semibold text-pim-mercan hover:underline"
                >
                  İlk kuponu oluştur →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gri-100">
                {activeCoupons.map((c, i) => (
                  <li
                    key={i}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-pim-mercan text-[13px]">
                          {c.code}
                        </span>
                        {!c.active && (
                          <span className="inline-flex items-center h-[18px] px-1.5 rounded-full bg-gri-100 text-gri-700 text-[10px] font-bold">
                            Pasif
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-gri-500 mt-0.5">
                        {c.type === "percent"
                          ? `%${c.value} indirim`
                          : `${formatCurrency(c.value)} indirim`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[16px] font-bold tabular-nums text-lacivert">
                        {c.usedCount}
                      </div>
                      <div className="text-[10.5px] text-gri-500">
                        kullanım
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Mali pencere açılınca eklenecek modüller */}
        <Card padding="p-5" className="bg-gri-50 ring-gri-200">
          <div className="flex items-start gap-3">
            <Icon.Info size={16} className="text-gri-500 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-[13.5px] font-semibold text-lacivert">
                Mali pencere açılınca eklenecek
              </h2>
              <ul className="mt-2 space-y-1 text-[12.5px] text-gri-700 list-disc list-inside leading-relaxed">
                <li>
                  PayTR uzlaşma kırılımı (tahsil edilen / bekleyen / komisyon)
                </li>
                <li>
                  Resend mail otomasyonları (PayTR onay sonrası e-fatura
                  bildirimi)
                </li>
                <li>e-Fatura GİB entegrasyonu — fatura kesim takibi</li>
                <li>Banka mutabakatı CSV import</li>
                <li>
                  Aylık KDV beyanı için "Maliye dosyası" PDF/CSV export
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
