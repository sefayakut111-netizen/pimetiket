/**
 * Aksiyon önerme + uygulama helper'ları.
 *
 * AuditorBase.runChecks() içinde finding'e suggestedAction eklenebilir;
 * bu modül onay verildikten sonra aksiyonu DISPATCH eder.
 *
 * Aksiyon dispatcher pattern:
 *   - actions/[type].ts dosyaları default export bir async fn
 *   - Sefa onayladığında, action_type'a göre doğru handler çağrılır
 *   - Handler { result, affectedRows, affectedIds, externalCall } döner
 *   - auditor_action_log'a audit kaydı düşer
 *
 * Yeni action eklemek için:
 *   1. src/lib/agents/actions/[type].ts dosyası oluştur
 *   2. ActionHandler imzasına uygun fn yaz
 *   3. ACTION_REGISTRY'ye ekle (aşağıda)
 *   4. Test: SQL ile sahte pending_action insert → onay → uygulanır mı bak
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult, AuditorPendingActionRow } from "./types";

// Action handler implementasyonları
import blockIp from "../actions/block-ip";
import lockAdminAccount from "../actions/lock-admin-account";
import notifySefa from "../actions/notify-sefa";

// ============================================================
// Handler interface
// ============================================================

export interface ActionExecutionResult {
  result: ActionResult;          // "success" | "failed" | "partial"
  affectedRows?: number;
  affectedIds?: Record<string, unknown>;
  externalCall?: Record<string, unknown>;
  error?: string;
}

export interface ActionHandlerContext {
  admin: SupabaseClient;
  pendingActionId: string;
  payload: Record<string, unknown>;
  executedBy: string | null;        // onaylayan user_id
  reviewNote: string | null;
}

export type ActionHandler = (
  ctx: ActionHandlerContext
) => Promise<ActionExecutionResult>;

// ============================================================
// Action registry — yeni action ekledikçe burayı güncelle
// ============================================================

/**
 * Adım 4 ile gelen ilk 3 action handler.
 *
 * Yeni action eklemek için:
 *   1. src/lib/agents/actions/[type].ts dosyası oluştur
 *   2. ActionHandler imzasına uygun default export
 *   3. Aşağıdaki registry'ye ekle
 *   4. Manuel test: SQL ile sahte pending_action insert → onay → uygulanır mı
 */
export const ACTION_REGISTRY: Record<string, ActionHandler> = {
  block_ip: blockIp,
  lock_admin_account: lockAdminAccount,
  notify_sefa: notifySefa,
};

// ============================================================
// Public API — Decision endpoint çağırır
// ============================================================

/**
 * Onaylanmış pending_action'ı uygula.
 *
 * @returns Audit log row id (başarılı veya hatalı uygulama kaydı)
 */
export async function executePendingAction(opts: {
  pendingActionId: string;
  executedBy: string | null;
  reviewNote: string | null;
}): Promise<{ logId: string; result: ActionResult; error?: string }> {
  const admin = createAdminClient();

  // 1) Pending action'ı çek
  const { data: pendingRow, error: fetchErr } = await admin
    .from("auditor_pending_actions")
    .select("*")
    .eq("id", opts.pendingActionId)
    .single();

  if (fetchErr || !pendingRow) {
    throw new Error(
      `Pending action not found: ${opts.pendingActionId} — ${fetchErr?.message ?? "missing"}`
    );
  }

  const pending = pendingRow as unknown as AuditorPendingActionRow;

  // 2) Status kontrolü — sadece "approved" durumda execute edilir
  if (pending.status !== "approved") {
    throw new Error(
      `Cannot execute pending action — status="${pending.status}", expected "approved"`
    );
  }

  // 3) Handler lookup
  const handler = ACTION_REGISTRY[pending.action_type];
  if (!handler) {
    const errMsg = `No handler registered for action_type="${pending.action_type}"`;
    await markFailed(admin, pending.id, errMsg);
    Sentry.captureMessage(`[auditor] ${errMsg}`, {
      level: "error",
      extra: { pendingActionId: pending.id },
    });
    return { logId: "", result: "failed", error: errMsg };
  }

  // 4) Execute
  let execResult: ActionExecutionResult;
  try {
    execResult = await handler({
      admin,
      pendingActionId: pending.id,
      payload: pending.action_payload,
      executedBy: opts.executedBy,
      reviewNote: opts.reviewNote,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    execResult = { result: "failed", error: errMsg };
    Sentry.captureException(err, {
      tags: {
        scope: "auditor.action_exec",
        action_type: pending.action_type,
        auditor: pending.auditor_name,
      },
      extra: { pendingActionId: pending.id },
    });
  }

  // 5) Audit log
  const { data: logRow } = await admin
    .from("auditor_action_log")
    .insert({
      pending_action_id: pending.id,
      executed_by: opts.executedBy,
      result: execResult.result,
      affected_rows: execResult.affectedRows ?? null,
      affected_ids: execResult.affectedIds ?? null,
      external_call: execResult.externalCall ?? null,
      error: execResult.error ?? null,
    } as never)
    .select("id")
    .single();

  // 6) pending_action status güncelle
  const finalStatus = execResult.result === "success" ? "applied" : "failed";
  await admin
    .from("auditor_pending_actions")
    .update({
      status: finalStatus,
      applied_at: new Date().toISOString(),
      apply_error: execResult.error ?? null,
      apply_result: {
        result: execResult.result,
        affectedRows: execResult.affectedRows,
        affectedIds: execResult.affectedIds,
      } as Record<string, unknown>,
    } as never)
    .eq("id", pending.id);

  return {
    logId: (logRow as { id: string } | null)?.id ?? "",
    result: execResult.result,
    error: execResult.error,
  };
}

// ============================================================
// Helpers
// ============================================================

async function markFailed(
  admin: SupabaseClient,
  pendingActionId: string,
  errorMsg: string
): Promise<void> {
  await admin
    .from("auditor_pending_actions")
    .update({
      status: "failed",
      applied_at: new Date().toISOString(),
      apply_error: errorMsg,
    } as never)
    .eq("id", pendingActionId);
}
