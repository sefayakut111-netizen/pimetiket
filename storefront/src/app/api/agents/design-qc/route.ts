/**
 * POST /api/agents/design-qc
 *
 * Design Quality Check Agent — manual trigger endpoint.
 *
 * Body:
 *   {
 *     fileId: string;        // design_files.id (Supabase Storage'da dosya)
 *     orderId?: string;       // varsa siparişe bağla
 *     printWidthMm: number;   // baskı boyutu — effective DPI hesabı için
 *     printHeightMm: number;
 *     productType: "etiket" | "sticker";
 *   }
 *
 * Response:
 *   { ok: true, runId: string, verdict, score, analysis, findings }
 *
 * Auth: admin/staff cookie session (assertAdmin).
 * MVP olarak manual çağrı için — sonraki commit'te webhook tetikleme.
 *
 * Sefa kararı (16 May): Müşteri ödeme yaptıktan sonra agent çalışır,
 * conversion friction yok. Bu endpoint operatör manuel re-run veya
 * test için.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { runDesignQC, mimeToFormat, type DesignQCResult } from "@/lib/agents/design-qc";
import { runOrderDesignQC } from "@/lib/agents/run-order-qc";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

const FileBodySchema = z.object({
  fileId: z.string().uuid(),
  orderId: z.string().optional(),
  printWidthMm: z.number().int().min(5).max(1500),
  printHeightMm: z.number().int().min(5).max(1500),
  productType: z.enum(["etiket", "sticker"]),
});

const OrderRerunSchema = z.object({
  orderId: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  // Auth — admin/staff
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Body validate
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderRerun = OrderRerunSchema.safeParse(raw);
  if (orderRerun.success && !("fileId" in (raw as object))) {
    const admin = createAdminClient();
    const result = await runOrderDesignQC(admin, orderRerun.data.orderId);
    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      ranCount: result.ranCount,
      aggregateVerdict: result.aggregateVerdict,
      verdictCounts: result.verdictCounts,
      forced: orderRerun.data.force ?? false,
    });
  }

  let body: z.infer<typeof FileBodySchema>;
  try {
    body = FileBodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Invalid body",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1) design_files'tan dosya bilgisini çek
  const { data: file, error: fileErr } = await admin
    .from("design_files")
    .select("id, storage_path, mime_type, original_name, order_id")
    .eq("id", body.fileId)
    .maybeSingle();

  if (fileErr || !file) {
    return NextResponse.json(
      { error: "Design file not found", fileId: body.fileId },
      { status: 404 }
    );
  }

  const dbFile = file as {
    id: string;
    storage_path: string;
    mime_type: string;
    original_name: string;
    order_id: string;
  };

  // 2) Signed URL (1 saatlik) — AI Vision için
  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(dbFile.storage_path, 3600);

  if (!signed?.signedUrl) {
    return NextResponse.json(
      { error: "Signed URL generation failed" },
      { status: 500 }
    );
  }

  const fileFormat = mimeToFormat(dbFile.mime_type);

  // 3) Agent çalıştır
  let result: DesignQCResult;
  let agentError: string | null = null;
  try {
    result = await runDesignQC({
      fileUrl: signed.signedUrl,
      fileFormat,
      printWidthMm: body.printWidthMm,
      printHeightMm: body.printHeightMm,
      productType: body.productType,
    });
  } catch (err) {
    agentError = err instanceof Error ? err.message : "unknown agent error";
    // Audit log için error verdict de kayıt et
    await admin.from("design_quality_checks").insert({
      order_id: body.orderId ?? dbFile.order_id,
      design_file_id: dbFile.id,
      file_format: fileFormat,
      print_width_mm: body.printWidthMm,
      print_height_mm: body.printHeightMm,
      product_type: body.productType,
      verdict: "error",
      error: agentError,
    });
    return NextResponse.json(
      { error: "Agent execution failed", detail: agentError },
      { status: 500 }
    );
  }

  // 4) Sonucu DB'ye kaydet (audit)
  const { data: insertResult, error: insertErr } = await admin
    .from("design_quality_checks")
    .insert({
      order_id: body.orderId ?? dbFile.order_id,
      design_file_id: dbFile.id,
      file_format: fileFormat,
      print_width_mm: body.printWidthMm,
      print_height_mm: body.printHeightMm,
      product_type: body.productType,
      verdict: result.verdict,
      score: result.score,
      analysis: {
        fileType: result.fileType,
        effectiveDpi: result.effectiveDpi,
        embeddedRasterCount: result.embeddedRasterCount,
        colorProfile: result.colorProfile,
        hasBleed: result.hasBleed,
        hasCutPath: result.hasCutPath,
        isTextOutlined: result.isTextOutlined,
        visualQuality: result.visualQuality,
      },
      findings: result.findings,
      model: result.model,
      duration_ms: result.durationMs,
      cost_usd: result.costUsd,
      tokens_used: result.tokensUsed ?? null,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[design-qc] DB insert error:", insertErr);
    // Continue — sonuç döner ama audit kaybı
  }

  const runId = (insertResult as { id?: string } | null)?.id;

  return NextResponse.json({
    ok: true,
    runId,
    fileId: dbFile.id,
    fileName: dbFile.original_name,
    verdict: result.verdict,
    score: result.score,
    fileType: result.fileType,
    effectiveDpi: result.effectiveDpi,
    findings: result.findings,
    analysis: {
      colorProfile: result.colorProfile,
      hasBleed: result.hasBleed,
      hasCutPath: result.hasCutPath,
      isTextOutlined: result.isTextOutlined,
      visualQuality: result.visualQuality,
      embeddedRasterCount: result.embeddedRasterCount,
    },
    telemetry: {
      durationMs: result.durationMs,
      model: result.model,
      costUsd: result.costUsd,
      tokensUsed: result.tokensUsed,
    },
  });
}
