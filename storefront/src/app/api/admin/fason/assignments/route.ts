/**
 * GET /api/admin/fason/assignments?partnerId=<uuid>
 *
 * Bir fason ortağının son atamalarını döner.
 * /admin/fason sayfasında "atama geçmişi" panelinde kullanılır.
 *
 * Auth: admin/staff.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Auth
  const auth = await assertPermission("fason", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  const { searchParams } = new URL(req.url);
  const partnerId = searchParams.get("partnerId")?.trim() ?? "";
  if (!partnerId) {
    return NextResponse.json(
      { error: "partnerId zorunlu" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("order_assignments")
    .select(
      "id, order_id, fason_partner_id, status, assigned_at, estimated_delivery, actual_delivery"
    )
    .eq("fason_partner_id", partnerId)
    .order("assigned_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[fason/assignments]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignments: data ?? [] });
}
