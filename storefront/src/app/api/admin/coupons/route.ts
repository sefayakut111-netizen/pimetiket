/**
 * /api/admin/coupons — Kupon CRUD (DB: public.coupons)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

type AuditAction = Database["public"]["Enums"]["audit_action"];
type CouponUpdate = Database["public"]["Tables"]["coupons"]["Update"];

type CouponKind = "percent" | "fixed";
type DiscountType = "percent" | "fixed";

interface CouponRow {
  id: string;
  code: string;
  kind: CouponKind | "free_ship";
  value: number;
  min_subtotal: number;
  total_uses_limit: number | null;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminCouponDto {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  createdAt: number;
}

export interface CouponAnalytics {
  totalUsage: number;
  totalDiscount: number;
  topCoupons: Array<{
    code: string;
    usedCount: number;
    totalDiscount: number;
  }>;
  usageTrend: Array<{
    date: string;
    count: number;
    discount: number;
  }>;
}

function toDto(row: CouponRow, usedCount: number): AdminCouponDto {
  return {
    id: row.id,
    code: row.code,
    type: row.kind === "fixed" ? "fixed" : "percent",
    value: Number(row.value),
    minSubtotal: Number(row.min_subtotal),
    maxUses: row.total_uses_limit,
    usedCount,
    validFrom: row.starts_at.slice(0, 10),
    validTo: row.expires_at?.slice(0, 10) ?? "",
    active: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function usageCounts(
  admin: ReturnType<typeof createAdminClient>,
  couponIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (couponIds.length === 0) return map;

  const { data, error } = await admin
    .from("coupon_uses")
    .select("coupon_id")
    .in("coupon_id", couponIds);

  if (error) {
    console.error("[admin/coupons] usage count error:", error);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.coupon_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function fetchAnalytics(
  admin: ReturnType<typeof createAdminClient>
): Promise<CouponAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: uses, error: usesErr } = await admin
    .from("coupon_uses")
    .select("coupon_id, discount_amount, used_at")
    .gte("used_at", since.toISOString());

  if (usesErr) {
    console.error("[admin/coupons] analytics uses error:", usesErr);
    return {
      totalUsage: 0,
      totalDiscount: 0,
      topCoupons: [],
      usageTrend: [],
    };
  }

  const rows = uses ?? [];
  let totalUsage = rows.length;
  let totalDiscount = 0;
  const byCoupon = new Map<string, { count: number; discount: number }>();
  const byDate = new Map<string, { count: number; discount: number }>();

  for (const row of rows) {
    const discount = Number(row.discount_amount ?? 0);
    totalDiscount += discount;

    const cid = row.coupon_id as string;
    const cur = byCoupon.get(cid) ?? { count: 0, discount: 0 };
    cur.count += 1;
    cur.discount += discount;
    byCoupon.set(cid, cur);

    const day = (row.used_at as string).slice(0, 10);
    const dayCur = byDate.get(day) ?? { count: 0, discount: 0 };
    dayCur.count += 1;
    dayCur.discount += discount;
    byDate.set(day, dayCur);
  }

  const couponIds = [...byCoupon.keys()];
  const codeById = new Map<string, string>();
  if (couponIds.length > 0) {
    const { data: couponRows } = await admin
      .from("coupons")
      .select("id, code")
      .in("id", couponIds);
    for (const c of couponRows ?? []) {
      codeById.set(c.id as string, c.code as string);
    }
  }

  const topCoupons = [...byCoupon.entries()]
    .map(([id, stats]) => ({
      code: codeById.get(id) ?? id.slice(0, 8),
      usedCount: stats.count,
      totalDiscount: Math.round(stats.discount),
    }))
    .sort((a, b) => b.usedCount - a.usedCount)
    .slice(0, 5);

  const usageTrend = [...byDate.entries()]
    .map(([date, stats]) => ({
      date,
      count: stats.count,
      discount: Math.round(stats.discount),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalUsage,
    totalDiscount: Math.round(totalDiscount),
    topCoupons,
    usageTrend,
  };
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  auth: NonNullable<Awaited<ReturnType<typeof assertPermission>>>,
  action: AuditAction,
  resourceId: string,
  summary: string,
  detail: Json
) {
  await admin.from("audit_log").insert({
    actor_id: auth.user.id,
    actor_email: auth.user.email ?? null,
    actor_role: auth.role,
    action,
    target_type: "coupon",
    target_id: resourceId,
    summary,
    detail,
  });
}

export async function GET() {
  const auth = await assertPermission("coupons", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/coupons] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as CouponRow[];
  const counts = await usageCounts(
    admin,
    rows.map((r) => r.id)
  );
  const analytics = await fetchAnalytics(admin);

  return NextResponse.json({
    ok: true,
    coupons: rows.map((r) => toDto(r, counts.get(r.id) ?? 0)),
    analytics,
  });
}

export async function POST(req: Request) {
  const auth = await assertPermission("coupons", "create");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    code?: string;
    type?: DiscountType;
    value?: number;
    min_subtotal?: number;
    minSubtotal?: number;
    max_uses?: number | null;
    maxUses?: number | null;
    valid_from?: string;
    validFrom?: string;
    valid_to?: string;
    validTo?: string;
  };

  const code = body.code?.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
  if (!code) {
    return NextResponse.json({ ok: false, error: "Kod gerekli" }, { status: 400 });
  }

  const kind: CouponKind = body.type === "fixed" ? "fixed" : "percent";
  const value = Number(body.value ?? 0);
  const minSubtotal = Number(body.min_subtotal ?? body.minSubtotal ?? 0);
  const maxUses = body.max_uses ?? body.maxUses ?? null;
  const validFrom = body.valid_from ?? body.validFrom;
  const validTo = body.valid_to ?? body.validTo;

  const starts_at = validFrom
    ? new Date(`${validFrom}T00:00:00+03:00`).toISOString()
    : new Date().toISOString();
  const expires_at = validTo
    ? new Date(`${validTo}T23:59:59+03:00`).toISOString()
    : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .insert({
      code,
      kind,
      value,
      min_subtotal: minSubtotal,
      total_uses_limit: maxUses,
      starts_at,
      expires_at,
      is_active: true,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[admin/coupons] POST error:", error);
    const msg =
      error.code === "23505" ? "Bu kod zaten var" : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const row = data as CouponRow;
  await writeAudit(admin, auth, "coupon.create", row.id, `Kupon oluşturuldu: ${code}`, {
    code,
    kind,
    value,
  });

  return NextResponse.json({ ok: true, coupon: toDto(row, 0) });
}

export async function PATCH(req: Request) {
  const auth = await assertPermission("coupons", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    active?: boolean;
    value?: number;
    min_subtotal?: number;
    minSubtotal?: number;
    max_uses?: number | null;
    maxUses?: number | null;
    valid_from?: string;
    validFrom?: string;
    valid_to?: string;
    validTo?: string;
  };

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });
  }

  const patch: CouponUpdate = {};
  if (typeof body.active === "boolean") patch.is_active = body.active;
  if (body.value != null) patch.value = body.value;
  if (body.min_subtotal != null || body.minSubtotal != null) {
    patch.min_subtotal = body.min_subtotal ?? body.minSubtotal;
  }
  if ("max_uses" in body || "maxUses" in body) {
    patch.total_uses_limit = body.max_uses ?? body.maxUses ?? null;
  }
  const validFrom = body.valid_from ?? body.validFrom;
  const validTo = body.valid_to ?? body.validTo;
  if (validFrom) {
    patch.starts_at = new Date(`${validFrom}T00:00:00+03:00`).toISOString();
  }
  if (validTo !== undefined) {
    patch.expires_at = validTo
      ? new Date(`${validTo}T23:59:59+03:00`).toISOString()
      : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Güncellenecek alan yok" }, {
      status: 400,
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) {
    console.error("[admin/coupons] PATCH error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = data as CouponRow;
  const counts = await usageCounts(admin, [row.id]);
  await writeAudit(admin, auth, "coupon.update", row.id, `Kupon güncellendi: ${row.code}`, {
    patch,
  });

  return NextResponse.json({
    ok: true,
    coupon: toDto(row, counts.get(row.id) ?? 0),
  });
}

export async function DELETE(req: Request) {
  const auth = await assertPermission("coupons", "delete");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const idFromQuery = url.searchParams.get("id");
  let id = idFromQuery;
  if (!id) {
    try {
      const body = (await req.json()) as { id?: string };
      id = body.id ?? null;
    } catch {
      /* body yok */
    }
  }

  if (!id) {
    return NextResponse.json({ ok: false, error: "id gerekli" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("coupons").delete().eq("id", id);

  if (error) {
    console.error("[admin/coupons] DELETE error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await writeAudit(admin, auth, "coupon.delete", id, "Kupon silindi", {});

  return NextResponse.json({ ok: true });
}
