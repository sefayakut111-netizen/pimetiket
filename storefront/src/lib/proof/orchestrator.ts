import { createAdminClient } from "@/lib/supabase/admin";
import { categorizeFile } from "@/lib/design-file-types";
import { detectCutlineInFile } from "@/lib/proof/cutline-detect";
import { generateWhiteLayer } from "@/lib/proof/white-layer";
import {
  runProofRuleCheck,
  type RuleCheckResult,
} from "@/lib/proof/rule-validator";
import { validateProofWithAI, type ProofAIResult } from "@/lib/proof/ai-validator";
import { autoFixProof } from "@/lib/proof/auto-fix";
import {
  detectBackground,
  type BgDetectResult,
} from "@/lib/proof/background-detect";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export interface ProofPipelineInput {
  orderId: string;
  itemId: string;
  designFileId: string | null;
  designFileUrl: string;
  fileName: string;
  materialKey: string;
  designWidth: number;
  designHeight: number;
  cutlineSvgPath?: string;
}

export interface ProofPipelineResult {
  status: "proof_pending" | "operator_review";
  validationId: string;
}

function extractPathFromSvg(svg: string): string {
  const match = svg.match(/\bd=["']([^"']+)["']/i);
  return match?.[1] ?? "";
}

async function saveValidation(
  orderId: string,
  itemId: string,
  designFileId: string | null,
  payload: {
    rules: RuleCheckResult;
    ai: ProofAIResult | null;
    fixLog: string[] | null;
    verdict: "pass" | "warn" | "fail" | "operator";
  }
): Promise<string> {
  const admin = createAdminClient();
  const row: TablesInsert<"proof_validations"> = {
    order_id: orderId,
    order_item_id: itemId,
    design_file_id: designFileId,
    rule_check_passed: payload.rules.passed,
    rule_issues: payload.rules.issues as unknown as Json,
    ai_validated: payload.ai !== null,
    ai_verdict: payload.ai?.overall_verdict ?? null,
    ai_cutline: (payload.ai?.cutline ?? null) as Json | null,
    ai_white_layer: (payload.ai?.white_layer ?? null) as Json | null,
    ai_suggestions: (payload.ai?.auto_fix_suggestions ?? null) as Json | null,
    ai_pim_message: payload.ai?.pim_message ?? null,
    auto_fixed: (payload.fixLog?.length ?? 0) > 0,
    fix_log: (payload.fixLog ?? null) as Json | null,
    final_verdict: payload.verdict,
  };

  const { data, error } = await admin
    .from("proof_validations")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[proof/orchestrator] saveValidation:", error);
    return "";
  }
  return (data as { id: string }).id;
}

async function saveBgDetectFlag(
  itemId: string,
  orderId: string,
  bg: BgDetectResult
): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("order_items")
    .select("meta")
    .eq("id", itemId)
    .eq("order_id", orderId)
    .maybeSingle();
  const prevMeta =
    ((row as { meta?: Record<string, unknown> } | null)?.meta as Record<
      string,
      unknown
    >) ?? {};
  await admin
    .from("order_items")
    .update({
      meta: {
        ...prevMeta,
        bg_detect: bg as unknown as Json,
        bg_removal_dismissed: false,
      },
    })
    .eq("id", itemId)
    .eq("order_id", orderId);
}

