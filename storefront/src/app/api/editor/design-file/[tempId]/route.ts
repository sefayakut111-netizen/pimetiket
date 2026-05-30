/**
 * GET /api/editor/design-file/[tempId]
 * Temp design proxy — POC iframe same-origin yükleme.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tempId: string }> }
) {
  const { tempId } = await params;
  if (!tempId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("design_temp_uploads")
    .select("user_id, storage_path, original_name, mime_type")
    .eq("id", tempId)
    .maybeSingle();

  const temp = row as {
    user_id: string;
    storage_path: string;
    original_name: string;
    mime_type: string;
  } | null;

  if (!temp || temp.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(temp.storage_path);

  if (error || !data) {
    return NextResponse.json(
      { error: "Dosya indirilemedi", detail: error?.message },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const safeName = temp.original_name.replace(/[^\w.\-()+ ]/g, "_");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": temp.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-cache, max-age=0",
    },
  });
}
