/**
 * POST /api/admin/fason/partners/[id]/resume
 *
 * Sefa 20 May v68 (Mig 067): partner status='active' (paused'tan dönüş).
 * status_reason temizlenir.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("fason_partners")
    .update({
      status: "active",
      status_reason: null,
      active: true,
      updated_by: auth.user.id,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "resume_failed", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, status: "active" });
}
