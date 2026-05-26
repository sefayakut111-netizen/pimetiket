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

  console.log("[promote] admin-bypass-promote orderId:", orderId);

  const { data: orderRow } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();

  const orderUserId = (orderRow as { user_id: string } | null)?.user_id;
  if (!orderUserId) {
    console.warn("[promote] order not found:", orderId);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: items } = await admin
    .from("order_items")
    .select("id, product, meta")
    .eq("order_id", orderId);

  const allItems =
    (items as unknown as Array<{
      id: string;
      product: "sticker" | "etiket";
      meta: Record<string, unknown>;
    }>) ?? [];

  console.log(
    "[promote] orderItems meta.designTempId:",
    allItems.map((i) => ({
      id: i.id,
      designTempId: (i.meta as { designTempId?: string })?.designTempId ?? null,
    }))
  );

  const orderItems = allItems.filter((i) => {
    const tid = (i.meta as { designTempId?: string })?.designTempId;
    return !!tid && !tid.startsWith("local-");
  });

  console.log("[promote] orderItems with designTempId:", orderItems.length);

  let promoted = 0;
  if (orderItems.length > 0) {
    promoted = await promoteOrderDesigns({
      admin,
      orderId,
      userId: orderUserId,
      orderItems,
    });
  }

  console.log("[promote] result promoted:", promoted);

  if (promoted > 0) {
    await admin
      .from("orders")
      .update({ status: "qc_pending" })
      .eq("id", orderId);

    scheduleOrderDesignQC(admin, orderId);
  }

  return NextResponse.json({ ok: true, promoted });
}
