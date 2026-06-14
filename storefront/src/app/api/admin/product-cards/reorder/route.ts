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

  const { error } = await admin.rpc("fn_reorder_product_cards", {
    p_product_type: body.product_type as string,
    p_ids: order,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/etiket");
  revalidatePath("/sticker");

  return NextResponse.json({ ok: true, updated: order.length });
}
