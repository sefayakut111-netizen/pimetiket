/**
 * POST /api/admin/auditors/[name]/run
 *
 * Manuel agent çalıştırma — admin/staff için.
 *
 * Kullanım: /admin/denetciler/[auditor] sayfasındaki "Şimdi çalıştır"
 * butonu bu endpoint'i çağırır. Cron beklemeden anlık test yapabilirsin.
 *
 * Auth: assertAdmin (cookie session)
 *
 * Response:
 *   { ok: true, auditor, runId }
 *   { ok: false, error }
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { AUDITOR_NAMES, type AuditorName } from "@/lib/agents/_shared/types";
import { SecurityAuditor } from "@/lib/agents/auditors/security";
import { FinanceAuditor } from "@/lib/agents/auditors/finance";
import { WorkflowAuditor } from "@/lib/agents/auditors/workflow";
import { ComplianceAuditor } from "@/lib/agents/auditors/compliance";
import { AiCostAuditor } from "@/lib/agents/auditors/ai-cost";

const AUDITOR_FACTORIES: Partial<
  Record<AuditorName, () => { run: (opts: { triggerType: "manual"; triggeredBy: string }) => Promise<string> }>
> = {
  security: () => new SecurityAuditor(),
  finance: () => new FinanceAuditor(),
  workflow: () => new WorkflowAuditor(),
  compliance: () => new ComplianceAuditor(),
  ai_cost: () => new AiCostAuditor(),
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await params;
  if (!(AUDITOR_NAMES as readonly string[]).includes(name)) {
    return NextResponse.json(
      { error: "unknown_auditor", name },
      { status: 404 }
    );
  }

  const factory = AUDITOR_FACTORIES[name as AuditorName];
  if (!factory) {
    return NextResponse.json(
      {
        error: "auditor_not_implemented",
        name,
        message: `${name} auditor henüz canlı değil. Şu an sadece "security" var; diğerleri Adım 5-7'de eklenecek.`,
      },
      { status: 501 }
    );
  }

  try {
    const auditor = factory();
    const runId = await auditor.run({
      triggerType: "manual",
      triggeredBy: auth.user.id,
    });

    return NextResponse.json({
      ok: true,
      auditor: name,
      runId,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        auditor: name,
        error: errMsg,
      },
      { status: 500 }
    );
  }
}
