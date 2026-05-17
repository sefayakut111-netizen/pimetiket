/**
 * GET /api/admin/customers/[id]
 *
 * Müşteri 360° — overview + activity timeline + son siparişler +
 * notes + tags + loyalty grants. Migration 046 fn_admin_customer_360 RPC.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  // UUID basit validation
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "fn_admin_customer_360" as never,
    { p_user_id: id } as never
  );

  if (error) {
    return NextResponse.json(
      { error: "rpc_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data });
}
