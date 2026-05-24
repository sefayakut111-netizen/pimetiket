/**
 * POST /api/admin/gallery/reorder
 *
 * Body: { order: [id, id, id, ...] }
 * Drag-and-drop sonrası yeni sıralama, sort_order alanlarını günceller.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

  // Her id için sort_order = index
  const updates = await Promise.all(
    order.map((id, idx) =>
      admin.from("gallery_items").update({ sort_order: idx }).eq("id", id)
    )
  );

  const errors = updates.filter((u) => u.error);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Bazı öğeler güncellenemedi", count: errors.length },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updated: order.length });
}
