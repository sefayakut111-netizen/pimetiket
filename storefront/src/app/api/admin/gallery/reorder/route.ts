/**
 * POST /api/admin/gallery/reorder
 *
 * Body: { order: [id, id, id, ...] }
 * Drag-and-drop sonrası yeni sıralama, sort_order alanlarını günceller.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await assertPermission("gallery", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { order?: unknown };
  try {
    body = (await req.json()) as { order?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const order = Array.isArray(body.order)
    ? body.order.filter((x): x is string => typeof x === "string")
    : [];

  if (order.length === 0) {
    return NextResponse.json({ error: "order array zorunlu" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.rpc("fn_reorder_gallery", { p_ids: order });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: order.length });
}
