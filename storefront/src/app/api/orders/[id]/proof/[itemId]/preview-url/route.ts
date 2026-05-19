/**
 * GET /api/orders/[id]/proof/[itemId]/preview-url
 *
 * /onay sayfasında müşteriye cutline preview göstermek için kullanılan
 * signed URL endpoint'i. cutline_designs.preview_png_url'i alır ve 1 saatlik
 * imzalı R2 link döndürür.
 *
 * Auth: müşteri kendi siparişinin item'ı için çağırabilir (RLS bypass yok,
 * order.user_id eşitliği zorunlu).
 *
 * Response:
 *   { url: string | null, expiresAt: string | null }
 *
 * preview_png_url null ise (POC'un canvas snapshot'unu göndermediği
 * eski draft'lar) url da null döner — UI placeholder gösterir.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";

const TTL_SECONDS = 3600; // 1 saat

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }
  // Mig 063 — multi-design: spesifik tasarımın preview'i
  const url = new URL(req.url);
  const dfParam = url.searchParams.get("design_file_id");
  const designFileId =
    dfParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dfParam)
      ? dfParam
      : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Auth: bu sipariş bu müşteriye mi ait
  const { data: order } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // En güncel cutline_design preview key'ini bul.
  // Mig 063: design_file_id varsa spesifik tasarım, yoksa item bazlı (legacy).
  const baseQuery = admin
    .from("cutline_designs")
    .select("preview_png_url, status, created_at")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);
  const { data: cd } = designFileId
    ? await baseQuery.eq("design_file_id", designFileId).maybeSingle()
    : await baseQuery.maybeSingle();

  const cdRow = cd as { preview_png_url: string | null } | null;
  if (!cdRow || !cdRow.preview_png_url) {
    return NextResponse.json({ url: null, expiresAt: null });
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedDownloadUrl(cdRow.preview_png_url, TTL_SECONDS);
  } catch (err) {
    console.error("[proof/preview-url] signed URL failed:", err);
    return NextResponse.json(
      { error: "Önizleme bağlantısı üretilemedi" },
      { status: 500 }
    );
  }
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  return NextResponse.json({ url: signedUrl, expiresAt });
}
