import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleOrderDesignQC } from "@/lib/agents/schedule-order-design-qc";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .single();

  if (!order || (order as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = (order as { status: string }).status;

  if (status !== "awaiting_upload" && status !== "paid") {
    return NextResponse.json({ ok: true, status, message: "Already advanced" });
  }

  const { count } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

  if (!count || count === 0) {
    return NextResponse.json({ ok: false, error: "No design files found" });
  }

  await admin
    .from("orders")
    .update({ status: "qc_pending" })
    .eq("id", orderId);

  scheduleOrderDesignQC(admin, orderId);

  return NextResponse.json({ ok: true, status: "qc_pending" });
}
