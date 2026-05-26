/**
 * GET /api/orders/[id]/proof/[itemId]/cmyk-preview
 * CMYK baskı simülasyonu PNG (cache'li).
 * ?design_file_id= — multi-design siparişlerde belirli tasarım
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCmykSimulation } from "@/lib/proof/cmyk-simulate";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  const { searchParams } = new URL(req.url);
  const designFileIdParam = searchParams.get("design_file_id");

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
  if ((order as { user_id: string } | null)?.user_id !== user.id) {
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

  let designQuery = admin
    .from("design_files")
    .select("id, storage_path")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded");

  if (designFileIdParam) {
    designQuery = designQuery.eq("id", designFileIdParam);
  } else {
    designQuery = designQuery
      .order("version", { ascending: false })
      .limit(1);
  }

  const { data: df } = await designQuery.maybeSingle();
  const designFile = df as { id: string; storage_path: string } | null;
  if (!designFile) {
    return NextResponse.json({ error: "design_not_found" }, { status: 404 });
  }

  const cachedPaths =
    (meta.cmyk_preview_paths as Record<string, string> | undefined) ?? {};
  const legacyCachedPath =
    (meta.cmyk_preview_path as string | undefined) ?? null;
  const cachedPath =
    cachedPaths[designFile.id] ??
    (!designFileIdParam ? legacyCachedPath : null);

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(designFile.storage_path, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  try {
    const result = await generateCmykSimulation(
      signed.signedUrl,
      orderId,
      itemId,
      cachedPath
    );

    if (!cachedPath) {
      const nextPaths = { ...cachedPaths, [designFile.id]: result.storagePath };
      await admin
        .from("order_items")
        .update({
          meta: {
            ...meta,
            cmyk_preview_paths: nextPaths,
            // Tek tasarımlı siparişler için geriye dönük uyumluluk
            cmyk_preview_path: result.storagePath,
          },
        })
        .eq("id", itemId);
    }

    return NextResponse.json({
      simulatedPngUrl: result.simulatedPngUrl,
      colorShift: result.colorShift,
      affectedAreas: result.affectedAreas,
    });
  } catch (err) {
    console.error("[cmyk-preview]", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
