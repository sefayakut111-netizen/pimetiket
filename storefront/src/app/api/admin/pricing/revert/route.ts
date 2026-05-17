/**
 * POST /api/admin/pricing/revert?scope=...
 * Body: { history_id: string }
 *
 * Live config'i history snapshot'ına geri çevir.
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import {
  revertPricingConfig,
  type ScopeName,
} from "@/lib/pricing-config";

const VALID_SCOPES: ScopeName[] = ["sticker", "etiket", "global"];

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") as ScopeName | null;
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    history_id?: string;
  };

  if (!body.history_id) {
    return NextResponse.json({ error: "history_id_required" }, { status: 400 });
  }

  const r = await revertPricingConfig(scope, body.history_id);
  if (!r.ok) {
    return NextResponse.json(
      { error: "revert_failed", detail: r.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
