/**
 * Admin analytics — sipariş listesinden agregat metrikler.
 *
 * Dashboard'un kullandığı "salt fonksiyon" kütüphanesi.
 * Boş listeyle çağrıldığında 0 / [] / null döner — fake data YOK.
 */

import type { CustomerOrder } from "./customer-order";
import type { OrderStatus } from "./order";

const DAY = 24 * 60 * 60 * 1000;

// ============================================================
// Time series — günlük / saatlik / haftalık dağılım
// ============================================================

export interface DailyMetric {
  date: Date;
  count: number;
  revenue: number;
}

/** Son N gün için günlük sipariş + ciro */
export function buildDailySeries(
  orders: CustomerOrder[],
  days: number
): DailyMetric[] {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const series: DailyMetric[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    series.push({ date: new Date(d), count: 0, revenue: 0 });
  }

  for (const o of orders) {
    const od = new Date(o.createdAt);
    od.setHours(0, 0, 0, 0);
    const idx = series.findIndex(
      (s) => s.date.getTime() === od.getTime()
    );
    if (idx >= 0) {
      series[idx].count++;
      series[idx].revenue += o.total;
    }
  }
  return series;
}

/** 7×24 saat heatmap matrix — day 0=Pzt 6=Paz */
export function buildHeatmapMatrix(orders: CustomerOrder[]): number[][] {
  const matrix: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  for (const o of orders) {
    const d = new Date(o.createdAt);
    // JS getDay: 0=Paz 1=Pzt ... 6=Cmt → bizim format 0=Pzt
    const day = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    matrix[day][hour]++;
  }
  return matrix;
}

// ============================================================
// Product mix — etiket vs sticker
// ============================================================

export interface ProductMix {
  etiket: number;
  sticker: number;
  etiketRevenue: number;
  stickerRevenue: number;
}

export function aggregateProductMix(orders: CustomerOrder[]): ProductMix {
  let etiket = 0;
  let sticker = 0;
  let etiketRevenue = 0;
  let stickerRevenue = 0;
  for (const o of orders) {
    for (const item of o.items) {
      // Total üzerinden item sayısına orantılı revenue (yaklaşık)
      const itemValue = o.total / o.items.length;
      if (item.product === "sticker") {
        sticker++;
        stickerRevenue += itemValue;
      } else {
        etiket++;
        etiketRevenue += itemValue;
      }
    }
  }
  return { etiket, sticker, etiketRevenue, stickerRevenue };
}

// ============================================================
// Status distribution
// ============================================================

export type StatusCount = Record<OrderStatus, number>;

export function aggregateStatus(orders: CustomerOrder[]): StatusCount {
  const init: StatusCount = {
    paid: 0,
    qc_pending: 0,
    qc_flagged: 0,
    operator_review: 0,
    proof_pending: 0,
    in_production: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const o of orders) init[o.status]++;
  return init;
}

// ============================================================
// Top customers / cities
// ============================================================

export interface TopCustomer {
  name: string;
  phone: string;
  orderCount: number;
  totalRevenue: number;
  lastOrderAt: number;
}

