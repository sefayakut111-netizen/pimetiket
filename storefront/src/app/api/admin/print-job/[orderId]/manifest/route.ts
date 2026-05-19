/**
 * GET /api/admin/print-job/[orderId]/manifest
 *
 * Sefa 19 May v68 (E öbeği — fason manifest):
 * Baskı operatörü ya da fason atölye için iş paketi manifesti. Müşteri
 * onaylı (proof_approved) ya da operatör hazır (ready_to_ship / fason_assigned
 * / in_production) durumdaki siparişler için cutline'ları + meta'yı + müşteri
 * detayını JSON olarak döner. SVG'ler imzalı R2 URL ile erişilir (1 saat TTL).
 *
 * Auth: assertAdmin (super_admin / operations / production rolleri)
 *
 * Response:
 *   {
 *     order: { id, status, total, created_at, customer: { name, address } },
 *     items: [
 *       {
 *         id, title, qty, width, height, material_hint,
 *         designs: [
 *           {
 *             design_file_id, file_name, mime_type, version,
 *             cutline: {
 *               id, source, mode, offset_mm, smoothness, dpi,
 *               material_type, white_plan_mode, white_plan_path_count,
 *               has_custom_white_plan, tier, detected_cut_contour_names,
 *               svg_url, preview_png_url   // signed, 1h TTL
 *             }
 *           }
 *         ]
 *       }
 *     ],
 *     generated_at: ISO,
 *     expires_at: ISO
 *   }
 *
 * Audit: order_events satırı yazılır (event_type='print_manifest_downloaded').
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";

const TTL_SECONDS = 3600; // 1 saat — operatörün indirme süresi

// Manifest oluşturulacak orders.status değerleri
const ALLOWED_STATUSES = new Set([
  "proof_approved",
  "ready_to_ship",
  "fason_assigned",
  "in_production",
]);

interface CutlineRow {
  id: string;
  order_item_id: string;
  design_file_id: string | null;
  svg_url: string | null;
  preview_png_url: string | null;
  source: string;
  mode: string;
  offset_mm: number | null;
  smoothness: number | null;
  dpi: number | null;
  material_type: string | null;
  white_plan_mode: string | null;
  white_plan_path_count: number | null;
  has_custom_white_plan: boolean | null;
  tier: string | null;
  detected_cut_contour_names: string[] | null;
  pim_feedback: string | null;
  status: string;
}

interface DesignFileRow {
  id: string;
  order_item_id: string | null;
  original_name: string;
  mime_type: string;
  version: number;
  status: string;
}

interface ItemRow {
  id: string;
  product: string;
  title: string;
  config: string | null;
  qty: number;
  width: number;
  height: number;
  meta: Record<string, unknown> | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Order
  const { data: order } = await admin
    .from("orders")
    .select("id, status, total, subtotal, shipping, address, user_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as
    | {
        id: string;
        status: string;
        total: number;
        subtotal: number;
        shipping: number;
        address: { name?: string; full?: string } | null;
        user_id: string;
        created_at: string;
      }
    | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (!ALLOWED_STATUSES.has(orderRow.status)) {
    return NextResponse.json(
      {
        error: "Bu sipariş henüz baskıya hazır değil",
        status: orderRow.status,
      },
      { status: 400 }
    );
  }

  // Items
  const { data: items } = await admin
    .from("order_items")
    .select("id, product, title, config, qty, width, height, meta")
    .eq("order_id", orderId);
  const itemRows = (items as ItemRow[] | null) ?? [];

  // Design files
  const { data: dfs } = await admin
    .from("design_files")
    .select("id, order_item_id, original_name, mime_type, version, status")
    .eq("order_id", orderId)
    .neq("status", "superseded");
  const designFiles = (dfs as DesignFileRow[] | null) ?? [];

  // Cutlines — approved öncelikli, yoksa en güncel non-superseded
  const { data: cls } = await admin
    .from("cutline_designs")
    .select(
      "id, order_item_id, design_file_id, svg_url, preview_png_url, source, mode, offset_mm, smoothness, dpi, material_type, white_plan_mode, white_plan_path_count, has_custom_white_plan, tier, detected_cut_contour_names, pim_feedback, status, created_at"
    )
    .eq("order_id", orderId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false });
  const cutlineRows = (cls as (CutlineRow & { created_at: string })[] | null) ?? [];

  // Her design için en uygun cutline (önce approved, sonra en güncel)
  function pickCutline(dfId: string | null, itemId: string): CutlineRow | null {
    const candidates = cutlineRows.filter((c) =>
      dfId
        ? c.design_file_id === dfId
        : c.order_item_id === itemId && c.design_file_id === null
    );
    const approved = candidates.find((c) => c.status === "approved");
    return approved ?? candidates[0] ?? null;
  }

  // Signed URL'leri paralel hazırla
  async function signUrl(key: string | null): Promise<string | null> {
    if (!key) return null;
    try {
      return await getSignedDownloadUrl(key, TTL_SECONDS);
    } catch (err) {
      console.error("[manifest] sign failed:", key, err);
      return null;
    }
  }

  const itemsManifest = await Promise.all(
    itemRows.map(async (it) => {
      const itemDfs = designFiles.filter((df) => df.order_item_id === it.id);
      const designs = await Promise.all(
        itemDfs.length > 0
          ? itemDfs.map(async (df) => {
              const cl = pickCutline(df.id, it.id);
              return {
                design_file_id: df.id,
                file_name: df.original_name,
                mime_type: df.mime_type,
                version: df.version,
                design_status: df.status,
                cutline: cl
                  ? {
                      id: cl.id,
                      status: cl.status,
                      source: cl.source,
                      mode: cl.mode,
                      offset_mm: cl.offset_mm,
                      smoothness: cl.smoothness,
                      dpi: cl.dpi,
                      material_type: cl.material_type,
                      white_plan_mode: cl.white_plan_mode,
                      white_plan_path_count: cl.white_plan_path_count,
                      has_custom_white_plan: cl.has_custom_white_plan,
                      tier: cl.tier,
                      detected_cut_contour_names: cl.detected_cut_contour_names,
                      pim_feedback: cl.pim_feedback,
                      svg_url: await signUrl(cl.svg_url),
                      preview_png_url: await signUrl(cl.preview_png_url),
                    }
                  : null,
              };
            })
          : // Eski siparişler: design_files yok ama cutline item-bağlı olabilir
            [
              await (async () => {
                const cl = pickCutline(null, it.id);
                return {
                  design_file_id: null,
                  file_name: "(eski sipariş — design_files yok)",
                  mime_type: "",
                  version: 0,
                  design_status: "legacy",
                  cutline: cl
                    ? {
                        id: cl.id,
                        status: cl.status,
                        source: cl.source,
                        mode: cl.mode,
                        offset_mm: cl.offset_mm,
                        smoothness: cl.smoothness,
                        dpi: cl.dpi,
                        material_type: cl.material_type,
                        white_plan_mode: cl.white_plan_mode,
                        white_plan_path_count: cl.white_plan_path_count,
                        has_custom_white_plan: cl.has_custom_white_plan,
                        tier: cl.tier,
                        detected_cut_contour_names:
                          cl.detected_cut_contour_names,
                        pim_feedback: cl.pim_feedback,
                        svg_url: await signUrl(cl.svg_url),
                        preview_png_url: await signUrl(cl.preview_png_url),
                      }
                    : null,
                };
              })(),
            ]
      );
      return {
        id: it.id,
        product: it.product,
        title: it.title,
        config: it.config,
        qty: it.qty,
        width_mm: it.width,
        height_mm: it.height,
        material_hint: (it.meta?.material_type as string | undefined) ?? null,
        designs,
      };
    })
  );

  // Audit log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "print_manifest_downloaded",
      status_after: orderRow.status,
      actor_id: auth.user.id,
      actor_role: auth.role,
      summary: `Baskı manifesti indirildi (${itemsManifest.length} ürün)`,
      detail: {
        item_count: itemsManifest.length,
        admin_email: auth.user.email,
      },
    },
  ] as never);

  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  return NextResponse.json({
    order: {
      id: orderRow.id,
      status: orderRow.status,
      total: orderRow.total,
      subtotal: orderRow.subtotal,
      shipping: orderRow.shipping,
      address: orderRow.address,
      created_at: orderRow.created_at,
    },
    items: itemsManifest,
    generated_at: generatedAt,
    expires_at: expiresAt,
    expires_in_seconds: TTL_SECONDS,
    note:
      "SVG'leri 1 saat içinde indir — sonra signed URL geçerliliği biter, yeniden manifest iste.",
  });
}
