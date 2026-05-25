/**
 * GET /api/orders/[id]/proof/[itemId]/background
 * Arka plan tespit durumu (order_items.meta.bg_detect).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { detectBackground } from "@/lib/proof/background-detect";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import type { BgDetectResult } from "@/lib/proof/background-detect";

export const runtime = "nodejs";

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

  const dismissed = itemMeta.bg_removal_dismissed === true;
  let bgDetect = itemMeta.bg_detect as BgDetectResult | undefined;

  if (!bgDetect && !dismissed) {
    const { data: df } = await admin
      .from("design_files")
      .select("storage_path, original_name")
      .eq("order_id", orderId)
      .eq("order_item_id", itemId)
      .neq("status", "superseded")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const designFile = df as {
      storage_path: string;
      original_name: string;
    } | null;
    if (designFile) {
      const { data: signed } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(designFile.storage_path, 300);
      if (signed?.signedUrl) {
        const materialKey = String(
          itemMeta.material_type ?? itemMeta.material ?? "paper"
        );
        bgDetect = await detectBackground(
          signed.signedUrl,
          designFile.original_name,
          materialKey
        );
        if (bgDetect.needsRemoval) {
          await admin
            .from("order_items")
            .update({
              meta: {
                ...itemMeta,
                bg_detect: bgDetect as unknown as Json,
                bg_removal_dismissed: false,
              },
            })
            .eq("id", itemId);
        }
      }
    }
  }

  const showPrompt =
    !dismissed && !!bgDetect?.needsRemoval && orderRow.status === "proof_pending";

  return NextResponse.json({
    showPrompt,
    dismissed,
    bgDetect: bgDetect ?? null,
  });
}
