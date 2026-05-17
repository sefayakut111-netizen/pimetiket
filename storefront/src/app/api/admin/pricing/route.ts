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
import { assertAdmin } from "@/lib/supabase/assert-admin";
import {
  getAdminPricingConfig,
  saveDraftPricingConfig,
  listPricingHistory,
  type ScopeName,
} from "@/lib/pricing-config";

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
  const auth = await assertAdmin();
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

export async function PUT(req: Request) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = parseScope(req);
  if (!scope) {
    return NextResponse.json(
      { error: "invalid_scope" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    draft?: unknown;
    note?: string;
  };

  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json(
      { error: "draft_required" },
      { status: 400 }
    );
  }

  const r = await saveDraftPricingConfig(
    scope,
    body.draft as never,
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

  return NextResponse.json({ ok: true });
}
