/**
 * POST /api/admin/product-cards/reorder
 *
 * Body: { product_type: "etiket" | "sticker", order: [id, id, id, ...] }
 *
 * sort_order = array index. Etiket ve sticker bağımsız sıralanır.
 * (Sefa 21 May v68 Mig 074)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Sefa 21 May v68: inline auth → assertAdmin helper (tutarlılık)
  const auth = await assertPermission("products", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { product_type?: unknown; order?: unknown };
  try {
    body = (await req.json()) as { product_type?: unknown; order?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.product_type !== "etiket" && body.product_type !== "sticker") {
    return NextResponse.json(
      { error: "product_type 'etiket' veya 'sticker' olmalı" },
      { status: 400 }
    );
  }

  const order = Array.isArray(body.order)
    ? body.order.filter((x): x is string => typeof x === "string")
    : [];

  if (order.length === 0) {
    return NextResponse.json(
      { error: "order array zorunlu" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1-indexed sort_order (mevcut seed 1..11 olarak)
  const updates = await Promise.all(
    order.map((id, idx) =>
      admin
        .from("product_cards")
        .update({ sort_order: idx + 1 })
        .eq("id", id)
        .eq("product_type", body.product_type as string)
    )
  );

  const errors = updates.filter((u) => u.error);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Bazı kartlar güncellenemedi", count: errors.length },
      { status: 500 }
    );
  }

  // Customer sayfa cache invalidate
  revalidatePath("/etiket");
  revalidatePath("/sticker");

  return NextResponse.json({ ok: true, updated: order.length });
}
