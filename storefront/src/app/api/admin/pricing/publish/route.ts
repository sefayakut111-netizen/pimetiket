/**
 * POST /api/admin/pricing/publish?scope=...
 * Body: { note?: string }
 *
 * Draft'ı LIVE'e kopyala + history snapshot + cache invalidate.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import {
  publishPricingConfig,
  type ScopeName,
} from "@/lib/pricing-config";

const VALID_SCOPES: ScopeName[] = [
  "sticker",
  "etiket_rulo",
  "etiket_tabaka",
  "global",
];

export async function POST(req: Request) {
  const auth = await assertPermission("pricing", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") as ScopeName | null;
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { note?: string };

  const r = await publishPricingConfig(
    scope,
    auth.user.id,
    auth.user.email ?? "admin",
    body.note
  );
  if (!r.ok) {
    return NextResponse.json(
      { error: "publish_failed", detail: r.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
