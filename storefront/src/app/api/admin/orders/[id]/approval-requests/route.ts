/**
 * GET/POST /api/admin/orders/[id]/approval-requests
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createApprovalRequest,
  parseApprovalUploadFiles,
} from "@/lib/approvals/create-approval-request";
import { listApprovalRequestsForOrder } from "@/lib/approvals/list-approval-requests";

export const runtime = "nodejs";

function parseBlocking(raw: FormDataEntryValue | null): boolean {
  if (raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("proof", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  try {
    const requests = await listApprovalRequestsForOrder(admin, orderId);
    return NextResponse.json({ ok: true, requests });
  } catch (err) {
    console.error("[admin/approval-requests] list failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("proof", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const admin = createAdminClient();
  const { data: orderRow } = await admin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const result = await createApprovalRequest(
    admin,
    {
      orderId,
      orderItemId,
      source: "admin",
      partnerId: null,
      createdBy: auth.user.id,
      title,
      message,
      blocking,
      actorRole: auth.role,
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
