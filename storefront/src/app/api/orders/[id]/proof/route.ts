/**
 * GET /api/orders/[id]/proof
 *
 * Sefa 19 May v68 (Migration 059):
 * Baskı onay sayfası (/onay/[orderId]) için tek-shot data fetch.
 * fn_proof_summary RPC ile sipariş + tüm itemler + her item'ın son
 * cutline draft'ı + açık help_request bir kerede gelir.
 *
 * Auth: sipariş sahibi (RPC kendi içinde auth.uid() kontrol eder)
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  if (!rawOrderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Case-insensitive lookup: orderId URL'den mixed case gelebilir
  // (örn. PE-2026-eAMNAqXJ vs PE-2026-EAMNAQXJ). DB'deki canonical hali bul.
  const admin = createAdminClient();
  const { data: matchOrder } = await admin
    .from("orders")
    .select("id, user_id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const orderRow = matchOrder as { id: string; user_id: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const orderId = orderRow.id; // canonical

  const { data, error } = await supabase.rpc(
    "fn_proof_summary" as never,
    { p_order_id: orderId } as never
  );

  if (error) {
    console.error("[GET /orders/proof] RPC error:", error);
    return NextResponse.json(
      { error: "Sipariş özeti alınamadı", detail: error.message },
      { status: 500 }
    );
  }

  if (
    data &&
    typeof data === "object" &&
    "error" in (data as Record<string, unknown>)
  ) {
    const errVal = (data as { error: string }).error;
    const statusCode = errVal === "order_not_found" ? 404 : 403;
    return NextResponse.json({ error: errVal }, { status: statusCode });
  }

  return NextResponse.json(data);
}
