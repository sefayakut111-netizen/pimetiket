/**
 * POST /api/payment/abandon — kullanıcı ödemeden vazgeçti (geri dönüş /odeme)
 */
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { abandonPendingCheckoutForUser } from "@/lib/payment/abandon-pending-checkout";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await abandonPendingCheckoutForUser(user.id);
  return NextResponse.json({ ok: true, ...result });
}
