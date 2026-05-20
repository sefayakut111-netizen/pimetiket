/**
 * GET /api/product-cards (public, anon)
 *
 * Sefa 21 May v68 Mig 074: /etiket ve /sticker müşteri grid sayfaları
 * bu endpoint'ten kart listesini çeker. RLS otomatik filtreler
 * (is_active=true). Cache: 60 saniye — admin değişikliği sonrası
 * revalidatePath ile invalidate edilir (PATCH/reorder handler'larında).
 *
 * Query:
 *   ?product_type=etiket | sticker  (opsiyonel — yoksa hepsi)
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const url = new URL(req.url);
  const productType = url.searchParams.get("product_type");

  let query = supabase
    .from("product_cards")
    .select(
      "id, product_type, key, title_tr, title_en, desc_tr, desc_en, sort_order, query_params, image_src, svg_id"
    )
    .eq("is_active", true)
    .order("product_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (productType === "etiket" || productType === "sticker") {
    query = query.eq("product_type", productType);
  }

  const { data, error } = await query;
  if (error) {
    // Sessizce fail — caller fallback array kullanır
    return NextResponse.json({ cards: [], error: error.message }, { status: 200 });
  }
  return NextResponse.json({ cards: data ?? [] });
}
