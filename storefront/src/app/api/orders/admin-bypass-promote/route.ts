import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { promoteOrderDesigns } from "@/lib/storage/promote-temp-designs";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("admin_role")
    .eq("id", user.id)
    .single();

  if (!(profile as { admin_role: string | null } | null)?.admin_role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = (await req.json()) as { orderId?: string };
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id, product, meta")
    .eq("order_id", orderId);

  const orderItems = (
    (items as unknown as Array<{
      id: string;
      product: "sticker" | "etiket";
      meta: Record<string, unknown>;
    }>) ?? []
  ).filter((i) => (i.meta as { designTempId?: string })?.designTempId);

  let promoted = 0;
  if (orderItems.length > 0) {
    promoted = await promoteOrderDesigns({
      admin,
      orderId,
      userId: user.id,
      orderItems,
    });
  }

  if (promoted > 0) {
    await admin
      .from("orders")
      .update({ status: "qc_pending" })
      .eq("id", orderId);

    scheduleOrderDesignQC(admin, orderId);
  }

  return NextResponse.json({ ok: true, promoted });
}
