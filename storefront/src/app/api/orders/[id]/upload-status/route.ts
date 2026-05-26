/**
 * GET /api/orders/[id]/upload-status
 *
 * /siparis/[id]/tasarim-yukle sayfası için minimal order özeti.
 * Her order_item için "design_files'ta kullanılabilir kayıt var mı?"
 * sorusunu yanıtlar (Mig 061 fn_order_has_design ile aynı statü kümesi).
 *
 * Auth: müşteri kendi siparişini sorgulayabilir.
 *
 * Response:
 *   {
 *     id: string,
 *     status: OrderStatus,
 *     items: Array<{ id, title, qty, width, height, hasDesign }>
 *   }
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";
import { USABLE_DESIGN_STATUSES } from "@/lib/design-file-status";
import { orderItemHasDesigns } from "@/lib/order-item-meta";
import { promoteOrderDesigns } from "@/lib/storage/promote-temp-designs";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

function qcMessageFromCheck(
  aiCheck: {
    flags?: Array<{ kind?: string; message?: string }>;
  } | null
): string | undefined {
  const err =
    aiCheck?.flags?.find((x) => x.kind === "error") ??
    aiCheck?.flags?.find((x) => x.kind === "warning");
  return err?.message?.trim();
}

async function signedPreviewUrl(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
  mimeType: string
): Promise<string | undefined> {
  const isRaster =
    mimeType.startsWith("image/") && !mimeType.includes("svg");
  const transformOpts = isRaster
    ? { transform: { width: 400, height: 400, resize: "contain" as const } }
    : undefined;
  const { data } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 300, transformOpts);
  return data?.signedUrl;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
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

  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as
    | { id: string; user_id: string; status: string }
    | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Eksik temp upload'ları promote et (multi-design siparişlerde 2+ tasarım)
  try {
    const { data: promoteItems } = await admin
      .from("order_items")
      .select("id, product, meta")
      .eq("order_id", orderId);
    const itemsToPromote = (
      (promoteItems as unknown as Array<{
        id: string;
        product: "sticker" | "etiket";
        meta: Record<string, unknown>;
      }>) ?? []
    ).filter((i) => orderItemHasDesigns(i.meta));
    if (itemsToPromote.length > 0) {
      const promoted = await promoteOrderDesigns({
        admin,
        orderId,
        userId: user.id,
        orderItems: itemsToPromote,
      });
      if (promoted > 0) {
        scheduleOrderDesignQC(admin, orderId);
      }
    }
  } catch (promoteErr) {
    console.error("[GET /upload-status] promote failed:", promoteErr);
  }

  // Item'lari cek — meta'dan designCount al (multi-design destek)
  const { data: items } = await admin
    .from("order_items")
    .select("id, title, qty, width, height, product, config, unit, meta")
    .eq("order_id", orderId);
  const itemRows =
    (items as Array<{
      id: string;
      title: string;
      qty: number;
      width: number;
      height: number;
      product: string;
      config: string;
      unit: number;
      meta: { designCount?: number } | null;
    }> | null) ?? [];

  // Her item icin design_files SAYISI (multi-design icin)
  // Sefa 22 May v68 — onceki kod sadece "var mi" bool donduruyordu;
  // simdi N tasarim slot'u icin "kac yuklendi / kac gerekli" rapor.
  const { data: dfs } = await admin
    .from("design_files")
    .select("order_item_id")
    .eq("order_id", orderId)
    .in(
      "status",
      [...USABLE_DESIGN_STATUSES] as Enums<"design_file_status">[]
    );
  const designCountByItem = new Map<string, number>();
  for (const d of ((dfs as Array<{ order_item_id: string | null }> | null) ??
    [])) {
    if (typeof d.order_item_id === "string") {
      designCountByItem.set(
        d.order_item_id,
        (designCountByItem.get(d.order_item_id) ?? 0) + 1
      );
    }
  }

  type DesignFileRow = {
    id: string;
    order_item_id: string | null;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    status: string;
    storage_path: string;
    uploaded_at: string;
    ai_check: {
      flags?: Array<{ kind?: string; message?: string }>;
    } | null;
  };

  const { data: activeFiles } = await admin
    .from("design_files")
    .select(
      "id, order_item_id, original_name, mime_type, size_bytes, status, storage_path, uploaded_at, ai_check"
    )
    .eq("order_id", orderId)
    .neq("status", "superseded")
    .order("uploaded_at", { ascending: true });

  const designFilesByItem = new Map<
    string,
    Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      status: string;
      previewUrl?: string;
      uploadedAt: string;
      qcMessage?: string;
    }>
  >();

  for (const df of ((activeFiles as DesignFileRow[] | null) ?? [])) {
    if (typeof df.order_item_id !== "string") continue;
    const previewUrl = await signedPreviewUrl(
      admin,
      df.storage_path,
      df.mime_type
    );
    const entry = {
      id: df.id,
      fileName: df.original_name,
      mimeType: df.mime_type,
      sizeBytes: df.size_bytes,
      status: df.status,
      previewUrl,
      uploadedAt: df.uploaded_at,
      qcMessage:
        df.status === "qc_failed"
          ? qcMessageFromCheck(df.ai_check) ??
            "Kalite kontrolden geçemedi"
          : qcMessageFromCheck(df.ai_check),
    };
    const arr = designFilesByItem.get(df.order_item_id) ?? [];
    arr.push(entry);
    designFilesByItem.set(df.order_item_id, arr);
  }

  // Sefa 22 May v68 — Faz 2: qc_failed tasarımları ayrıca getir.
  // Müşteri "neden yüklemem sayılmadı?" sorusunu yanıtlayabilsin.
  // ai_check.flags içinden ilk error mesajını çıkarıyoruz.
  const { data: failedDfs } = await admin
    .from("design_files")
    .select("id, order_item_id, original_name, ai_check, uploaded_at")
    .eq("order_id", orderId)
    .eq("status", "qc_failed")
    .order("uploaded_at", { ascending: false });
  type FailedRow = {
    id: string;
    order_item_id: string | null;
    original_name: string;
    ai_check: {
      flags?: Array<{ kind?: string; message?: string }>;
      kind?: string;
    } | null;
    uploaded_at: string;
  };
  const failedByItem = new Map<
    string,
    Array<{ id: string; name: string; reason: string; uploadedAt: string }>
  >();
  for (const f of ((failedDfs as FailedRow[] | null) ?? [])) {
    if (typeof f.order_item_id !== "string") continue;
    const errFlag =
      f.ai_check?.flags?.find((x) => x.kind === "error") ??
      f.ai_check?.flags?.find((x) => x.kind === "warning");
    const reason =
      errFlag?.message?.trim() ||
      "AI ön-kontrolü dosyada sorun buldu (DPI/CMYK/bleed). Düzeltilmiş dosyayı tekrar yükle.";
    const arr = failedByItem.get(f.order_item_id) ?? [];
    arr.push({
      id: f.id,
      name: f.original_name,
      reason,
      uploadedAt: f.uploaded_at,
    });
    failedByItem.set(f.order_item_id, arr);
  }

  return NextResponse.json({
    id: orderRow.id,
    status: orderRow.status,
    items: itemRows.map((it) => {
      const designsRequired = Math.max(1, it.meta?.designCount ?? 1);
      const designsUploaded = designCountByItem.get(it.id) ?? 0;
      return {
        id: it.id,
        title: it.title,
        qty: it.qty,
        width: it.width,
        height: it.height,
        // Sefa 22 May v68 Faz 2 stretch — redistribute compatibility için
        product: it.product,
        config: it.config,
        unit: Number(it.unit),
        // Eski API uyumu — boolean: en az 1 tasarim varsa true
        hasDesign: designsUploaded > 0,
        // Multi-design destek (Sefa 22 May v68)
        designsRequired,
        designsUploaded,
        designsComplete: designsUploaded >= designsRequired,
        // Sefa 22 May v68 — Faz 2: AI kontrolde takılan dosyalar
        failedDesigns: failedByItem.get(it.id) ?? [],
        designFiles: designFilesByItem.get(it.id) ?? [],
      };
    }),
  });
}
