/**
 * POST /api/admin/customers/[id]/grant-credit
 *
 * Müşteriye manuel kontör/kredi ver (loyalty grant).
 * - Migration 046 loyalty_grants tablosuna log
 * - Migration 030 loyalty_gift_credits tablosuna ekleme yapar (varsa)
 *
 * Body: { amount_try: number, reason: string }
 *
 * Limit: 1-1000 TL arası, sebep zorunlu (2-200 char).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    amount_try?: number;
    reason?: string;
  };
  const amount = Number(body.amount_try ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
    return NextResponse.json(
      { error: "invalid_amount", hint: "1-1000 TL arası" },
      { status: 400 }
    );
  }
  const reason = (body.reason ?? "").trim();
  if (reason.length < 2 || reason.length > 200) {
    return NextResponse.json(
      { error: "invalid_reason", hint: "2-200 karakter sebep gerekli" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error: logError } = await admin
    .from("loyalty_grants")
    .insert([
      {
        user_id: id,
        admin_id: auth.user.id,
        amount_try: amount,
        reason,
        status: "granted",
      },
    ] as never);

  if (logError) {
    return NextResponse.json(
      { error: "log_failed", detail: logError.message },
      { status: 500 }
    );
  }

  // TODO: loyalty_gift_credits tablosuna da insert (kullanıcı bakiyesi)
  // Migration 030'da fn_grant_gift_credit RPC varsa onu çağır.

  return NextResponse.json({
    ok: true,
    amount_try: amount,
    reason,
  });
}
