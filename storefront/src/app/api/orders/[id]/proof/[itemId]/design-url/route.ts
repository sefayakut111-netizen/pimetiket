/**
 * GET /api/orders/[id]/proof/[itemId]/design-url
 * Orijinal tasarım dosyası signed URL (katman toggle).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  const url = new URL(req.url);
  const dfParam = url.searchParams.get("design_file_id");

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

  const dfQuery = admin
    .from("design_files")
    .select("storage_path")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded");
  const { data: df } = dfParam
    ? await dfQuery.eq("id", dfParam).maybeSingle()
    : await dfQuery.order("version", { ascending: false }).limit(1).maybeSingle();

  const designFile = df as { storage_path: string } | null;
  if (!designFile) {
    return NextResponse.json({ url: null });
  }

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(designFile.storage_path, 3600);

  return NextResponse.json({ url: signed?.signedUrl ?? null });
}
