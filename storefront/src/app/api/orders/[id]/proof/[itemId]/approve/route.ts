/**
 * POST /api/orders/[id]/proof/[itemId]/approve
 *
 * Sefa 19 May v68 (Migration 059):
 * Müşteri tek bir item/tasarım onayladığında çağrılır.
 *
 * Multi-design (Mig 063): cutlineId verilirse yalnızca o tasarımın bıçağı
 * onaylanır; item proof_status ancak tüm tasarımlar onaylandığında approved olur.
 *
 * Body (opsiyonel):
 *   { cutlineId?: string }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cutlineIsApproved,
  designHasCutline,
  getExpectedDesignCount,
} from "@/lib/order-item-meta";
import type { Enums, TablesInsert, TablesUpdate } from "@/lib/supabase/types";

interface Body {
  cutlineId?: unknown;
}

async function latestCutlineForDesign(
  admin: ReturnType<typeof createAdminClient>,
  itemId: string,
  designFileId: string
) {
  const { data } = await admin
    .from("cutline_designs")
    .select("id, status")
    .eq("order_item_id", itemId)
    .eq("design_file_id", designFileId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; status: string } | null;
}

async function allItemDesignsApproved(
  admin: ReturnType<typeof createAdminClient>,
  itemId: string,
  dfIds: string[]
): Promise<boolean> {
  for (const dfId of dfIds) {
    const cd = await latestCutlineForDesign(admin, itemId, dfId);
    if (!cutlineIsApproved(cd)) return false;
  }
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Body opsiyonel
  }
  const cutlineId =
    typeof body.cutlineId === "string" ? body.cutlineId : null;

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
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (orderRow.status !== "proof_pending") {
    return NextResponse.json(
      { error: `Sipariş bu aşamada değil (${orderRow.status})` },
      { status: 400 }
    );
  }

  const { data: orderItem } = await admin
    .from("order_items")
    .select("meta, proof_status")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const itemRow = orderItem as {
    meta?: Record<string, unknown>;
    proof_status?: string;
  } | null;
  const itemMeta = itemRow?.meta ?? {};

  const { data: designFiles } = await admin
    .from("design_files")
    .select("id")
    .eq("order_item_id", itemId)
    .neq("status", "superseded");

  const dfIds = (designFiles ?? []).map((d) => (d as { id: string }).id);
  const expected = getExpectedDesignCount(itemMeta, dfIds.length);
  const isMultiDesign = dfIds.length > 1;

  if (dfIds.length < expected) {
    return NextResponse.json(
      {
        error: `Tüm tasarımlar henüz hazır değil (${dfIds.length}/${expected})`,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  if (isMultiDesign) {
    if (!cutlineId) {
      return NextResponse.json(
        { error: "Multi-design onay için cutlineId gerekli" },
        { status: 400 }
      );
    }

    const { data: targetCd } = await admin
      .from("cutline_designs")
      .select("id, status, design_file_id")
      .eq("id", cutlineId)
      .eq("order_item_id", itemId)
      .neq("status", "superseded")
      .maybeSingle();

    const target = targetCd as {
      id: string;
      status: string;
      design_file_id: string | null;
    } | null;

    if (!target || !designHasCutline(target)) {
      return NextResponse.json(
        { error: "Onaylanacak bıçak bulunamadı" },
        { status: 400 }
      );
    }
    if (cutlineIsApproved(target)) {
      return NextResponse.json(
        { error: "Bu tasarım zaten onaylandı" },
        { status: 400 }
      );
    }
    if (!["draft", "auto_generated"].includes(target.status)) {
      return NextResponse.json(
        { error: "Bu bıçak şu an onaylanamaz" },
        { status: 400 }
      );
    }

    const { error: cdErr } = await admin
      .from("cutline_designs")
      .update({ status: "approved", approved_at: now })
      .eq("id", cutlineId)
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"]);

    if (cdErr) {
      console.error("[proof/approve] cutline update error:", cdErr);
      return NextResponse.json({ error: "Onay kaydedilemedi" }, { status: 500 });
    }

    const itemFullyApproved = await allItemDesignsApproved(
      admin,
      itemId,
      dfIds
    );

    if (itemFullyApproved) {
      const { error: itemErr } = await admin
        .from("order_items")
        .update({
          proof_status: "approved",
          proof_approved_at: now,
          cutline_design_id: cutlineId,
        } satisfies TablesUpdate<"order_items">)
        .eq("id", itemId)
        .eq("order_id", orderId);

      if (itemErr) {
        console.error("[proof/approve] item update error:", itemErr);
        return NextResponse.json(
          { error: "Onay kaydedilemedi" },
          { status: 500 }
        );
      }
    } else if (itemRow?.proof_status === "pending") {
      await admin
        .from("order_items")
        .update({ proof_status: "viewed", proof_viewed_at: now })
        .eq("id", itemId)
        .eq("order_id", orderId);
    }

    const { count: pendingCount } = await admin
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .not("proof_status", "in", "(approved)");

    await admin.from("order_events").insert([
      {
        order_id: orderId,
        event_type: "proof_item_approved",
        status_after: orderRow.status as Enums<"order_status">,
        actor_id: user.id,
        actor_role: "customer",
        summary: `Müşteri tasarım onayladı (${itemId.slice(0, 8)}…)`,
        detail: {
          item_id: itemId,
          cutline_id: cutlineId,
          partial: !itemFullyApproved,
        },
      } satisfies TablesInsert<"order_events">,
    ]);

    return NextResponse.json({
      ok: true,
      designApproved: true,
      itemFullyApproved,
      allApproved: (pendingCount ?? 0) === 0,
      remainingCount: pendingCount ?? 0,
    });
  }

  // Tek tasarım veya legacy (designs[] boş)
  if (dfIds.length > 0) {
    for (const dfId of dfIds) {
      const cd = await latestCutlineForDesign(admin, itemId, dfId);
      if (!designHasCutline(cd)) {
        return NextResponse.json(
          { error: "Bıçak çizgisi henüz hazır değil — lütfen bekleyin" },
          { status: 400 }
        );
      }
    }
  } else {
    const { data: legacyCd } = await admin
      .from("cutline_designs")
      .select("id")
      .eq("order_item_id", itemId)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!designHasCutline(legacyCd as { id?: string } | null)) {
      return NextResponse.json(
        { error: "Bıçak çizgisi henüz hazır değil — lütfen bekleyin" },
        { status: 400 }
      );
    }
  }

  const { error: itemErr } = await admin
    .from("order_items")
    .update({
      proof_status: "approved",
      proof_approved_at: now,
      ...(cutlineId ? { cutline_design_id: cutlineId } : {}),
    } satisfies TablesUpdate<"order_items">)
    .eq("id", itemId)
    .eq("order_id", orderId);

  if (itemErr) {
    console.error("[proof/approve] item update error:", itemErr);
    return NextResponse.json({ error: "Onay kaydedilemedi" }, { status: 500 });
  }

  if (cutlineId) {
    await admin
      .from("cutline_designs")
      .update({ status: "approved", approved_at: now })
      .eq("id", cutlineId)
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"]);
  } else {
    await admin
      .from("cutline_designs")
      .update({ status: "approved", approved_at: now })
      .eq("order_item_id", itemId)
      .in("status", ["draft", "auto_generated"]);
  }

  const { count: pendingCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .not("proof_status", "in", "(approved)");

  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "proof_item_approved",
      status_after: orderRow.status as Enums<"order_status">,
      actor_id: user.id,
      actor_role: "customer",
      summary: `Müşteri item ${itemId.slice(0, 8)}... onayladı`,
      detail: { item_id: itemId, cutline_id: cutlineId },
    } satisfies TablesInsert<"order_events">,
  ]);

  return NextResponse.json({
    ok: true,
    allApproved: (pendingCount ?? 0) === 0,
    remainingCount: pendingCount ?? 0,
  });
}
