/**
 * GET /api/orders/[id]/proof/[itemId]/enhance-hint
 * AI QC düşük DPI → görsel iyileştirme önerisi (otomatik değil).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const runtime = "nodejs";

const LOW_DPI_THRESHOLD = 150;

type QcFinding = {
  severity?: string;
  category?: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
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
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string; status: string } | null;
  if (!orderRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: item } = await admin
    .from("order_items")
    .select("meta")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const itemMeta =
    ((item as { meta?: Record<string, unknown> } | null)?.meta as Record<
      string,
      unknown
    >) ?? {};

  if (itemMeta.enhance_dismissed === true) {
    return NextResponse.json({
      showPrompt: false,
      dismissed: true,
      effectiveDpi: null,
      designFileId: null,
    });
  }

  const { data: df } = await admin
    .from("design_files")
    .select("id, mime_type")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const designFile = df as { id: string; mime_type: string } | null;
  if (!designFile) {
    return NextResponse.json({
      showPrompt: false,
      effectiveDpi: null,
      designFileId: null,
    });
  }

  const mime = designFile.mime_type.toLowerCase();
  if (!mime.includes("png") && !mime.includes("jpeg") && !mime.includes("jpg")) {
    return NextResponse.json({
      showPrompt: false,
      effectiveDpi: null,
      designFileId: designFile.id,
    });
  }

  const { data: qc } = await admin
    .from("design_quality_checks")
    .select("verdict, analysis, findings")
    .eq("design_file_id", designFile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const qcRow = qc as {
    verdict: string;
    analysis: { effectiveDpi?: number | null } | null;
    findings: QcFinding[] | null;
  } | null;

  let effectiveDpi: number | null =
    qcRow?.analysis?.effectiveDpi != null
      ? Number(qcRow.analysis.effectiveDpi)
      : null;

  const hasResolutionWarning = (qcRow?.findings ?? []).some(
    (f) =>
      f.category === "resolution" &&
      (f.severity === "warning" || f.severity === "error")
  );

  const lowDpi =
    effectiveDpi != null && effectiveDpi < LOW_DPI_THRESHOLD;
  const suggestFromQc =
    lowDpi ||
    hasResolutionWarning ||
    qcRow?.verdict === "kotu";

  const showPrompt =
    suggestFromQc &&
    orderRow.status === "proof_pending" &&
    itemMeta.enhance_dismissed !== true;

  let previewUrl: string | null = null;
  if (showPrompt) {
    const { data: dfFull } = await admin
      .from("design_files")
      .select("storage_path")
      .eq("id", designFile.id)
      .maybeSingle();
    const path = (dfFull as { storage_path: string } | null)?.storage_path;
    if (path) {
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(path, 600);
      previewUrl = signed?.signedUrl ?? null;
    }
  }

  return NextResponse.json({
    showPrompt,
    dismissed: false,
    effectiveDpi,
    designFileId: designFile.id,
    previewUrl,
  });
}
