/**
 * GET/POST /api/admin/fason/partners/[id]/file-transfers
 *
 * Fason partnere baskı dosyası gönderim logu (signed URL snapshot).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderPrintUrls } from "@/lib/admin/order-print-urls";

const FILE_TYPES = ["image", "cutline", "both"] as const;

const CreateSchema = z.object({
  order_id: z.string().min(1).max(64),
  file_type: z.enum(FILE_TYPES).default("both"),
});

async function assertPartnerExists(
  admin: ReturnType<typeof createAdminClient>,
  id: string
) {
  const { data } = await admin
    .from("fason_partners")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "view");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  if (!(await assertPartnerExists(admin, id))) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");

  let query = admin
    .from("fason_file_transfers")
    .select(
      "id, order_id, partner_id, file_type, file_url, sent_by, sent_at"
    )
    .eq("partner_id", id)
    .order("sent_at", { ascending: false })
    .limit(100);

  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transfers: data ?? [] });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await assertPermission("fason", "update");
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: partnerId } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!(await assertPartnerExists(admin, partnerId))) {
    return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  }

  const { order_id: orderId, file_type: fileType } = parsed.data;

  const { data: assignment } = await admin
    .from("order_assignments")
    .select("id")
    .eq("order_id", orderId)
    .eq("fason_partner_id", partnerId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json(
      { error: "order_not_assigned_to_partner" },
      { status: 400 }
    );
  }

  const { entries, expiresAt } = await buildOrderPrintUrls(
    admin,
    orderId,
    fileType
  );

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "no_print_files_available" },
      { status: 400 }
    );
  }

  const fileUrlPayload = JSON.stringify({
    expires_at: expiresAt,
    file_type: fileType,
    files: entries,
  });

  const { data, error } = await admin
    .from("fason_file_transfers")
    .insert({
      order_id: orderId,
      partner_id: partnerId,
      file_type: fileType,
      file_url: fileUrlPayload,
      sent_by: auth.user.id,
    })
    .select(
      "id, order_id, partner_id, file_type, file_url, sent_by, sent_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      transfer: data,
      signed_urls: entries,
      expires_at: expiresAt,
    },
    { status: 201 }
  );
}
