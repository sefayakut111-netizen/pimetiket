/**
 * Pricing stats — admin tool için iş emri kayıtları + agregasyon.
 *
 * Her PDF iş emri üretildiğinde bir StatRecord düşer (otomatik).
 * Modal'da agregasyon: toplam adet/ciro/m², popular boyutlar,
 * mode dağılımı, aylık kırılım.
 *
 * Auth + DB'de Block C.5'te swap olur (server-side stats).
 */

const STORAGE_KEY = "pim_pricing_stats_v1";
const MAX_RECORDS = 500;

// ============================================================
// Types
// ============================================================

export interface StatRecord {
  /** Lot numarası — A000001 / B000123 vs */
  lot: string;
  /** Ürün tipi */
  product: "sticker" | "etiket";
  /** Üretim modu */
  mode: "fason" | "uretim";
  /** Sticker özel — kesim tipi */
  cut?: "tabaka" | "diecut";
  /** Etiket özel — material/coating/customization */
  materialId?: string;
  coatingId?: string;
  customizationId?: string;
  /** Boyut */
  width: number;
  height: number;
  /** Adetler */
  requestedQty: number;
  producedQty: number;
  overrunCount: number;
  /** Üretim metrik */
  rollsNeeded: number;
  totalM2: number;
  wastePct: number;
  /** Maliyet + fiyat */
  baseCost: number;
  intendedProfit: number;
  actualProfit: number;
  vatAmount: number;
  total: number;
  unitPrice: number;
  /** Tier */
  tierMultiplier: number;
  /** Müşteri (varsa — manuel sipariş için) */
  customerName?: string;
  /** Tarih */
  timestamp: number;
  iso: string;
}

export interface StatsAggregate {
  count: number;
  // Toplam
  totalRequested: number;
  totalProduced: number;
  totalM2: number;
  totalRevenue: number;
  totalIntendedProfit: number;
  totalActualProfit: number;
  totalBaseCost: number;
  // Ortalama
  avgWaste: number;
  avgUnitPrice: number;
  // Dağılım
  byProduct: { sticker: number; etiket: number };
  byMode: { fason: number; uretim: number };
  byCut: { tabaka: number; diecut: number };
  // Popüler boyutlar
  bySize: Record<string, { count: number; product: "sticker" | "etiket" }>;
  // Aylık kırılım
  byMonth: Record<
    string,
    { count: number; m2: number; revenue: number; profit: number }
  >;
}

// ============================================================
// Storage
// ============================================================

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listStats(): StatRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StatRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStats(records: StatRecord[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pim_stats_updated"));
    }
  } catch {
    // localStorage dolu — silently
  }
}

// ============================================================
// CRUD
// ============================================================

export function recordStat(record: Omit<StatRecord, "timestamp" | "iso">): StatRecord {
  const now = Date.now();
  const fresh: StatRecord = {
    ...record,
    timestamp: now,
    iso: new Date(now).toISOString(),
  };
  const all = listStats();
  all.unshift(fresh); // en yeni başta
  if (all.length > MAX_RECORDS) all.length = MAX_RECORDS;
  writeStats(all);
  return fresh;
}

export function clearStats(): void {
  writeStats([]);
}

// ============================================================
// Aggregate
// ============================================================

export function aggregateStats(records: StatRecord[]): StatsAggregate {
  const sum: StatsAggregate = {
    count: records.length,
    totalRequested: 0,
    totalProduced: 0,
    totalM2: 0,
    totalRevenue: 0,
    totalIntendedProfit: 0,
    totalActualProfit: 0,
    totalBaseCost: 0,
    avgWaste: 0,
    avgUnitPrice: 0,
    byProduct: { sticker: 0, etiket: 0 },
    byMode: { fason: 0, uretim: 0 },
    byCut: { tabaka: 0, diecut: 0 },
    bySize: {},
    byMonth: {},
  };

  if (records.length === 0) return sum;

  let totalWaste = 0;
  let totalUnitPrice = 0;

  for (const r of records) {
    sum.totalRequested += r.requestedQty;
    sum.totalProduced += r.producedQty;
    sum.totalM2 += r.totalM2;
    sum.totalRevenue += r.total;
    sum.totalIntendedProfit += r.intendedProfit;
    sum.totalActualProfit += r.actualProfit;
    sum.totalBaseCost += r.baseCost;

    totalWaste += r.wastePct;
    totalUnitPrice += r.unitPrice;

    sum.byProduct[r.product]++;
    sum.byMode[r.mode]++;
    if (r.cut) sum.byCut[r.cut]++;

    // Boyut anahtarı: "WxH"
    const sizeKey = `${r.width}×${r.height}`;
    if (!sum.bySize[sizeKey]) {
      sum.bySize[sizeKey] = { count: 0, product: r.product };
    }
    sum.bySize[sizeKey].count++;

    // Aylık
    const dt = new Date(r.timestamp);
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    if (!sum.byMonth[monthKey]) {
      sum.byMonth[monthKey] = { count: 0, m2: 0, revenue: 0, profit: 0 };
    }
    sum.byMonth[monthKey].count++;
    sum.byMonth[monthKey].m2 += r.totalM2;
    sum.byMonth[monthKey].revenue += r.total;
    sum.byMonth[monthKey].profit += r.actualProfit;
  }

  sum.avgWaste = totalWaste / records.length;
  sum.avgUnitPrice = totalUnitPrice / records.length;

  return sum;
}

/** Top N popular sizes (count desc) */
export function topSizes(
  agg: StatsAggregate,
  limit = 5
): Array<{ size: string; count: number; product: string }> {
  return Object.entries(agg.bySize)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([size, { count, product }]) => ({ size, count, product }));
}

/** Last N records (already in unshift order) */
export function recentRecords(records: StatRecord[], limit = 10): StatRecord[] {
  return records.slice(0, limit);
}

/** Months sorted descending (newest first) */
export function recentMonths(
  agg: StatsAggregate,
  limit = 6
): Array<{
  month: string;
  count: number;
  m2: number;
  revenue: number;
  profit: number;
}> {
  return Object.entries(agg.byMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([month, data]) => ({ month, ...data }));
}

export const STATS_LIMIT = MAX_RECORDS;
