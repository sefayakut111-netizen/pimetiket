import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateCutlineHeadless } from "./generate-cutline-headless";
import { categorizeFile } from "@/lib/design-file-types";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { saveCutlineEdit } from "@/lib/proof/save-cutline-edit";
import { runProofPipeline } from "@/lib/proof/orchestrator";
import { sendProofReady } from "@/lib/mail/notifications";

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Siparişteki tüm item'lar için server-side bıçak üretir.
 * QC geçtikten sonra çağrılır (run-order-qc.ts'den).
 */
export async function runOrderCutlineGeneration(
  admin: SupabaseClient<Database>,
  orderId: string
): Promise<{ generated: number; failed: number }> {
  const siteUrl = SITE_URL();
  let generated = 0;
  let failed = 0;

  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) return { generated: 0, failed: 0 };

  const orderUserId = (orderRow as { user_id: string }).user_id;

  const { data: items } = await admin
    .from("order_items")
    .select("id, product, width, height, meta")
    .eq("order_id", orderId);

  if (!items || items.length === 0) return { generated: 0, failed: 0 };

  const pendingProofs: {
    itemId: string;
    designFileId: string;
    storagePath: string;
    originalName: string;
    width: number;
    height: number;
    materialKey: string;
    cutlineSvg: string;
  }[] = [];

  for (const item of items) {
    const itemMeta = item.meta as Record<string, unknown> | null;

    const { data: designFiles } = await admin
      .from("design_files")
      .select("id, storage_path, original_name, mime_type, status")
      .eq("order_item_id", item.id)
      .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

    if (!designFiles || designFiles.length === 0) continue;

    for (const df of designFiles) {
      const category = categorizeFile(df.original_name, df.mime_type);
      if (category === "qc_only" || category === "blocked") continue;

      const { count: existingCutline } = await admin
        .from("cutline_designs")
        .select("id", { count: "exact", head: true })
        .eq("order_item_id", item.id)
        .eq("design_file_id", df.id)
        .in("status", ["draft", "auto_generated", "approved"]);

      if (existingCutline && existingCutline > 0) continue;

      const { data: signedData } = await admin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(df.storage_path, 300);

      if (!signedData?.signedUrl) {
        failed++;
        continue;
      }

      const materialRaw = String(
        itemMeta?.material_type ?? itemMeta?.material ?? "paper"
      );
      const material =
        materialRaw === "transparan" || materialRaw === "transparent"
          ? "transparent"
          : materialRaw === "holo" || materialRaw === "holographic"
            ? "holographic"
            : materialRaw === "simli" || materialRaw === "metallic"
              ? "metallic"
              : "paper";

      const result = await generateCutlineHeadless({
        designUrl: signedData.signedUrl,
        designName: df.original_name,
        designMime: df.mime_type,
        material,
        orderId,
        itemId: item.id,
        siteUrl,
      });

      if (!result) {
        failed++;
        await admin.from("order_events").insert([
          {
            order_id: orderId,
            event_type: "cutline_generation_failed",
            status_after: null,
            actor_id: orderUserId,
            actor_role: "system",
            summary: `Otomatik bıçak üretilemedi: ${df.original_name}`,
            detail: { itemId: item.id, designFileId: df.id },
          },
        ]);
        continue;
      }

      const saveResult = await saveCutlineEdit(admin, {
        orderId,
        itemId: item.id,
        actorUserId: orderUserId,
        actorRole: "system",
        body: {
          svg: result.svg,
          preview_png_base64: result.preview_png_base64,
          auto: true,
          design_file_id: df.id,
          source: String(result.meta.source ?? "raster"),
          mode: String(result.meta.mode ?? "contour"),
          offset_mm:
            typeof result.meta.offset_mm === "number"
              ? result.meta.offset_mm
              : null,
          smoothness:
            typeof result.meta.smoothness === "number"
              ? result.meta.smoothness
              : null,
          dpi: typeof result.meta.dpi === "number" ? result.meta.dpi : null,
          width_mm:
            typeof result.meta.width_mm === "number"
              ? result.meta.width_mm
              : null,
          height_mm:
            typeof result.meta.height_mm === "number"
              ? result.meta.height_mm
              : null,
          pim_feedback:
            typeof result.meta.pim_feedback === "string"
              ? result.meta.pim_feedback
              : null,
          pim_severity:
            typeof result.meta.pim_severity === "string"
              ? result.meta.pim_severity
              : null,
          material_type:
            typeof result.meta.material_type === "string"
              ? result.meta.material_type
              : null,
          white_plan_mode:
            typeof result.meta.white_plan_mode === "string"
              ? result.meta.white_plan_mode
              : null,
          white_plan_path_count:
            typeof result.meta.white_plan_path_count === "number"
              ? result.meta.white_plan_path_count
              : 0,
          has_custom_white_plan: result.meta.has_custom_white_plan === true,
          tier:
            typeof result.meta.tier === "string" ? result.meta.tier : null,
          detected_cut_contour_names: Array.isArray(
            result.meta.detected_cut_contour_names
          )
            ? (result.meta.detected_cut_contour_names as string[])
            : [],
        },
      });

      if (saveResult.ok) {
        generated++;
        pendingProofs.push({
          itemId: item.id,
          designFileId: df.id,
          storagePath: df.storage_path,
          originalName: df.original_name,
          width: item.width,
          height: item.height,
          materialKey: material,
          cutlineSvg: result.svg,
        });
      } else {
        failed++;
        console.error(
          "[run-order-cutline] save failed:",
          saveResult.error,
          orderId,
          item.id
        );
      }
    }
  }

  let proofPipelineStatus: "proof_pending" | "operator_review" | null = null;
  for (const pp of pendingProofs) {
    const { data: signedForProof } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(pp.storagePath, 300);
    if (!signedForProof?.signedUrl) continue;
    try {
      const pr = await runProofPipeline({
        orderId,
        itemId: pp.itemId,
        designFileId: pp.designFileId,
        designFileUrl: signedForProof.signedUrl,
        fileName: pp.originalName,
        materialKey: pp.materialKey,
        designWidth: pp.width,
        designHeight: pp.height,
        cutlineSvgPath: pp.cutlineSvg,
      });
      proofPipelineStatus = pr.status;
      if (pr.status === "operator_review") break;
    } catch (err) {
      console.error("[run-order-cutline] proof pipeline failed:", orderId, pp.itemId, err);
    }
  }

  // Server cutline başarısız olsa bile proof_pending — müşteri /onay'da iframe fallback
  if (proofPipelineStatus !== "operator_review") {
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", orderId)
      .eq("status", "proof_generating");
  }

  const { data: orderAfter } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (
    (orderAfter as { status: string } | null)?.status === "proof_pending" &&
    generated > 0
  ) {
    void sendProofReady({ userId: orderUserId, orderId }).catch((err) => {
      console.error("[run-order-cutline] sendProofReady failed:", err);
    });
  }

  return { generated, failed };
}
