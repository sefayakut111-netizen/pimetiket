/**
 * POST /api/admin/fason/partners/[id]/pause
 *
 * Sefa 20 May v68 (Mig 067): partner status='paused' + status_reason.
 * Yeni iş atanmaz, mevcut işler devam eder, dashboard'da uyarı.
 *
 * Body: { reason: string }  (min 2, max 200)
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 200) {
    return NextResponse.json(
      { error: "invalid_reason", hint: "2-200 karakter sebep zorunlu" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("fason_partners")
    .update({
      status: "paused",
      status_reason: reason,
      active: false,
      updated_by: auth.user.id,
    } as never)
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "pause_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, status: "paused", reason });
}
