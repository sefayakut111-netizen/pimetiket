/**
 * GET /api/admin/prova/readiness?orderIds=id1,id2
 *
 * cutline_designs ozeti — bıçak + beyaz katman durum rozeti (C1).
 * GET /api/admin/prova/readiness?stats=1 — KPI ozeti (C5).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestOrderLike } from "@/lib/admin-order-filters";

export const dynamic = "force-dynamic";

const SLA_MS = 36 * 60 * 60 * 1000;

type ReadinessLevel = "ok" | "cutline_only" | "missing";

function hasCutlineRow(row: {
  svg_url: string | null;
}): boolean {
  return Boolean(row.svg_url?.trim());
}

function hasWhiteRow(row: {
  white_plan_mode: string | null;
  white_plan_path_count: number | null;
  has_custom_white_plan: boolean | null;
}): boolean {
  const mode = row.white_plan_mode;
  if (!mode || mode === "off") return false;
  const count = row.white_plan_path_count ?? 0;
  return count > 0 || row.has_custom_white_plan === true;
}

function levelFromFlags(hasCutline: boolean, hasWhite: boolean): ReadinessLevel {
  if (hasCutline && hasWhite) return "ok";
  if (hasCutline) return "cutline_only";
  return "missing";
}

function aggregateOrderLevel(
  itemLevels: ReadinessLevel[]
): ReadinessLevel {
  if (itemLevels.length === 0) return "missing";
  if (itemLevels.some((l) => l === "missing")) return "missing";
  if (itemLevels.some((l) => l === "cutline_only")) return "cutline_only";
  return "ok";
}

export async function GET(req: Request) {
  const auth = await assertPermission("proof", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("stats") === "1") {
    return getKpiStats();
  }

  const orderIds = (url.searchParams.get("orderIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: true, readiness: {} });
  }

  const admin = createAdminClient();

  const { data: itemRows, error: itemErr } = await admin
    .from("order_items")
    .select("id, order_id")
    .in("order_id", orderIds);

  if (itemErr) {
    return NextResponse.json(
      { error: "readiness_failed", detail: itemErr.message },
      { status: 500 }
    );
  }

  const itemsByOrder = new Map<string, string[]>();
  for (const it of itemRows ?? []) {
    const list = itemsByOrder.get(it.order_id) ?? [];
    list.push(it.id);
    itemsByOrder.set(it.order_id, list);
  }

  const { data, error } = await admin
    .from("cutline_designs")
    .select(
      "order_id, order_item_id, svg_url, white_plan_mode, white_plan_path_count, has_custom_white_plan, created_at, status"
    )
    .in("order_id", orderIds)
    .neq("status", "superseded")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "readiness_failed", detail: error.message },
      { status: 500 }
    );
  }

  const latestByItem = new Map<
    string,
    {
      order_id: string;
      order_item_id: string;
      svg_url: string | null;
      white_plan_mode: string | null;
      white_plan_path_count: number | null;
      has_custom_white_plan: boolean | null;
    }
  >();

  for (const row of data ?? []) {
    const key = `${row.order_id}:${row.order_item_id}`;
    if (!latestByItem.has(key)) {
      latestByItem.set(key, row);
    }
  }

  const levelByItem = new Map<string, ReadinessLevel>();
  for (const row of latestByItem.values()) {
    const key = `${row.order_id}:${row.order_item_id}`;
    const hasCut = hasCutlineRow(row);
    const hasW = hasWhiteRow(row);
    levelByItem.set(key, levelFromFlags(hasCut, hasW));
  }

  const readiness: Record<
    string,
    { level: ReadinessLevel; hasCutline: boolean; hasWhite: boolean }
  > = {};

  for (const oid of orderIds) {
    const itemIds = itemsByOrder.get(oid) ?? [];
    const levels: ReadinessLevel[] = itemIds.map((itemId) => {
      const key = `${oid}:${itemId}`;
      return levelByItem.get(key) ?? "missing";
    });
    const level = aggregateOrderLevel(levels);
    const hasCutline =
      levels.length > 0 && !levels.every((l) => l === "missing");
    const hasWhite = level === "ok";
    readiness[oid] = { level, hasCutline, hasWhite };
  }

  return NextResponse.json({ ok: true, readiness });
}

async function getKpiStats() {
  const admin = createAdminClient();
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: orderRows, error: orderErr } = await admin
    .from("orders")
    .select("id, status, created_at, address")
    .in("status", [
      "proof_pending",
      "proof_generating",
      "proof_validating",
      "proof_approved",
      "cancelled",
      "human_review_failed",
    ] as const);

  if (orderErr) {
    return NextResponse.json(
      { error: "kpi_failed", detail: orderErr.message },
      { status: 500 }
    );
  }

  const orders = excludeTestOrderLikesFromRows(orderRows ?? []);

  let pending = 0;
  let slaBreached = 0;
  for (const o of orders) {
    if (o.status !== "proof_pending") continue;
    pending++;
    const created = new Date(o.created_at).getTime();
    if (now - created > SLA_MS) slaBreached++;
  }

  const { data: approvedEvents, error: evErr } = await admin
    .from("order_events")
    .select("order_id, created_at")
    .eq("status_after", "proof_approved")
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);

  if (evErr) {
    return NextResponse.json(
      { error: "kpi_failed", detail: evErr.message },
      { status: 500 }
    );
  }

  const testIds = new Set(
    (orderRows ?? [])
      .filter((r) => isTestOrderLike({ id: r.id, address: r.address as { name?: string } }))
      .map((r) => r.id)
  );

  const approvedTodayIds = new Set<string>();
  for (const ev of approvedEvents ?? []) {
    if (!testIds.has(ev.order_id)) approvedTodayIds.add(ev.order_id);
  }

  const { data: transitionEvents, error: trErr } = await admin
    .from("order_events")
    .select("order_id, created_at, status_after")
    .in("status_after", ["proof_pending", "proof_approved"])
    .gte(
      "created_at",
      new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    )
    .order("created_at", { ascending: true })
    .limit(2000);

  if (trErr) {
    return NextResponse.json(
      { error: "kpi_failed", detail: trErr.message },
      { status: 500 }
    );
  }

  const pendingAt = new Map<string, number>();
  const responseHours: number[] = [];

  for (const ev of transitionEvents ?? []) {
    if (testIds.has(ev.order_id)) continue;
    const t = new Date(ev.created_at).getTime();
    if (ev.status_after === "proof_pending") {
      pendingAt.set(ev.order_id, t);
    } else if (ev.status_after === "proof_approved") {
      const start = pendingAt.get(ev.order_id);
      if (start != null && t > start) {
        responseHours.push((t - start) / 3600000);
        pendingAt.delete(ev.order_id);
      }
    }
  }

  const avgResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((a, b) => a + b, 0) / responseHours.length
      : 0;

  return NextResponse.json({
    ok: true,
    kpi: {
      pending,
      approvedToday: approvedTodayIds.size,
      avgResponseHours,
      slaBreached,
    },
  });
}

function excludeTestOrderLikesFromRows(
  rows: Array<{
    id: string;
    status: string;
    created_at: string;
    address: unknown;
  }>
) {
  return rows.filter(
    (r) =>
      !isTestOrderLike({
        id: r.id,
        address: r.address as { name?: string } | null,
      })
  );
}
