/**
 * GET  /api/admin/pricing?scope=sticker|etiket|global
 *   → draft + live config + meta
 *
 * PUT  /api/admin/pricing?scope=...
 *   Body: { draft: ScopeConfig, note?: string }
 *   → draft kaydet (live'a dokunmaz)
 *
 * POST /api/admin/pricing/publish?scope=...
 *   Body: { note?: string }
 *   → draft'ı live'e kopyala
 *
 * POST /api/admin/pricing/revert?scope=...
 *   Body: { history_id: string }
 *   → history snapshot'ına geri dön
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  getAdminPricingConfig,
  saveDraftPricingConfig,
  listPricingHistory,
  type ScopeConfig,
  type ScopeName,
} from "@/lib/pricing-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerAudit } from "@/lib/audit-log-server";

const VALID_SCOPES: ScopeName[] = [
  "sticker",
  "etiket_rulo",
  "etiket_tabaka",
  "global",
];

function parseScope(req: Request): ScopeName | null {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") as ScopeName | null;
  if (!scope || !VALID_SCOPES.includes(scope)) return null;
  return scope;
}

export async function GET(req: Request) {
  const auth = await assertPermission("pricing", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = parseScope(req);
  if (!scope) {
    return NextResponse.json(
      { error: "invalid_scope", hint: "?scope=sticker|etiket|global" },
      { status: 400 }
    );
  }

  const data = await getAdminPricingConfig(scope);
  if (!data) {
    return NextResponse.json(
      { error: "scope_not_found" },
      { status: 404 }
    );
  }

  const history = await listPricingHistory(scope, 30);

  return NextResponse.json({
    ok: true,
    scope,
    ...data,
    history,
  });
}

/**
 * PUT /api/admin/pricing — Sefa 17 May v4: Single-step save & publish.
 *
 * Form değişikliği direkt LIVE'e yazılır. Eskiden draft → live ayrımı vardı,
 * Sefa "canlı önizleme zaten teklif gibi, draft gereksiz" kararı.
 *
 * Body: { config: ProfileConfig, note?: string }
 * - draft_config + live_config aynı anda güncellenir
 * - history entry: action="publish" (audit log korunur)
 * - cache invalidate
 */
export async function PUT(req: Request) {
  const auth = await assertPermission("pricing", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = parseScope(req);
  if (!scope) {
    return NextResponse.json(
      { error: "invalid_scope" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    config?: unknown;
    draft?: unknown; // geriye uyum
    note?: string;
    changes_count?: number;
  };

  const payload = body.config ?? body.draft;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "config_required" },
      { status: 400 }
    );
  }

  // Sefa 19 May v68: try/catch + detail response — kör 500 yerine sebep
  try {
    // Önce draft kaydet (audit için)
    const r = await saveDraftPricingConfig(
      scope,
      payload as ScopeConfig,
      auth.user.id,
      auth.user.email ?? "admin",
      body.note
    );

    if (!r.ok) {
      return NextResponse.json(
        { error: "save_failed", detail: r.error },
        { status: 500 }
      );
    }

    // Hemen live'e yayınla (single-step) — Sefa 19 May v68: RPC bypass
    const { publishPricingConfig } = await import("@/lib/pricing-config");
    const pub = await publishPricingConfig(
      scope,
      auth.user.id,
      auth.user.email ?? "admin",
      body.note
    );
    if (!pub.ok) {
      return NextResponse.json(
        { error: "publish_failed", detail: pub.error },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    await logServerAudit(admin, {
      actorId: auth.user.id,
      actorEmail: auth.user.email ?? null,
      actorRole: auth.role === "staff" ? "staff" : "admin",
      action: "pricing_config_updated",
      targetType: "pricing_config",
      targetId: scope,
      summary: `Fiyat config güncellendi (${scope})`,
      detail: {
        scope,
        changes_count:
          typeof body.changes_count === "number" ? body.changes_count : null,
        note: body.note ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/admin/pricing] unexpected:", err);
    return NextResponse.json(
      {
        error: "unexpected",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
