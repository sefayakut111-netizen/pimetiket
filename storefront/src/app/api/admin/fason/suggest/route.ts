/**
 * GET /api/admin/fason/suggest
 *   ?specialty=etiket            (legacy — backwards compat)
 *   ?productType=roll_label&material=paper&amount=1500   (yeni, Mig 067)
 *
 * Sefa 20 May v68 (Mig 067):
 * Eski fn_suggest_fason_partner sadece free-text specialty match yapıyordu.
 * Yeni fn_find_best_partner (Mig 067) capability tablo bazlı:
 *   - product_type match
 *   - material match (opsiyonel)
 *   - min_order_amount kontrolü
 *   - cached_score desc + lead_days asc
 *
 * Eski endpoint URL'i korunur, yeni param shape mevcuttur.
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";

type ProductType = "roll_label" | "sheet_label" | "sticker";
type MaterialType = "paper" | "transparent" | "metallic" | "holographic";

/** Eski 'etiket' / 'sticker' specialty → yeni product_type mapping */
function legacySpecialtyToProductType(s: string | null): ProductType | null {
  if (!s) return null;
  const l = s.toLowerCase().trim();
  if (l === "sticker") return "sticker";
  if (l === "etiket" || l === "label") return "roll_label"; // varsayılan rulo
  return null;
}

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const productTypeParam = url.searchParams.get("productType");
  const materialParam = url.searchParams.get("material");
  const amountParam = url.searchParams.get("amount");
  const specialtyParam = url.searchParams.get("specialty");

  // Yeni shape varsa öncelikli, yoksa legacy fallback
  const productType: ProductType | null =
    (productTypeParam as ProductType | null) ??
    legacySpecialtyToProductType(specialtyParam);

  if (!productType) {
    // Hiç filtre yok → tüm aktif partnerleri döndür (legacy behavior)
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("fason_partners")
      .select(
        "id, name, default_lead_days, cached_score, status, specialties"
      )
      .eq("status", "active")
      .order("cached_score", { ascending: false, nullsFirst: false })
      .order("default_lead_days", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    type Row = {
      id: string;
      name: string;
      default_lead_days: number;
      cached_score: number | null;
      status: string;
      specialties: string[] | null;
    };
    const rows = (data ?? []) as Row[];
    return NextResponse.json({
      suggestions: rows.map((r) => ({
        fason_id: r.id,
        fason_name: r.name,
        cached_score: r.cached_score,
        active_count: 0, // (legacy yapı için placeholder)
        reason: "Tüm aktif partnerler",
      })),
    });
  }

  const material = (materialParam as MaterialType | null) ?? null;
  const amount = amountParam ? Number(amountParam) : 0;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "fn_find_best_partner" as never,
    {
      p_product_type: productType,
      p_material: material,
      p_order_amount: Number.isFinite(amount) ? amount : 0,
    } as never
  );

  if (error) {
    return NextResponse.json(
      { error: "rpc_failed", detail: error.message },
      { status: 500 }
    );
  }

  type RpcRow = {
    partner_id: string;
    partner_name: string;
    default_lead_days: number;
    cached_score: number | null;
  };
  const rows = (data as RpcRow[] | null) ?? [];

  return NextResponse.json({
    suggestions: rows.map((r) => ({
      fason_id: r.partner_id,
      fason_name: r.partner_name,
      cached_score: r.cached_score,
      active_count: 0,
      reason: `${productType}${material ? ` + ${material}` : ""} kapasiteli`,
    })),
    productType,
    material,
    amount,
  });
}
