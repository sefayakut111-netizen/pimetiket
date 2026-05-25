/**
 * GET /api/admin/fason/partners/[id]/mail-log
 *
 * Partner'a gönderilen son mailler (fason_mail_outbox).
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "10", 10), 1),
    50
  );

  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("fason_partners")
    .select("contact_email")
    .eq("id", id)
    .maybeSingle();
  if (!partner) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const { data: assignments } = await admin
    .from("order_assignments")
    .select("id")
    .eq("fason_partner_id", id);

  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id
  );

  const partnerEmail = (partner as { contact_email: string }).contact_email;
  const orParts: string[] = [`to_email.eq.${partnerEmail}`];
  if (assignmentIds.length > 0) {
    orParts.push(`assignment_id.in.(${assignmentIds.join(",")})`);
  }

  const { data: rows, error } = await admin
    .from("fason_mail_outbox")
    .select("template_key, sent_at, status, created_at")
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mails = ((rows ?? []) as Array<{
    template_key: string;
    sent_at: string | null;
    status: string;
    created_at: string | null;
  }>).map((r) => ({
    template: r.template_key,
    sentAt: r.sent_at ?? r.created_at ?? new Date().toISOString(),
    status: r.status,
  }));

  return NextResponse.json({ mails });
}
