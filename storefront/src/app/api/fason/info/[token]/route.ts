/**
 * GET /api/fason/info/[token]
 *
 * Fason web form'unun sipariş özet bilgisi.
 * Token-auth, public.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Token doğrula
  const { data: validateData } = await admin.rpc(
    "fn_validate_fason_token" as never,
    { p_token: token } as never
  );
  const validation = (validateData as Array<{
    assignment_id: string;
    fason_partner_id: string;
    order_id: string;
    is_valid: boolean;
    reason: string;
  }>)?.[0];

  if (!validation?.is_valid) {
    return NextResponse.json(
      { error: "Token geçersiz", reason: validation?.reason ?? "unknown" },
      { status: 401 }
    );
  }

  // Assignment + order + items
  const { data: assignment } = await admin
    .from("order_assignments")
    .select(
      "id, status, estimated_delivery, notes, assigned_at, acknowledged_at, in_production_at, ready_at, shipped_at, tracking_company, tracking_number"
    )
    .eq("id", validation.assignment_id)
    .maybeSingle();

  const { data: order } = await admin
    .from("orders")
    .select("id, address, created_at")
    .eq("id", validation.order_id)
    .maybeSingle();

  const { data: items } = await admin
    .from("order_items")
    .select("product, title, config, width, height, qty, meta")
    .eq("order_id", validation.order_id);

  const { data: fason } = await admin
    .from("fason_partners")
    .select("name")
    .eq("id", validation.fason_partner_id)
    .maybeSingle();

  return NextResponse.json({
    assignment,
    order,
    items: items ?? [],
    fasonName: (fason as { name: string } | null)?.name ?? null,
    downloadUrl: `/api/fason/download/${token}`,
  });
}
