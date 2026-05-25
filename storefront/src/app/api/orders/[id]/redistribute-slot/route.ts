/**
 * POST /api/orders/[id]/redistribute-slot
 *
 * Sefa 22 May v68 (Faz 2 stretch — kısmi iade yerine alternatif):
 * Multi-design siparişte müşteri bir slot'u (item'ı) çözememişse — kısmi
 * iade YERİNE — o slot'un adetini başka çalışan bir slot'a transfer eder.
 *
 *   Örnek: Müşteri 100 sticker = 50 design A + 50 design B sipariş etti.
 *   Design B uygun dosya yükleyemiyor. Yerine "design A'dan 100 adet
 *   yapın, B'den vazgeçtim" diyor. Total qty (100) ve total tutar değişmez.
 *
 * Kural setı (Anayasa uyumlu):
 *   - Sipariş status: awaiting_upload veya proof_pending (NOT post-production)
 *   - Source/target aynı order, aynı user
 *   - Source/target aynı product/width/height/config (fiyatlandırma tutarsız
 *     olmasın — unit fiyat farkı varsa total bozulur)
 *   - qtyToMove: opsiyonel; verilmezse sourceItem.qty (slot'u tamamen kapat)
 *   - Source qty=0 olduysa silinmez; meta.redistributed_to ile işaretlenir
 *     (audit + admin görünürlüğü için)
 *
 * Body:
 *   { sourceItemId: uuid, targetItemId: uuid, qtyToMove?: number }
 *
 * Auth: order sahibi.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, Json } from "@/lib/supabase/types";

export const runtime = "nodejs";

const BodySchema = z.object({
  sourceItemId: z.string().uuid(),
  targetItemId: z.string().uuid(),
  qtyToMove: z.number().int().positive().optional(),
});

const REDISTRIBUTE_ALLOWED_STATUSES = new Set([
  "awaiting_upload",
  "proof_pending",
  "proof_generating",
  "paid",
]);

interface ItemRow {
  id: string;
  order_id: string;
  product: string;
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  meta: Record<string, unknown> | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  // Auth
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const { sourceItemId, targetItemId, qtyToMove: requestedQty } = parsed.data;

  if (sourceItemId === targetItemId) {
    return NextResponse.json(
      { error: "source_target_same" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Order + status check
  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const order = orderRow as { user_id: string; status: string } | null;
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!REDISTRIBUTE_ALLOWED_STATUSES.has(order.status)) {
    return NextResponse.json(
      {
        error: "status_not_allowed",
        status: order.status,
        hint: "Redistribute sadece tasarım yükleme/prova aşamasında yapılabilir. Üretime alındıktan sonra mümkün değil.",
      },
      { status: 422 }
    );
  }

  // Her iki item da fetch
  const { data: itemsRaw } = await admin
    .from("order_items")
    .select("id, order_id, product, title, config, width, height, qty, unit, total, meta")
    .in("id", [sourceItemId, targetItemId])
    .eq("order_id", orderId);
  const items = ((itemsRaw as ItemRow[] | null) ?? []);
  const source = items.find((i) => i.id === sourceItemId);
  const target = items.find((i) => i.id === targetItemId);
  if (!source || !target) {
    return NextResponse.json(
      { error: "items_not_found", hint: "Kaynak veya hedef item bu siparişe ait değil" },
      { status: 404 }
    );
  }

  // Fiyat tutarlılığı: aynı product + boyut + config + unit fiyat
  // Aksi halde total recalc bozulur (anayasa: müşteri ekstra para ödemez).
  if (
    source.product !== target.product ||
    source.width !== target.width ||
    source.height !== target.height ||
    source.config !== target.config ||
    Number(source.unit) !== Number(target.unit)
  ) {
    return NextResponse.json(
      {
        error: "items_incompatible",
        hint: "Sadece aynı ürün/boyut/yapılandırma arasında adet transfer edilebilir.",
        detail: {
          sourceProduct: source.product,
          targetProduct: target.product,
          dimensionMatch:
            source.width === target.width && source.height === target.height,
          configMatch: source.config === target.config,
          unitMatch: Number(source.unit) === Number(target.unit),
        },
      },
      { status: 422 }
    );
  }

  // Move miktar — default: source.qty (tamamını taşı = slot'u kapat)
  const qtyToMove = requestedQty ?? source.qty;
  if (qtyToMove > source.qty) {
    return NextResponse.json(
      {
        error: "qty_exceeds_source",
        sourceQty: source.qty,
        requestedQty: qtyToMove,
      },
      { status: 400 }
    );
  }

  // Slot'u TAMAMEN sıfırla → meta'da işaretle (silinmez, audit kalsın)
  const newSourceQty = source.qty - qtyToMove;
  const newTargetQty = target.qty + qtyToMove;
  const unitPrice = Number(source.unit);
  const newSourceTotal = newSourceQty * unitPrice;
  const newTargetTotal = newTargetQty * unitPrice;
  const isSourceClosed = newSourceQty === 0;

  // Source update
  const sourceMeta = { ...(source.meta ?? {}) };
  if (isSourceClosed) {
    sourceMeta.redistributed_to = targetItemId;
    sourceMeta.redistributed_at = new Date().toISOString();
    sourceMeta.redistributed_qty = qtyToMove;
  }
  const { error: srcErr } = await admin
    .from("order_items")
    .update({
      qty: newSourceQty,
      total: newSourceTotal,
      meta: sourceMeta as Json,
    })
    .eq("id", sourceItemId)
    .eq("order_id", orderId)
    .eq("qty", source.qty); // optimistic lock — başka concurrent değişiklik olduysa fail
  if (srcErr) {
    console.error("[redistribute] source update error:", srcErr);
    return NextResponse.json(
      { error: "source_update_failed", detail: srcErr.message },
      { status: 500 }
    );
  }

  // Target update
  const targetMeta = { ...(target.meta ?? {}) };
  const fromList = Array.isArray(targetMeta.redistributed_from)
    ? (targetMeta.redistributed_from as unknown[])
    : [];
  targetMeta.redistributed_from = [
    ...fromList,
    {
      from_item_id: sourceItemId,
      qty: qtyToMove,
      at: new Date().toISOString(),
    },
  ];
  const { error: tgtErr } = await admin
    .from("order_items")
    .update({
      qty: newTargetQty,
      total: newTargetTotal,
      meta: targetMeta as Json,
    })
    .eq("id", targetItemId)
    .eq("order_id", orderId)
    .eq("qty", target.qty);
  if (tgtErr) {
    // Source güncellendi ama target başarısız → manuel rollback
    console.error("[redistribute] target update error:", tgtErr);
    await admin
      .from("order_items")
      .update({
        qty: source.qty,
        total: source.total,
        meta: (source.meta ?? {}) as Json,
      })
      .eq("id", sourceItemId);
    return NextResponse.json(
      {
        error: "target_update_failed",
        detail: tgtErr.message,
        rollback: "source restored",
      },
      { status: 500 }
    );
  }

  // Audit log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "slot_redistributed",
      status_after: order.status as Enums<"order_status">,
      actor_id: user.id,
      actor_role: "customer",
      summary: `${qtyToMove} adet "${source.title}" → "${target.title}" transferi yapıldı (kısmi iade alternatifi).`,
      detail: {
        sourceItemId,
        targetItemId,
        qtyMoved: qtyToMove,
        unitPrice,
        sourceClosed: isSourceClosed,
        oldSourceQty: source.qty,
        newSourceQty,
        oldTargetQty: target.qty,
        newTargetQty,
      },
    },
  ]);

  return NextResponse.json({
    ok: true,
    sourceClosed: isSourceClosed,
    sourceQty: newSourceQty,
    targetQty: newTargetQty,
    qtyMoved: qtyToMove,
  });
}
