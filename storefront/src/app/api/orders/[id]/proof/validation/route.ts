/**
 * GET /api/orders/[id]/proof/validation
 * Sipariş için en son proof_validations kaydını döner (müşteri kendi siparişi).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id")
    .ilike("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: row } = await admin
    .from("proof_validations")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ validation: null });
  }

  const v = row as {
    ai_pim_message: string | null;
    ai_verdict: string | null;
    final_verdict: string | null;
    ai_cutline: { issues_tr?: string[] } | null;
    ai_white_layer: { issues_tr?: string[] } | null;
    rule_issues: Array<{ message_tr?: string; severity?: string }> | null;
  };

  return NextResponse.json({
    validation: {
      pimMessage: v.ai_pim_message,
      aiVerdict: v.ai_verdict,
      finalVerdict: v.final_verdict,
      cutlineIssues: v.ai_cutline?.issues_tr ?? [],
      whiteLayerIssues: v.ai_white_layer?.issues_tr ?? [],
      ruleIssues: (v.rule_issues ?? [])
        .filter((i) => i.severity === "warning" || i.severity === "error")
        .map((i) => i.message_tr)
        .filter(Boolean),
    },
  });
}
