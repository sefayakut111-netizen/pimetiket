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
import {
  filterActionableStuckDesigns,
  STUCK_DESIGN_CUTOFF_MS,
  type StuckDesignRow,
} from "@/lib/admin-stuck-designs";

export const runtime = "nodejs";

async function fetchStuckDesignRows(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - STUCK_DESIGN_CUTOFF_MS).toISOString();

  const { data, error } = await admin
    .from("design_files")
    .select("id, order_id, orders!inner(id, status, address)")
    .eq("status", "analyzing")
    .lt("created_at", cutoff);

  if (error) {
    throw error;
  }

  return filterActionableStuckDesigns((data ?? []) as StuckDesignRow[]);
}

export async function GET() {
  const auth = await assertPermission("designs", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const stuck = await fetchStuckDesignRows(admin);
    return NextResponse.json({ ok: true, stuckCount: stuck.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  const auth = await assertPermission("designs", "update");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  let files: StuckDesignRow[];
  try {
    files = await fetchStuckDesignRows(admin);
  } catch (error) {
    console.error("[admin/designs/repair-stuck]", error);
    const message = error instanceof Error ? error.message : "Query failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

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
    orderIds.add(file.order_id);
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
