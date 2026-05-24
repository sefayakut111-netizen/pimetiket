/**
 * /api/admin/settings
 *
 * GET   — Mevcut site_settings (singleton row id=1)
 * PATCH — Güncelle (admin/staff)
 *
 * Alanlar (Migration 029):
 *   - shipping_fee_try
 *   - free_shipping_threshold
 *   - welcome_credit_try
 *   - referral_credit_try
 *   - min_subtotal_for_credit
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";
import { assertPermission } from "@/lib/supabase/assert-permission";

export const dynamic = "force-dynamic";

interface BodyShape {
  shipping_fee_try?: unknown;
  free_shipping_threshold?: unknown;
  welcome_credit_try?: unknown;
  referral_credit_try?: unknown;
  min_subtotal_for_credit?: unknown;
  // Sefa 18 May Migration 053: min/max sipariş tutarı
  min_order_total_try?: unknown;
  max_order_total_try?: unknown;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  // Sefa 21 May v68: GET artık admin-only.
  // Müşteri tarafı /api/public/settings kullanır (PII gizli, müşteri-görür
  // alanlar). Admin endpoint tüm field'ları döndürür (updated_by dahil).
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = serviceClient();
  const { data, error } = await admin
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Migration 029 çalışmadıysa default değerlerle dön
  if (!data) {
    return NextResponse.json({
      settings: {
        id: 1,
        shipping_fee_try: 49,
        free_shipping_threshold: 1000,
        welcome_credit_try: 250,
        referral_credit_try: 250,
        min_subtotal_for_credit: 500,
        min_order_total_try: 250,
        max_order_total_try: 250000,
        updated_at: null,
      },
      stale: true,
    });
  }
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: Request) {
  // Sefa 18 May v68 (RBAC yayma): Site ayarları sadece super_admin
  // (operations bile değiştirememeli — sistem geneli ayar, kritik).
  const auth = await assertPermission("settings", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, number> = {};
  const fields = [
    "shipping_fee_try",
    "free_shipping_threshold",
    "welcome_credit_try",
    "referral_credit_try",
    "min_subtotal_for_credit",
    // Sefa 18 May Migration 053
    "min_order_total_try",
    "max_order_total_try",
  ] as const;
  for (const f of fields) {
    const v = body[f];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      update[f] = Math.round(v * 100) / 100;
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Güncellenecek alan yok" },
      { status: 400 }
    );
  }

  const admin = serviceClient();
  const { data, error } = await admin
    .from("site_settings")
    .update({ ...update, updated_by: auth.user.id })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    console.error("[admin/settings PATCH]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "settings.update",
    targetType: "site_settings",
    targetId: "1",
    summary: `Site ayarları güncellendi: ${Object.keys(update).join(", ")}`,
    detail: update,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ settings: data });
}
