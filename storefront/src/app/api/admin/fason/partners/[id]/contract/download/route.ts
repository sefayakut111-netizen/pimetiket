/**
 * GET /api/admin/fason/partners/[id]/contract/download
 *
 * contract_pdf_url (R2 key veya http URL) icin signed/indirect indirme URL.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";

export const runtime = "nodejs";

const TTL_SECONDS = 3600;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data: partner, error } = await admin
    .from("fason_partners")
    .select("contract_pdf_url, contract_uploaded_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!partner) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const contractPdfUrl = (partner as { contract_pdf_url: string | null })
    .contract_pdf_url;
  if (!contractPdfUrl || contractPdfUrl.trim().length === 0) {
    return NextResponse.json({ error: "contract_not_found" }, { status: 404 });
  }

  const trimmed = contractPdfUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return NextResponse.json({
      url: trimmed,
      expiresAt: null,
      source: "external_url",
    });
  }

  try {
    const signedUrl = await getSignedDownloadUrl(trimmed, TTL_SECONDS);
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    return NextResponse.json({
      url: signedUrl,
      expiresAt,
      source: "r2_signed",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "signed_url_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
