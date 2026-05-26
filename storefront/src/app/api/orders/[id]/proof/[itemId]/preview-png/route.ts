/**
 * GET /api/orders/[id]/proof/[itemId]/preview-png
 * Cutline preview PNG — same-origin proxy (R2 → tarayıcı).
 * Admin müşteri görünümü + img tag uyumluluğu için signed R2 URL yerine.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadFromR2 } from "@/lib/storage/r2-client";
import {
  assertProofOrderAccess,
  getCutlinePreviewKey,
  parseDesignFileIdParam,
} from "@/lib/proof/order-proof-access";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const designFileId = parseDesignFileIdParam(
    searchParams.get("design_file_id")
  );

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const access = await assertProofOrderAccess(admin, orderId, user?.id);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: access.status }
    );
  }

  const previewKey = await getCutlinePreviewKey(
    admin,
    orderId,
    itemId,
    designFileId
  );
  if (!previewKey) {
    return NextResponse.json({ error: "preview_not_found" }, { status: 404 });
  }

  try {
    const buffer = await downloadFromR2(previewKey);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("[proof/preview-png]", err);
    return NextResponse.json(
      { error: "Önizleme yüklenemedi" },
      { status: 500 }
    );
  }
}
