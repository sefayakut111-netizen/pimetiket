/**
 * /api/admin/orders/[id] — Admin tek sipariş detayı.
 *
 * GET: hem normal müşteri siparişlerini hem manuel siparişleri çeker.
 * Service role bypass — admin/staff role gerekli.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  // Auth check
  const auth = await assertPermission("orders", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması eksik" },
      { status: 500 }
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: order, error } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) {
    console.error("[admin/orders GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  return NextResponse.json({ order, items: items ?? [] });
}