export function topCustomers(
  orders: CustomerOrder[],
  limit = 5
): TopCustomer[] {
  const map = new Map<string, TopCustomer>();
  for (const o of orders) {
    const key = o.address.phone || o.address.name;
    const existing = map.get(key);
    if (existing) {
      existing.orderCount++;
      existing.totalRevenue += o.total;
      if (o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
      }
    } else {
      map.set(key, {
        name: o.address.name,
        phone: o.address.phone,
        orderCount: 1,
        totalRevenue: o.total,
        lastOrderAt: o.createdAt,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export interface TopCity {
  city: string;
  count: number;
  revenue: number;
}

export function topCities(orders: CustomerOrder[], limit = 5): TopCity[] {
  const map = new Map<string, TopCity>();
  for (const o of orders) {
    const city = (o.address.city || "Bilinmiyor").trim();
    const existing = map.get(city);
    if (existing) {
      existing.count++;
      existing.revenue += o.total;
    } else {
      map.set(city, { city, count: 1, revenue: o.total });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ============================================================
// Operational metrics
// ============================================================

export interface OperationalMetrics {
  /** AI flag oranı (qc_flagged / toplam) — % */
  aiFlagRate: number;
  /** İptal oranı — % */
  cancelRate: number;
  /** Ortalama tamamlanma süresi — saat (delivered'lar için) */
  avgFulfillmentHours: number | null;
  /** Bugünkü cevap süresi — proof_pending → onay'a kadar (yaklaşık) */
  avgProofResponseHours: number | null;
}

export function operationalMetrics(
  orders: CustomerOrder[]
): OperationalMetrics {
  if (orders.length === 0) {
    return {
      aiFlagRate: 0,
      cancelRate: 0,
      avgFulfillmentHours: null,
      avgProofResponseHours: null,
    };
  }

  const flagged = orders.filter((o) => o.status === "qc_flagged").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const delivered = orders.filter((o) => o.status === "delivered");

  // Fulfillment proxy: createdAt → updatedAt yok, estimatedDelivery'i kullanıyoruz
  // Bu yaklaşık; gerçek için orders.delivered_at kolonu lazım.
  const fulfillmentHours: number[] = [];
  for (const o of delivered) {
    if (o.estimatedDelivery) {
      const eta = new Date(o.estimatedDelivery).getTime();
      const hr = (eta - o.createdAt) / (1000 * 60 * 60);
      if (hr > 0 && hr < 24 * 30) fulfillmentHours.push(hr);
    }
  }
  const avgFulfillment =
    fulfillmentHours.length > 0
      ? fulfillmentHours.reduce((a, b) => a + b, 0) / fulfillmentHours.length
      : null;

  return {
    aiFlagRate: (flagged / orders.length) * 100,
    cancelRate: (cancelled / orders.length) * 100,
    avgFulfillmentHours: avgFulfillment,
    avgProofResponseHours: null, // Gerçek event log gelince hesaplanacak
  };
}

// ============================================================
// AI insights — basit kural-tabanlı (henüz LLM yok)
// ============================================================

export interface InsightItem {
  level: "good" | "warn" | "info";
  text: string;
}

export function generateInsights(orders: CustomerOrder[]): InsightItem[] {
  const insights: InsightItem[] = [];
  if (orders.length === 0) {
    insights.push({
      level: "info",
      text:
        "Henüz sipariş verisi yok. İlk siparişlerden sonra otomatik haftalık özet burada görünecek.",
    });
    return insights;
  }

  // 1) Ürün karışım trendi (son 7g vs önceki 7g)
  const now = Date.now();
  const last7 = orders.filter((o) => now - o.createdAt < 7 * DAY);
  const prev7 = orders.filter(
    (o) => now - o.createdAt >= 7 * DAY && now - o.createdAt < 14 * DAY
  );
  if (last7.length > 0 && prev7.length > 0) {
    const change = ((last7.length - prev7.length) / prev7.length) * 100;
    if (change > 20) {
      insights.push({
        level: "good",
        text: `Bu hafta sipariş sayısı %${change.toFixed(0)} arttı (${prev7.length} → ${last7.length})`,
      });
    } else if (change < -20) {
      insights.push({
        level: "warn",
        text: `Bu hafta sipariş sayısı %${Math.abs(change).toFixed(0)} azaldı (${prev7.length} → ${last7.length})`,
      });
    }
  }

  // 2) Ürün dağılımı dönüşü
  const mix = aggregateProductMix(last7);
  if (mix.etiket + mix.sticker > 0) {
    if (mix.sticker > mix.etiket * 1.5) {
      insights.push({
        level: "info",
        text: `Bu hafta sticker satışı etiketten %${(((mix.sticker - mix.etiket) / Math.max(mix.etiket, 1)) * 100).toFixed(0)} fazla`,
      });
    } else if (mix.etiket > mix.sticker * 2) {
      insights.push({
        level: "info",
        text: `Etiket talebi sticker'ın ${(mix.etiket / Math.max(mix.sticker, 1)).toFixed(1)}× fazlası`,
      });
    }
  }

  // 3) AI flag oranı yüksek mi
  const ops = operationalMetrics(orders);
  if (ops.aiFlagRate > 30) {
    insights.push({
      level: "warn",
      text: `AI flag oranı %${ops.aiFlagRate.toFixed(0)} — dosya kalite uyarısı yüksek, prompt'u gözden geçir`,
    });
  } else if (ops.aiFlagRate > 0 && ops.aiFlagRate < 10 && orders.length >= 10) {
    insights.push({
      level: "good",
      text: `AI flag oranı %${ops.aiFlagRate.toFixed(0)} — dosya kalitesi gayet iyi`,
    });
  }

  // 4) İptal oranı uyarısı
  if (ops.cancelRate > 15) {
    insights.push({
      level: "warn",
      text: `İptal oranı %${ops.cancelRate.toFixed(0)} — checkout sürecinde takılma olabilir`,
    });
  }

  // 5) Tekrar müşteri vurgusu
  const repeatMap = new Map<string, number>();
  for (const o of orders) {
    const k = o.address.phone;
    repeatMap.set(k, (repeatMap.get(k) ?? 0) + 1);
  }
  const repeats = Array.from(repeatMap.values()).filter((c) => c > 1).length;
  if (orders.length >= 5 && repeats / repeatMap.size >= 0.3) {
    insights.push({
      level: "good",
      text: `Müşterilerin %${((repeats / repeatMap.size) * 100).toFixed(0)}'i tekrar sipariş verdi — sadakat güçlü`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      level: "info",
      text:
        "Henüz dikkat çeken bir trend yok. Daha fazla sipariş geldikçe otomatik özetler artacak.",
    });
  }

  return insights;
}

// ============================================================
// Format helpers
// ============================================================

export function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h.toFixed(1)} sa`;
  return `${(h / 24).toFixed(1)} gün`;
}

export function formatCurrency(n: number): string {
  if (n === 0) return "₺0";
  return `₺${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
