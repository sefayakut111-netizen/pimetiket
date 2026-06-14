/**
 * GET /api/fason/info/[token]
 *
 * Fason web form'unun sipariş özet bilgisi.
 * Token-auth, public.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  redactOrderAddressForPartner,
  redactItemMetaForPartner,
  sanitizeFreeTextForPartner,
} from "@/lib/fason/redact-order-address";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Sunucu yapılandırması" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Token doğrula
  const { data: validateData } = await admin.rpc(
    "fn_validate_fason_token",
    { p_token: token }
  );
  const validation = (validateData as Array<{
    assignment_id: string;
    fason_partner_id: string;
    order_id: string;
    is_valid: boolean;
    reason: string;
  }>)?.[0];

  if (!validation?.is_valid) {
    const status =
      validation?.reason === "token_limit_exceeded" ? 403 : 401;
    return NextResponse.json(
      { error: "Token geçersiz", reason: validation?.reason ?? "unknown" },
      { status }
    );
  }

  // Assignment + order + items
  const { data: assignment } = await admin
    .from("order_assignments")
    .select(
      "id, status, estimated_delivery, notes, assigned_at, acknowledged_at, in_production_at, ready_at, shipped_at, tracking_company, tracking_number"
    )
    .eq("id", validation.assignment_id)
    .maybeSingle();

  const { data: order } = await admin
    .from("orders")
    .select("id, address, created_at")
    .eq("id", validation.order_id)
    .maybeSingle();

  const { data: items } = await admin
    .from("order_items")
    .select("product, title, config, width, height, qty, meta")
    .eq("order_id", validation.order_id);

  const { data: fason } = await admin
    .from("fason_partners")
    .select("name")
    .eq("id", validation.fason_partner_id)
    .maybeSingle();

  const orderRow = order as {
    id: string;
    created_at: string;
    address: Record<string, unknown> | null;
  } | null;

  const assignmentRow = assignment as {
    id: string;
    status: string;
    estimated_delivery: string | null;
    notes: string | null;
    assigned_at: string | null;
    acknowledged_at: string | null;
    in_production_at: string | null;
    ready_at: string | null;
    shipped_at: string | null;
    tracking_company: string | null;
    tracking_number: string | null;
  } | null;

  return NextResponse.json({
    assignment: assignmentRow
      ? {
          ...assignmentRow,
          notes: sanitizeFreeTextForPartner(assignmentRow.notes),
        }
      : null,
    order: orderRow
      ? {
          id: orderRow.id,
          created_at: orderRow.created_at,
          address: redactOrderAddressForPartner(orderRow.address),
        }
      : null,
    items: (items ?? []).map((it) => ({
      ...it,
      config: sanitizeFreeTextForPartner(
        (it as { config?: string | null }).config
      ),
      meta:
        redactItemMetaForPartner(
          (it as { meta?: Record<string, unknown> }).meta
        ) ?? {},
    })),
    fasonName: (fason as { name: string } | null)?.name ?? null,
    downloadUrl: `/api/fason/download/${token}`,
  });
}
