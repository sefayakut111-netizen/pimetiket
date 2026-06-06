/**
 * POST /api/orders/[id]/proof/[itemId]/enhance-dismiss
 * Müşteri orijinali kullanmayı seçti — değişiklik yok.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
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
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string } | null;
  if (!orderRow || orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: item } = await admin
    .from("order_items")
    .select("meta")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const meta =
    ((item as { meta?: Record<string, unknown> } | null)?.meta as Record<
      string,
      unknown
    >) ?? {};

  await admin
    .from("order_items")
    .update({
      meta: {
        ...meta,
        enhance_dismissed: true,
      } as Json,
    })
    .eq("id", itemId);

  return NextResponse.json({ ok: true });
}
