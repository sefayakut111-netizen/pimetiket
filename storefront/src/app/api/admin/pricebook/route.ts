/**
 * GET  /api/admin/pricebook — snapshot + markup
 * PUT  /api/admin/pricebook — hucreler, eksenler, markup kaydet
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  fetchPricebookSnapshot,
  invalidatePricebookCache,
} from "@/lib/pricing-pricebook-db";

export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const auth = await assertPermission("pricing", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const snapshot = await fetchPricebookSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}

interface PutBody {
  markup_pct?: number;
  axes?: { width?: number[]; height?: number[]; qty?: number[] };
  cells?: Array<{
    material_key: string;
    width_mm: number;
    height_mm: number;
    qty: number;
    price_per_unit: number;
  }>;
}

export async function PUT(req: Request) {
  const auth = await assertPermission("pricing", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = serviceClient();

  if (typeof body.markup_pct === "number" && Number.isFinite(body.markup_pct)) {
    const { error } = await admin
      .from("site_settings")
      .update({ pricing_markup_pct: body.markup_pct })
      .eq("id", 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.axes) {
    await admin
      .from("partner_pricebook_axes")
      .delete()
      .eq("product_type", "etiket_rulo");

    const rows: Array<{
      product_type: string;
      axis: string;
      value_mm: number;
      display_order: number;
    }> = [];

    (body.axes.width ?? []).forEach((v, i) => {
      rows.push({
        product_type: "etiket_rulo",
        axis: "width",
        value_mm: v,
        display_order: i,
      });
    });
    (body.axes.height ?? []).forEach((v, i) => {
      rows.push({
        product_type: "etiket_rulo",
        axis: "height",
        value_mm: v,
        display_order: i,
      });
    });
    (body.axes.qty ?? []).forEach((v, i) => {
      rows.push({
        product_type: "etiket_rulo",
        axis: "qty",
        value_mm: v,
        display_order: i,
      });
    });

    if (rows.length > 0) {
      const { error } = await admin.from("partner_pricebook_axes").insert(rows);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  if (body.cells && body.cells.length > 0) {
    const { data: matrices } = await admin
      .from("partner_pricebook_matrices")
      .select("id, material_key")
      .eq("product_type", "etiket_rulo");

    const byKey = new Map(
      (matrices ?? []).map((m) => [m.material_key, m.id as string])
    );

    const upserts: Array<{
      matrix_id: string;
      width_mm: number;
      height_mm: number;
      qty: number;
      price_per_unit: number;
    }> = [];

    for (const c of body.cells) {
      let matrixId = byKey.get(c.material_key);
      if (!matrixId) {
        const { data: inserted, error: insErr } = await admin
          .from("partner_pricebook_matrices")
          .insert({
            product_type: "etiket_rulo",
            material_key: c.material_key,
            display_name: c.material_key,
            active: true,
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          return NextResponse.json(
            { error: insErr?.message ?? "matrix_create_failed" },
            { status: 500 }
          );
        }
        matrixId = inserted.id as string;
        byKey.set(c.material_key, matrixId);
      }
      upserts.push({
        matrix_id: matrixId,
        width_mm: c.width_mm,
        height_mm: c.height_mm,
        qty: c.qty,
        price_per_unit: c.price_per_unit,
      });
    }

    const { error: cellErr } = await admin
      .from("partner_pricebook_cells")
      .upsert(upserts, {
        onConflict: "matrix_id,width_mm,height_mm,qty",
      });
    if (cellErr) {
      return NextResponse.json({ error: cellErr.message }, { status: 500 });
    }

    for (const id of new Set(upserts.map((u) => u.matrix_id))) {
      await admin
        .from("partner_pricebook_matrices")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  }

  invalidatePricebookCache();
  const snapshot = await fetchPricebookSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}
