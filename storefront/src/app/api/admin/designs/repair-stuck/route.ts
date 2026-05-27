/**
 * POST /api/admin/designs/repair-stuck
 *
 * 1+ saat "analyzing" durumunda kalan design_files kayıtlarını
 * uploaded'a çeker ve ilgili siparişler için QC'yi yeniden tetikler.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";

export const runtime = "nodejs";

export async function GET() {
  const auth = await assertPermission("designs", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("design_files")
    .select("*", { count: "exact", head: true })
    .eq("status", "analyzing")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, stuckCount: count ?? 0 });
}

export async function POST() {
  const auth = await assertPermission("designs", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: stuck, error } = await admin
    .from("design_files")
    .select("id, order_id")
    .eq("status", "analyzing")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[admin/designs/repair-stuck]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const files = stuck ?? [];
  const orderIds = new Set<string>();

  for (const file of files) {
    const { error: updErr } = await admin
      .from("design_files")
      .update({ status: "uploaded" })
      .eq("id", file.id);
    if (updErr) {
      console.error("[admin/designs/repair-stuck] update:", file.id, updErr);
      continue;
    }
    orderIds.add(file.order_id as string);
  }

  for (const orderId of orderIds) {
    scheduleOrderDesignQC(admin, orderId);
  }

  return NextResponse.json({
    ok: true,
    repaired: files.length,
    ordersTriggered: orderIds.size,
  });
}
