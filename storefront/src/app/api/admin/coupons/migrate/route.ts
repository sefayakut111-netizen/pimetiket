/**
 * POST /api/admin/coupons/migrate — localStorage kuponlarını DB'ye aktar (bir kerelik)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface LegacyCoupon {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
  maxUses?: number | null;
  usedCount?: number;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
}

export async function POST(req: Request) {
  const auth = await assertPermission("coupons", "create");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { coupons?: LegacyCoupon[] };
  const items = body.coupons ?? [];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, migrated: 0 });
  }

  const admin = createAdminClient();
  let migrated = 0;

  for (const c of items) {
    const code = c.code?.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
    if (!code) continue;

    const { data: existing } = await admin
      .from("coupons")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (existing) continue;

    const starts_at = c.validFrom
      ? new Date(`${c.validFrom}T00:00:00+03:00`).toISOString()
      : new Date().toISOString();
    const expires_at = c.validTo
      ? new Date(`${c.validTo}T23:59:59+03:00`).toISOString()
      : null;

    const { error } = await admin.from("coupons").insert({
      code,
      kind: c.type === "fixed" ? "fixed" : "percent",
      value: c.value,
      min_subtotal: c.minSubtotal ?? 0,
      total_uses_limit: c.maxUses ?? null,
      starts_at,
      expires_at,
      is_active: c.active ?? true,
      created_by: auth.user.id,
    });

    if (!error) migrated += 1;
  }

  return NextResponse.json({ ok: true, migrated });
}
