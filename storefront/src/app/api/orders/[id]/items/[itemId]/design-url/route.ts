/**
 * GET /api/orders/[id]/items/[itemId]/design-url
 *
 * Sefa 19 May v68 (Mig 062 — B1 auto cutline orchestration):
 * Müşteri /onay sayfasına geldiğinde cutline'sız itemlar için POC hidden
 * iframe ile arka planda bıçak üretilir. Bu endpoint POC'a geçirilen
 * `designUrl` query parametresi için kısa ömürlü (5 dk) signed URL döner.
 *
 * Auth: müşteri sadece kendi siparişinin item'ı için çağırabilir.
 *
 * Response:
 *   {
 *     url: string,        // Supabase Storage signed URL
 *     mimeType: string,
 *     fileName: string,
 *     expiresAt: string
 *   }
 *   veya 404 — design yok
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const runtime = "nodejs";

const TTL_SECONDS = 300; // 5 dakika — POC fetch için yeterli

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }
  // Mig 063 — multi-design: spesifik design_file için URL iste
  const url = new URL(req.url);
  const designFileIdParam = url.searchParams.get("design_file_id");
  const designFileId =
    designFileIdParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      designFileIdParam
    )
      ? designFileIdParam
      : null;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Auth: order + item bu müşteriye ait mi.
  // Sefa 23 May v68: orderId URL'den mixed-case gelebilir (PE-2026-eAMNAqXJ vs
  // pe-2026-eamnaqxj). DB'deki canonical ID'yi ilike ile bul ve aşağıdaki tüm
  // sorgularda kullanacağımız `canonicalOrderId`'yi sabitle. .eq order_id ile
  // case-sensitive sorgu, mixed-case URL'de design_file bulunmamasına yol açıyordu.
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id")
    .ilike("id", orderId)
    .maybeSingle();
  const orderRow = order as { id: string; user_id: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  const canonicalOrderId = orderRow.id;
  if (orderRow.user_id !== user.id) {
    // Sefa 23 May v68: admin/staff bypass — /admin/prova sayfasinda
    // operatör müşterinin tasarımını inceleyebilmeli.
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // design_file: spesifik ID istendiyse onu; yoksa en güncel
  const baseQuery = admin
    .from("design_files")
    .select("storage_path, mime_type, original_name, status")
    .eq("order_id", canonicalOrderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded");
  const { data: df } = designFileId
    ? await baseQuery.eq("id", designFileId).maybeSingle()
    : await baseQuery.order("version", { ascending: false }).limit(1).maybeSingle();
  const dfRow = df as
    | { storage_path: string; mime_type: string; original_name: string; status: string }
    | null;
  if (!dfRow) {
    return NextResponse.json(
      { error: "Tasarım bulunamadı" },
      { status: 404 }
    );
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(dfRow.storage_path, TTL_SECONDS);
  if (signErr || !signed) {
    return NextResponse.json(
      { error: "Signed URL üretilemedi", detail: signErr?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: signed.signedUrl,
    mimeType: dfRow.mime_type,
    fileName: dfRow.original_name,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  });
}
