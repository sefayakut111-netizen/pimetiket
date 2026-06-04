import { BetaAnalyticsDataClient } from "@google-analytics/data";

export type TrafficRange = "7d" | "28d" | "90d";

export interface TrafficSummary {
  configured: true;
  range: TrafficRange;
  totals: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionSec: number;
    bounceRate: number;
  };
  byDay: Array<{
    date: string;
    users: number;
    sessions: number;
    pageViews: number;
  }>;
  topPages: Array<{ path: string; views: number }>;
  sources: Array<{ source: string; sessions: number }>;
}

export interface Ga4SetupStatus {
  measurementIdSet: boolean;
  measurementId: string | null;
  dataApi: {
    propertyId: boolean;
    clientEmail: boolean;
    privateKey: boolean;
  };
  missing: string[];
  ready: boolean;
}

export interface TrafficNotConfigured {
  configured: false;
  kind: "env_missing" | "no_access" | "error";
  reason: string;
  setup: Ga4SetupStatus;
}

type GaRow = {
  dimensionValues?: { value?: string | null }[] | null;
  metricValues?: { value?: string | null }[] | null;
};

const RANGE_DAYS: Record<TrafficRange, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
};

export function getGa4SetupStatus(): Ga4SetupStatus {
  const measurementId =
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || null;
  const propertyId = Boolean(process.env.GA4_PROPERTY_ID?.trim());
  const clientEmail = Boolean(
    process.env.GA4_SA_CLIENT_EMAIL?.trim() ||
      process.env.GSC_SA_CLIENT_EMAIL?.trim()
  );
  const privateKey = Boolean(
    process.env.GA4_SA_PRIVATE_KEY?.trim() ||
      process.env.GSC_SA_PRIVATE_KEY?.trim()
  );
  const missing: string[] = [];
  if (!propertyId) missing.push("GA4_PROPERTY_ID");
  if (!clientEmail) missing.push("GA4_SA_CLIENT_EMAIL (veya GSC_SA_CLIENT_EMAIL)");
  if (!privateKey) missing.push("GA4_SA_PRIVATE_KEY (veya GSC_SA_PRIVATE_KEY)");
  return {
    measurementIdSet: Boolean(measurementId),
    measurementId,
    dataApi: { propertyId, clientEmail, privateKey },
    missing,
    ready: propertyId && clientEmail && privateKey,
  };
}

function getClient(): BetaAnalyticsDataClient | null {
  const setup = getGa4SetupStatus();
  if (!setup.ready) return null;
  const email =
    process.env.GA4_SA_CLIENT_EMAIL?.trim() ||
    process.env.GSC_SA_CLIENT_EMAIL?.trim();
  const key = (
    process.env.GA4_SA_PRIVATE_KEY || process.env.GSC_SA_PRIVATE_KEY
  )?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return new BetaAnalyticsDataClient({
    credentials: { client_email: email, private_key: key },
  });
}

function metricAt(row: GaRow, index: number): number {
  const raw = row.metricValues?.[index]?.value;
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function dimAt(row: GaRow, index: number): string {
  return row.dimensionValues?.[index]?.value ?? "";
}

function formatGaDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(y, m, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

function parseTotalsRow(row: GaRow | null | undefined) {
  if (!row) {
    return {
      activeUsers: 0,
      sessions: 0,
      pageViews: 0,
      avgSessionSec: 0,
      bounceRate: 0,
    };
  }
  return {
    activeUsers: metricAt(row, 0),
    sessions: metricAt(row, 1),
    pageViews: metricAt(row, 2),
    avgSessionSec: metricAt(row, 3),
    bounceRate: metricAt(row, 4),
  };
}

export async function getTrafficSummary(
  range: TrafficRange
): Promise<TrafficSummary | TrafficNotConfigured> {
  const setup = getGa4SetupStatus();
  const client = getClient();
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!client || !propertyId) {
    return {
      configured: false,
      kind: "env_missing",
      reason:
        setup.missing.length > 0
          ? `Admin paneli için eksik env: ${setup.missing.join(", ")}`
          : "GA4 Data API env eksik",
      setup,
    };
  }

  const property = `properties/${propertyId}`;
  const startDate = `${RANGE_DAYS[range]}daysAgo`;
  const dateRange = [{ startDate, endDate: "today" as const }];

  const dailyMetrics = [
    { name: "activeUsers" },
    { name: "sessions" },
    { name: "screenPageViews" },
    { name: "averageSessionDuration" },
    { name: "bounceRate" },
  ];

  try {
    const [dailyRes, pagesRes, sourcesRes] = await Promise.all([
      client.runReport({
        property,
        dateRanges: dateRange,
        dimensions: [{ name: "date" }],
        metrics: dailyMetrics,
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      client.runReport({
        property,
        dateRanges: dateRange,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 15,
      }),
      client.runReport({
        property,
        dateRanges: dateRange,
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
    ]);

    const daily = dailyRes[0];
    const pages = pagesRes[0];
    const sources = sourcesRes[0];

    const byDay = [...(daily.rows ?? [])]
      .sort((a, b) => dimAt(a, 0).localeCompare(dimAt(b, 0)))
      .map((row) => ({
        date: formatGaDate(dimAt(row, 0)),
        users: metricAt(row, 0),
        sessions: metricAt(row, 1),
        pageViews: metricAt(row, 2),
      }));

    const topPages = (pages.rows ?? []).map((row) => ({
      path: dimAt(row, 0) || "/",
      views: metricAt(row, 0),
    }));

    const sourceRows = (sources.rows ?? []).map((row) => ({
      source: dimAt(row, 0) || "(direct)",
      sessions: metricAt(row, 0),
    }));

    return {
      configured: true,
      range,
      totals: parseTotalsRow(daily.totals?.[0]),
      byDay,
      topPages,
      sources: sourceRows,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "GA4 Data API isteği başarısız";
    const isNoAccess =
      /PERMISSION_DENIED|permission|sufficient permissions|403|not have access/i.test(
        message
      );
    return {
      configured: false,
      kind: isNoAccess ? "no_access" : "error",
      reason: message,
      setup: getGa4SetupStatus(),
    };
  }
}
