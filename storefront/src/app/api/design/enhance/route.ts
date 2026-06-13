/**
 * POST /api/design/enhance — AI görsel upscale (Real-ESRGAN, Replicate)
 * Orijinal korunur; iyileştirilmiş kopya ayrı path'te staging'e yazılır.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMAGE_UPSCALE_COST_USD,
  isUpscalableMime,
  upscaleImageFromUrl,
} from "@/lib/design/image-upscale";
import {
  isGlobalAiBudgetExceeded,
  logAiUsage,
} from "@/lib/pim/ai-usage-log";
import { rateLimit } from "@/lib/rate-limit";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import type { TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z
  .object({
    tempDesignId: z.string().uuid().optional(),
    designFileId: z.string().uuid().optional(),
    orderId: z.string().min(1).optional(),
  })
  .refine(
    (d) => d.tempDesignId || (d.designFileId && d.orderId),
    { message: "tempDesignId veya designFileId+orderId gerekli" }
  );

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `image-enhance:${user.id}`,
    limit: 10,
    windowMs: 86_400_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } }
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (await isGlobalAiBudgetExceeded()) {
    return NextResponse.json(
      { ok: false, error: "budget_exceeded" },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  let storagePath = "";
  let originalName = "";
  let mimeType = "";
  let originalPreviewUrl: string | null = null;
  let sourceDesignFileId: string | null = null;
  let sourceOrderId: string | null = null;

  if (body.tempDesignId) {
    const { data: temp } = await admin
      .from("design_temp_uploads")
      .select("id, storage_path, original_name, mime_type, user_id")
      .eq("id", body.tempDesignId)
      .maybeSingle();
    const row = temp as {
      id: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      user_id: string;
    } | null;
    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    storagePath = row.storage_path;
    originalName = row.original_name;
    mimeType = row.mime_type;
  } else if (body.designFileId && body.orderId) {
    const { data: order } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", body.orderId)
      .maybeSingle();
    const orderRow = order as { user_id: string } | null;
    if (!orderRow || orderRow.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: df } = await admin
      .from("design_files")
      .select("id, storage_path, original_name, mime_type, order_id")
      .eq("id", body.designFileId)
      .eq("order_id", body.orderId)
      .neq("status", "superseded")
      .maybeSingle();
    const designFile = df as {
      id: string;
      storage_path: string;
      original_name: string;
      mime_type: string;
      order_id: string;
    } | null;
    if (!designFile) {
      return NextResponse.json({ error: "design_not_found" }, { status: 404 });
    }
    storagePath = designFile.storage_path;
    originalName = designFile.original_name;
    mimeType = designFile.mime_type;
    sourceDesignFileId = designFile.id;
    sourceOrderId = designFile.order_id;
  }

  if (!isUpscalableMime(mimeType)) {
    return NextResponse.json(
      { ok: false, error: "not_raster" },
      { status: 400 }
    );
  }

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 600);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }
  originalPreviewUrl = signed.signedUrl;

  const startedAt = Date.now();
  const upscaled = await upscaleImageFromUrl(signed.signedUrl);
  if (!upscaled.success || !upscaled.outputBuffer) {
    return NextResponse.json(
      { ok: false, error: upscaled.error ?? "upscale_failed" },
      { status: 500 }
    );
  }

  const enhancedId = crypto.randomUUID();
  const enhancedPath = sourceOrderId
    ? `enhanced/${sourceOrderId}/${enhancedId}.png`
    : `enhanced/${user.id}/${enhancedId}.png`;

  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(enhancedPath, upscaled.outputBuffer, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const baseName = originalName.replace(/\.[^.]+$/, "");
  const insertRow: TablesInsert<"design_temp_uploads"> = {
    id: enhancedId,
    user_id: user.id,
    storage_path: enhancedPath,
    original_name: `${baseName}-enhanced.png`,
    mime_type: "image/png",
    size_bytes: upscaled.outputBuffer.length,
  };
  await admin.from("design_temp_uploads").insert(insertRow);

  const { data: enhancedSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(enhancedPath, 3600);

  await logAiUsage({
    source: "image_upscale",
    model: "replicate/real-esrgan",
    inputTokens: 1,
    outputTokens: 0,
    costUsd: IMAGE_UPSCALE_COST_USD,
    userId: user.id,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    ok: true,
    originalPreviewUrl,
    enhancedPreviewUrl: enhancedSigned?.signedUrl ?? null,
    enhancedTempDesignId: enhancedId,
    sourceDesignFileId,
    sourceTempDesignId: body.tempDesignId ?? null,
    originalWidth: upscaled.originalWidth,
    originalHeight: upscaled.originalHeight,
    enhancedWidth: upscaled.enhancedWidth,
    enhancedHeight: upscaled.enhancedHeight,
    scale: upscaled.scale,
  });
}
