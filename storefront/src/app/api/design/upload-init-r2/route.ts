/**
 * POST /api/design/upload-init-r2
 *
 * 30 MB üzeri dosyalar için R2 presigned PUT upload.
 * Supabase Storage limitini aşan PSD/PDF vb. için kullanılır.
 *
 * Body: upload-init ile aynı; sizeBytes > MAX_FILE_SIZE && <= MAX_R2_FILE_SIZE
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_R2_FILE_SIZE,
  getExtensionFromMime,
} from "@/lib/storage/design-files";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";
import { r2PendingDesignKey } from "@/lib/storage/buckets";
import { getSignedUploadUrl } from "@/lib/storage/r2-client";
import type { Json, TablesInsert } from "@/lib/supabase/types";

const InitBodySchema = z.object({
  orderId: z.string().min(1),
  originalName: z.string().min(1).max(255),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .min(MAX_FILE_SIZE + 1)
    .max(MAX_R2_FILE_SIZE),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  orderItemId: z.string().uuid().optional(),
  kind: z.enum(["design", "white"]).optional(),
});

const ACCEPTED_ORDER_STATUSES = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "operator_review",
] as const;

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof InitBodySchema>;
  try {
    body = InitBodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_body",
        detail: err instanceof Error ? err.message : "validation_failed",
      },
      { status: 400 }
    );
  }

  const category = categorizeFile(body.originalName, body.mimeType);
  if (category === "blocked") {
    return NextResponse.json({ error: BLOCKED_FILE_MESSAGE }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, status")
    .eq("id", body.orderId)
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  const orderRow = order as { id: string; user_id: string; status: string };
  if (orderRow.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (
    !ACCEPTED_ORDER_STATUSES.includes(
      orderRow.status as (typeof ACCEPTED_ORDER_STATUSES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "order_status_not_uploadable", current: orderRow.status },
      { status: 400 }
    );
  }

  let version = 1;
  if (body.orderItemId) {
    const { data: existing } = await admin
      .from("design_files")
      .select("version")
      .eq("order_id", body.orderId)
      .eq("order_item_id", body.orderItemId)
      .order("version", { ascending: false })
      .limit(1);
    const top = (
      (existing as unknown as Array<{ version: number }>) ?? []
    )[0];
    version = (top?.version ?? 0) + 1;
  }

  const fileId = crypto.randomUUID();
  const ext = getExtensionFromMime(body.mimeType);
  const kind = body.kind ?? "design";
  const r2Key = r2PendingDesignKey(user.id, fileId, ext);

  const uploadUrl = await getSignedUploadUrl(r2Key, body.mimeType, 3600);

  const { error: insertErr } = await admin.from("design_files").insert([
    {
      id: fileId,
      order_id: body.orderId,
      user_id: user.id,
      order_item_id: body.orderItemId ?? null,
      storage_path: r2Key,
      original_name: body.originalName,
      size_bytes: body.sizeBytes,
      mime_type: body.mimeType,
      version,
      status: "uploaded",
      ai_check:
        kind === "white" ? ({ kind: "white", flags: [] } as Json) : null,
    } satisfies TablesInsert<"design_files">,
  ]);

  if (insertErr) {
    console.error("[design/upload-init-r2] insert:", insertErr);
    return NextResponse.json(
      { error: "db_insert_failed", detail: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    uploadUrl,
    storagePath: r2Key,
    fileId,
    version,
    backend: "r2",
  });
}
