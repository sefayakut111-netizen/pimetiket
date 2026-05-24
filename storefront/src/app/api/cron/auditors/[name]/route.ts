/**
 * GET /api/cron/auditors/[name]
 *
 * Vercel Cron tetikleyici. vercel.json'da schedule tanımlı:
 *   - /api/cron/auditors/security       (saatlik)
 *   - /api/cron/auditors/finance        (günlük 09:00)
 *   - /api/cron/auditors/workflow       (4 saatlik)
 *   - ... (Adım 5-7'de gelecek)
 *
 * Güvenlik:
 *   - Vercel Cron `Authorization: Bearer <CRON_SECRET>` header gönderir
 *   - CRON_SECRET env'de tanımlı olmalı
 *   - Yetkisiz çağrılarda 401
 *
 * Akış:
 *   1. Auth header doğrula
 *   2. auditor name'i validate et
 *   3. İlgili Auditor class'ını instantiate et + run()
 *   4. Çalışma sonucunu JSON döndür (Vercel log'a düşer)
 */

import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { AUDITOR_NAMES, type AuditorName } from "@/lib/agents/_shared/types";
import { SecurityAuditor } from "@/lib/agents/auditors/security";
import { FinanceAuditor } from "@/lib/agents/auditors/finance";
import { WorkflowAuditor } from "@/lib/agents/auditors/workflow";
import { ComplianceAuditor } from "@/lib/agents/auditors/compliance";
import { AiCostAuditor } from "@/lib/agents/auditors/ai-cost";
import { DataHygieneAuditor } from "@/lib/agents/auditors/data-hygiene";
import { CustomerHealthAuditor } from "@/lib/agents/auditors/customer-health";
import { SeoAuditor } from "@/lib/agents/auditors/seo";
import { BrandAuditor } from "@/lib/agents/auditors/brand";

// Auditor name → factory function
const AUDITOR_FACTORIES: Partial<
  Record<AuditorName, () => { run: (opts: { triggerType: "cron"; triggeredBy: string }) => Promise<string> }>
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  // 1) Auth — Sefa 23 May v68 (P1.3): assertCronAuth (timing-safe).
  const guard = assertCronAuth(req);
  if (guard) return guard;

  // 2) Auditor name validate
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
        message: `${name} auditor henüz canlı değil. Adım 5-7'de eklenecek.`,
      },
      { status: 501 }
    );
  }

  // 3) Run
  try {
    const auditor = factory();
    const runId = await auditor.run({
      triggerType: "cron",
      triggeredBy: `vercel-cron:${name}`,
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
