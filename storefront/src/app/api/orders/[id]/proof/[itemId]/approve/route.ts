/**
 * POST /api/orders/[id]/proof/[itemId]/approve
 *
 * Sefa 19 May v68 (Migration 059):
 * Müşteri tek bir item'ı onayladığında çağrılır.
 *
 * Akış:
 *   1. proof_status: viewed/pending/edited → approved
 *   2. order_items.proof_approved_at = NOW()
 *   3. Bu item için en son cutline_designs.status='draft' kaydı varsa → 'approved'
 *   4. order_events log
 *   5. Response: { ok: true, allApproved: boolean } — frontend tümü
 *      approved olduğunda /finalize çağırabilir.
 *
 * Body (opsiyonel):
 *   { cutlineId?: string }  — eğer müşteri düzenleyip onayladıysa
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Body {
  cutlineId?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Body opsiyonel; parse hatasını umursama
  }
  const cutlineId =
    typeof body.cutlineId === "string" ? body.cutlineId : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Auth + status check
  const { data: order } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (orderRow.status !== "proof_pending") {
    return NextResponse.json(
      { error: `Sipariş bu aşamada değil (${orderRow.status})` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  // Item'ı approved yap
  const { error: itemErr } = await admin
    .from("order_items")
    .update({
      proof_status: "approved",
      proof_approved_at: now,
      ...(cutlineId ? { cutline_design_id: cutlineId } : {}),
    } as never)
    .eq("id", itemId)
    .eq("order_id", orderId);

  if (itemErr) {
    console.error("[proof/approve] item update error:", itemErr);
    return NextResponse.json({ error: "Onay kaydedilemedi" }, { status: 500 });
  }

  // İlişkili draft + auto_generated cutline'ları approve durumuna çek.
  // Mig 062: hidden iframe auto cutline → status='auto_generated'
  // Mig 063: multi-design — bu item'a ait HER design_file için en güncel
  //          cutline (auto_generated veya draft) approved'a çekilir.
  if (cutlineId) {
    await admin
      .from("cutline_designs")
      .update({ status: "approved", approved_at: now } as never)
      .eq("id", cutlineId)
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"]);
  } else {
    // CutlineId verilmediyse: item'a ait tüm non-superseded, non-approved
    // cutline'ları approve et (multi-design: her tasarım için ayrı row).
    await admin
      .from("cutline_designs")
      .update({ status: "approved", approved_at: now } as never)
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"]);
  }

  // Tüm itemler approved mı? (frontend kullanır)
  const { count: pendingCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .not("proof_status", "in", "(approved)");

  // order_events log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "proof_item_approved",
      status_after: orderRow.status,
      actor_id: user.id,
      actor_role: "customer",
      summary: `Müşteri item ${itemId.slice(0, 8)}... onayladı`,
      detail: { item_id: itemId, cutline_id: cutlineId },
    },
  ] as never);

  return NextResponse.json({
    ok: true,
    allApproved: (pendingCount ?? 0) === 0,
    remainingCount: pendingCount ?? 0,
  });
}
