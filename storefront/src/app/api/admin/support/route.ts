import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await assertPermission("help_requests", "view");
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";

  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "open") {
    query = query.in("status", ["open", "in_progress", "waiting_customer"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tickets = data ?? [];
  const userIds = [
    ...new Set(tickets.map((t) => t.user_id).filter(Boolean)),
  ] as string[];

  const emailByUser = new Map<string, string>();
  for (const uid of userIds) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(uid);
      if (u?.user?.email) emailByUser.set(uid, u.user.email);
    } catch {
      /* skip */
    }
  }

  const items = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    category: t.category,
    status: t.status,
    orderId: t.order_id,
    customerName: t.guest_name ?? null,
    customerEmail: t.user_id
      ? emailByUser.get(t.user_id) ?? null
      : t.guest_email,
    adminResponse: t.admin_response,
    adminRespondedAt: t.admin_responded_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  return NextResponse.json({ ok: true, items });
}
