/**
 * GET /api/orders/[id]/proof/[itemId]/production-export?type=cutline|design|composite|pdf
 *
 * Partner + admin/staff üretim indirmesi. Müşteri (sipariş sahibi dahil) → 403.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { downloadFromR2 } from "@/lib/storage/r2-client";
import {
  assertProductionExportAccess,
  parseDesignFileIdParam,
} from "@/lib/proof/order-proof-access";
import {
  parseDesignFileIdQuery,
  resolveOrderDesignFile,
} from "@/lib/proof/resolve-order-design-file";

export const runtime = "nodejs";

import {
  getOrBuildProductionPrintPdf,
  getProductionPrintPdfSignedUrl,
} from "@/lib/print/production-pdf";

const ALLOWED_TYPES = new Set(["cutline", "design", "composite", "pdf"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: "type=cutline|design|composite|pdf gerekli" },
      { status: 400 }
    );
  }

  const designFileId = parseDesignFileIdParam(
    parseDesignFileIdQuery(url.searchParams.get("design_file_id"))
  );

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const access = await assertProductionExportAccess(admin, orderId, user?.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Giriş gerekli" : "Yetkisiz" },
      { status: access.status }
    );
  }

  if (type === "pdf") {
    const built = await getOrBuildProductionPrintPdf({
      admin,
      orderId,
      itemId,
      userId: user?.id ?? "",
      designFileId,
    });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status });
    }

    const wantsUrl = url.searchParams.get("format") === "url";
    if (wantsUrl) {
      const signedUrl = await getProductionPrintPdfSignedUrl(
        built.cacheKey,
        orderId,
        itemId
      );
      return NextResponse.json({
        ok: true,
        url: signedUrl,
        cached: built.cached,
        cacheKey: built.cacheKey,
      });
    }

    return new NextResponse(Buffer.from(built.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pim-print-ready-${orderId.slice(-6)}-${itemId.slice(-6)}.pdf"`,
        // PDF her istekte sunucuya gitsin — max-age tarayıcıda X-Pim-Print-Cached'i donduruyordu
        "Cache-Control": "private, no-cache, must-revalidate",
        "X-Pim-Print-Cached": built.cached ? "1" : "0",
        "X-Pim-Print-Cache-Key": built.cacheKey,
      },
    });
  }

  if (type === "design") {
    const resolved = await resolveOrderDesignFile(
      admin,
      orderId,
      itemId,
      user?.id,
      designFileId
    );
    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status }
      );
    }
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(resolved.file.storage_path);
    if (error || !data) {
      return NextResponse.json(
        { error: "Tasarım dosyası indirilemedi" },
        { status: 500 }
      );
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const safeName = resolved.file.original_name.replace(/[^\w.\-()+ ]/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": resolved.file.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-cache, max-age=0",
      },
    });
  }

  const cutlineQuery = admin
    .from("cutline_designs")
    .select("svg_url, preview_png_url, status")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: cdRow } = designFileId
    ? await cutlineQuery.eq("design_file_id", designFileId).maybeSingle()
    : await cutlineQuery.maybeSingle();

  const cd = cdRow as {
    svg_url: string | null;
    preview_png_url: string | null;
  } | null;

  if (!cd) {
    return NextResponse.json({ error: "Bıçak kaydı bulunamadı" }, { status: 404 });
  }

  const key = type === "cutline" ? cd.svg_url : cd.preview_png_url;
  if (!key) {
    return NextResponse.json(
      { error: type === "cutline" ? "SVG yok" : "Composite önizleme yok" },
      { status: 404 }
    );
  }

  try {
    const buffer = await downloadFromR2(key);
    const ext = type === "cutline" ? "svg" : "png";
    const mime = type === "cutline" ? "image/svg+xml" : "image/png";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="pim-${type}-${orderId}-${itemId}.${ext}"`,
        "Cache-Control": "private, no-cache, max-age=0",
      },
    });
  } catch (err) {
    console.error("[production-export] R2 download failed:", err);
    return NextResponse.json({ error: "Dosya indirilemedi" }, { status: 500 });
  }
}
