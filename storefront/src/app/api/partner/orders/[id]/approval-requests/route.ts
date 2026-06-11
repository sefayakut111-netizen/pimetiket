/**
 * POST /api/partner/orders/[id]/approval-requests
 * Aktif atamalı partner onay görseli isteği oluşturur.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartnerContext } from "@/lib/supabase/partner-auth";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";
import {
  createApprovalRequest,
  parseApprovalUploadFiles,
} from "@/lib/approvals/create-approval-request";

export const runtime = "nodejs";

function parseBlocking(raw: FormDataEntryValue | null): boolean {
  if (raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawOrderId } = await params;
  if (!rawOrderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const ctx = await resolvePartnerContext();
  if (!ctx || ctx.isPreview || !ctx.partnerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const partnerId = ctx.partnerId;

  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .ilike("id", rawOrderId)
    .maybeSingle();
  const order = orderRow as { id: string } | null;
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const asg = await assertActivePartnerAssignment(
    admin,
    order.id,
    partnerId,
    "id, fason_partner_id, status"
  );
  if (!asg.ok) {
    return NextResponse.json({ error: "not_your_order" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData okunamadı" }, { status: 400 });
  }

  const titleRaw = formData.get("title");
  const title =
    typeof titleRaw === "string" ? titleRaw.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli" }, { status: 400 });
  }

  const messageRaw = formData.get("message");
  const message =
    typeof messageRaw === "string" && messageRaw.trim()
      ? messageRaw.trim().slice(0, 2000)
      : null;

  const orderItemRaw = formData.get("order_item_id");
  const orderItemId =
    typeof orderItemRaw === "string" && orderItemRaw.trim()
      ? orderItemRaw.trim()
      : null;

  const blocking = parseBlocking(formData.get("blocking"));

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File) files.push(single);
  }

  const parsed = await parseApprovalUploadFiles(files);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createApprovalRequest(
    admin,
    {
      orderId: order.id,
      orderItemId,
      source: "partner",
      partnerId,
      createdBy: ctx.userId,
      title,
      message,
      blocking,
      actorRole: "partner",
      files,
    },
    parsed.parsed
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    request_id: result.requestId,
    asset_count: result.assetCount,
  });
}
