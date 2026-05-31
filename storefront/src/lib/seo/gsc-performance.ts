/**
 * Google Search Console Search Analytics API (sorgu/tıklama özeti).
 * Ön koşul: GSC_SA_* veya GA4_SA_* + Search Console API etkin + site owner.
 */

import { GoogleAuth } from "google-auth-library";
import { getSiteUrl } from "@/lib/site-url";

const WEBMASTERS_READONLY =
  "https://www.googleapis.com/auth/webmasters.readonly";

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceSummary {
  configured: boolean;
  ok: boolean;
  rows: GscQueryRow[];
  detail: string;
}

function getCredentials():
  | { client_email: string; private_key: string }
  | null {
  const email =
    process.env.GSC_SA_CLIENT_EMAIL?.trim() ||
    process.env.GA4_SA_CLIENT_EMAIL?.trim();
  const key = (
    process.env.GSC_SA_PRIVATE_KEY || process.env.GA4_SA_PRIVATE_KEY
  )?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return { client_email: email, private_key: key };
}

function gscSiteUrl(): string {
  const raw = process.env.GSC_SITE_URL?.trim() || getSiteUrl();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** Son N günün en çok tıklanan sorguları (max 25 satır) */
export async function fetchGscTopQueries(
  days = 28
): Promise<GscPerformanceSummary> {
  const creds = getCredentials();
  if (!creds) {
    return {
      configured: false,
      ok: false,
      rows: [],
      detail: "GSC_SA_* veya GA4_SA_* env yok",
    };
  }

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const auth = new GoogleAuth({
      credentials: creds,
      scopes: [WEBMASTERS_READONLY],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      return {
        configured: true,
        ok: false,
        rows: [],
        detail: "Access token alınamadı",
      };
    }

    const site = encodeURIComponent(gscSiteUrl());
    const url = `https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["query"],
        rowLimit: 25,
      }),
      cache: "no-store",
    });

    const json = (await res.json()) as {
      rows?: Array<{
        keys?: string[];
        clicks?: number;
        impressions?: number;
        ctr?: number;
        position?: number;
      }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        rows: [],
        detail: json.error?.message ?? `HTTP ${res.status}`,
      };
    }

    const rows: GscQueryRow[] = (json.rows ?? []).map((r) => ({
      query: r.keys?.[0] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));

    return {
      configured: true,
      ok: true,
      rows,
      detail: `${rows.length} sorgu satırı (${days} gün)`,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      rows: [],
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
