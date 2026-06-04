/**
 * GET /api/admin/traffic?range=7d|28d|90d
 *
 * GA4 Data API — admin trafik özeti (service account, server-side).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import {
  getTrafficSummary,
  getGa4SetupStatus,
  type TrafficRange,
  type TrafficSummary,
  type TrafficNotConfigured,
} from "@/lib/analytics/ga4-data-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RangeSchema = z.enum(["7d", "28d", "90d"]);

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  at: number;
  data: TrafficSummary | TrafficNotConfigured;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(range: TrafficRange): string {
  return `traffic:${range}`;
}

function getCached(range: TrafficRange): CacheEntry | null {
  const entry = cache.get(cacheKey(range));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(cacheKey(range));
    return null;
  }
  return entry;
}

function setCache(range: TrafficRange, data: TrafficSummary | TrafficNotConfigured) {
  cache.set(cacheKey(range), { at: Date.now(), data });
}

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = RangeSchema.safeParse(searchParams.get("range") ?? "28d");
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  const range = parsed.data;

  const hit = getCached(range);
  if (hit) {
    return NextResponse.json(hit.data);
  }

  try {
    const data = await getTrafficSummary(range);
    setCache(range, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/traffic]", err);
    const reason =
      err instanceof Error ? err.message : "Trafik verisi alınamadı";
    const setup = getGa4SetupStatus();
    const isNoAccess =
      /PERMISSION_DENIED|permission|sufficient permissions|403|not have access/i.test(
        reason
      );
    const fallback: TrafficNotConfigured = {
      configured: false,
      kind: setup.ready
        ? isNoAccess
          ? "no_access"
          : "error"
        : "env_missing",
      reason,
      setup,
    };
    return NextResponse.json(fallback);
  }
}
