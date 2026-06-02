/**
 * POST /api/cart/reprice
 *
 * Fiyat yayını sonrası bayat sepet satırlarını checkout recalc motoru ile
 * yeniden fiyatlar. Oturum varsa cart_items DB güncellenir.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { repriceCartItems } from "@/lib/cart-reprice";
import type { CustomerCartItem } from "@/lib/customer-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { items?: CustomerCartItem[]; forceAll?: boolean };
  try {
    body = (await req.json()) as { items?: CustomerCartItem[]; forceAll?: boolean };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }

  const { items: repriced, changed, removed, refreshedIds } =
    await repriceCartItems(items, { forceAll: body.forceAll === true });

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const refreshedSet = new Set(refreshedIds);
      for (const item of repriced) {
        if (!refreshedSet.has(item.id)) continue;
        await supabase
          .from("cart_items")
          .update({
            unit: item.unit,
            total: item.total,
            priced_at: new Date(item.pricedAt ?? Date.now()).toISOString(),
          })
          .eq("id", item.id)
          .eq("user_id", user.id);
      }

      for (const r of removed) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("id", r.id)
          .eq("user_id", user.id);
      }
    }
  } catch (e) {
    console.error("[cart/reprice] persist error:", e);
  }

  return NextResponse.json({ items: repriced, changed, removed });
}
