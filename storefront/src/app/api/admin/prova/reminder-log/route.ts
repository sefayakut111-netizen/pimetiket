/**
 * GET /api/admin/prova/reminder-log?orders=id1,id2
 *
 * proof_reminder_sent event ozeti — prova kartlarinda hatirlatma gecmisi.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await assertPermission("proof", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const orderIds = (url.searchParams.get("orders") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (orderIds.length === 0) {
    return NextResponse.json({ ok: true, reminders: {} });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_events")
    .select("order_id, created_at")
    .in("order_id", orderIds)
    .eq("event_type", "proof_reminder_sent")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "reminder_log_failed", detail: error.message },
      { status: 500 }
    );
  }

  const reminders: Record<string, { lastAt: string; count: number }> = {};
  for (const row of data ?? []) {
    const oid = row.order_id as string;
    const createdAt = row.created_at as string;
    if (!reminders[oid]) {
      reminders[oid] = { lastAt: createdAt, count: 1 };
    } else {
      reminders[oid].count++;
    }
  }

  return NextResponse.json({ ok: true, reminders });
}
