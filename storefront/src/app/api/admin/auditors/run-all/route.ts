/**
 * POST /api/admin/auditors/run-all
 *
 * Tüm 9 auditor'u sırayla manuel çalıştır.
 * /admin/denetciler ana sayfasındaki "▶ Tümünü çalıştır" butonu çağırır.
 *
 * Akış:
 *   - Her auditor için ayrı try/catch (biri hata verirse diğerleri devam)
 *   - Sırayla çalıştır (paralel değil — DB lock riski + log temiz)
 *   - Sonuç dizisi döndür: { auditor, runId, success, error? }
 *
 * Response:
 *   { ok: true, results: [{ auditor, runId, success }], total: 9, succeeded: N }
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import {
  AUDITOR_NAMES,
  type AuditorName,
} from "@/lib/agents/_shared/types";
import { SecurityAuditor } from "@/lib/agents/auditors/security";
import { FinanceAuditor } from "@/lib/agents/auditors/finance";
import { WorkflowAuditor } from "@/lib/agents/auditors/workflow";
import { ComplianceAuditor } from "@/lib/agents/auditors/compliance";
import { AiCostAuditor } from "@/lib/agents/auditors/ai-cost";
import { DataHygieneAuditor } from "@/lib/agents/auditors/data-hygiene";
import { CustomerHealthAuditor } from "@/lib/agents/auditors/customer-health";
import { SeoAuditor } from "@/lib/agents/auditors/seo";
import { BrandAuditor } from "@/lib/agents/auditors/brand";

const AUDITOR_FACTORIES: Record<
  AuditorName,
  () => { run: (opts: { triggerType: "manual"; triggeredBy: string }) => Promise<string> }
> = {
  security: () => new SecurityAuditor(),
  finance: () => new FinanceAuditor(),
  workflow: () => new WorkflowAuditor(),
  compliance: () => new ComplianceAuditor(),
  ai_cost: () => new AiCostAuditor(),
  data_hygiene: () => new DataHygieneAuditor(),
  customer_health: () => new CustomerHealthAuditor(),
  seo: () => new SeoAuditor(),
  brand: () => new BrandAuditor(),
};

interface AuditorResult {
  auditor: AuditorName;
  runId: string | null;
  success: boolean;
  error?: string;
  durationMs: number;
}

export async function POST() {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startedAt = Date.now();
  const results: AuditorResult[] = [];

  for (const name of AUDITOR_NAMES) {
    const factory = AUDITOR_FACTORIES[name];
    const auditorStart = Date.now();

    try {
      const auditor = factory();
      const runId = await auditor.run({
        triggerType: "manual",
        triggeredBy: `${auth.user.id}:run-all`,
      });
      results.push({
        auditor: name,
        runId,
        success: true,
        durationMs: Date.now() - auditorStart,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        auditor: name,
        runId: null,
        success: false,
        error: errMsg,
        durationMs: Date.now() - auditorStart,
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const totalDurationMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    total: AUDITOR_NAMES.length,
    succeeded,
    failed: AUDITOR_NAMES.length - succeeded,
    totalDurationMs,
    results,
  });
}
