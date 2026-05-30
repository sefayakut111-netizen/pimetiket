/**
 * GET /api/editor/background?tempDesignId=...
 * Pre-order arka plan tespiti.
 */
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectBackground } from "@/lib/proof/background-detect";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tempDesignId = url.searchParams.get("tempDesignId");
  if (!tempDesignId) {
    return NextResponse.json({ error: "tempDesignId required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: temp } = await admin
    .from("design_temp_uploads")
    .select("storage_path, mime_type, user_id, original_name")
    .eq("id", tempDesignId)
    .maybeSingle();

  const row = temp as {
    storage_path: string;
    mime_type: string;
    user_id: string;
    original_name: string;
  } | null;
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, 300);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  const result = await detectBackground(
    signed.signedUrl,
    row.original_name,
    "paper"
  );
  return NextResponse.json({ ok: true, detect: result });
}