export async function runProofPipeline(
  input: ProofPipelineInput
): Promise<ProofPipelineResult> {
  const fileCategoryRaw = categorizeFile(input.fileName);
  const fileCategory: "processable" | "qc_only" =
    fileCategoryRaw === "qc_only" ? "qc_only" : "processable";
  const admin = createAdminClient();

  if (fileCategoryRaw === "qc_only") {
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", input.orderId);
    return { status: "proof_pending", validationId: "" };
  }

  if (fileCategory === "processable") {
    try {
      const bgResult = await detectBackground(
        input.designFileUrl,
        input.fileName,
        input.materialKey
      );
      if (bgResult.needsRemoval) {
        await saveBgDetectFlag(input.itemId, input.orderId, bgResult);
      }
    } catch (err) {
      console.warn("[proof/orchestrator] bg detect skipped:", err);
    }
  }

  let cutlinePath = input.cutlineSvgPath ?? "";
  let partCount = cutlinePath ? 1 : 0;

  if (!cutlinePath) {
    const detected = await detectCutlineInFile(
      input.designFileUrl,
      input.fileName,
      ""
    );
    if (detected.found && detected.svgPath) {
      cutlinePath = detected.svgPath;
      partCount = detected.partCount ?? 1;
    }
  }

  let whiteResult = { generated: false, coverage: 0 };
  if (cutlinePath) {
    const wr = await generateWhiteLayer({
      designFileUrl: input.designFileUrl,
      cutlineSvgPath: cutlinePath,
      materialKey: input.materialKey,
      designWidth: input.designWidth,
      designHeight: input.designHeight,
    });
    whiteResult = {
      generated: wr.generated,
      coverage: wr.coverage ?? 0,
    };
  }

  const rules = runProofRuleCheck({
    designWidth: input.designWidth,
    designHeight: input.designHeight,
    cutlineSvgPath: cutlinePath,
    cutlinePartCount: partCount,
    cutlineOffset: 1.5,
    whiteLayerExists: whiteResult.generated,
    whiteCoverage: whiteResult.coverage,
    materialKey: input.materialKey,
    fileCategory,
  });

  if (rules.passed) {
    const vid = await saveValidation(input.orderId, input.itemId, input.designFileId, {
      rules,
      ai: null,
      fixLog: null,
      verdict: "pass",
    });
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", input.orderId);
    return { status: "proof_pending", validationId: vid };
  }

  let aiResult: ProofAIResult | null = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      aiResult = await validateProofWithAI(
        input.designFileUrl,
        input.designFileUrl,
        null
      );
    } catch (err) {
      console.warn("[proof/orchestrator] AI validation skipped:", err);
    }
  }

  if (
    aiResult &&
    (aiResult.overall_verdict === "pass" || aiResult.overall_verdict === "warn")
  ) {
    const vid = await saveValidation(input.orderId, input.itemId, input.designFileId, {
      rules,
      ai: aiResult,
      fixLog: null,
      verdict: aiResult.overall_verdict,
    });
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", input.orderId);
    return { status: "proof_pending", validationId: vid };
  }

  if (aiResult) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const fix = await autoFixProof(
        {
          designWidth: input.designWidth,
          designHeight: input.designHeight,
          cutlineSvgPath: cutlinePath,
          cutlinePartCount: partCount,
          cutlineOffset: 1.5,
          whiteLayerExists: whiteResult.generated,
          whiteCoverage: whiteResult.coverage,
          materialKey: input.materialKey,
          fileCategory,
        },
        aiResult
      );

      if (!fix.fixed || !fix.fixedCutlineSvg) break;

      cutlinePath = extractPathFromSvg(fix.fixedCutlineSvg) || fix.fixedCutlineSvg;
      const recheck = runProofRuleCheck({
        designWidth: input.designWidth,
        designHeight: input.designHeight,
        cutlineSvgPath: cutlinePath,
        cutlinePartCount: partCount,
        cutlineOffset: 1.5,
        whiteLayerExists: whiteResult.generated,
        whiteCoverage: whiteResult.coverage,
        materialKey: input.materialKey,
        fileCategory,
      });

      if (recheck.passed) {
        const vid = await saveValidation(input.orderId, input.itemId, input.designFileId, {
          rules: recheck,
          ai: aiResult,
          fixLog: fix.fixLog,
          verdict: "pass",
        });
        await admin
          .from("orders")
          .update({ status: "proof_pending" })
          .eq("id", input.orderId);
        return { status: "proof_pending", validationId: vid };
      }
    }
  }

  const vid = await saveValidation(input.orderId, input.itemId, input.designFileId, {
    rules,
    ai: aiResult,
    fixLog: null,
    verdict: aiResult ? "operator" : "warn",
  });

  const finalStatus = aiResult?.overall_verdict === "fail" ? "operator_review" : "proof_pending";
  await admin
    .from("orders")
    .update({ status: finalStatus })
    .eq("id", input.orderId);

  return {
    status: finalStatus === "operator_review" ? "operator_review" : "proof_pending",
    validationId: vid,
  };
}

/** Müşteri düzenleme sonrası arka plan doğrulama */
export async function runProofValidationAfterEdit(params: {
  orderId: string;
  itemId: string;
  designFileId: string | null;
  svg: string;
  fileName: string;
  designFileUrl: string;
  materialKey: string;
  designWidth: number;
  designHeight: number;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("orders")
    .update({ status: "proof_validating" })
    .eq("id", params.orderId);

  try {
    await runProofPipeline({
      orderId: params.orderId,
      itemId: params.itemId,
      designFileId: params.designFileId,
      designFileUrl: params.designFileUrl,
      fileName: params.fileName,
      materialKey: params.materialKey,
      designWidth: params.designWidth,
      designHeight: params.designHeight,
      cutlineSvgPath: extractPathFromSvg(params.svg),
    });
  } catch (err) {
    console.error("[proof/orchestrator] after-edit failed:", err);
    await admin
      .from("orders")
      .update({ status: "proof_pending" })
      .eq("id", params.orderId);
  }
}
