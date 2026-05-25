/**
 * GET /api/admin/shipping/label/[orderId]
 *
 * Sefa 19 May v68 (Faz A — sözleşme öncesi kargo etiketi):
 *   - assertAdmin
 *   - orders.address + (varsa) order_assignments.tracking_number çek
 *   - 100 × 150 mm PDF üret (jspdf + bwip-js)
 *   - audit log (order_events)
 *
 * Tracking number yoksa: PIM-{orderId}-{rand4} cargoKey üretilir.
 * Müşteri/operatör şubeye götürüp gerçek barkod alır, AdminTrackingForm'a
 * girer, sonra etiketi tekrar indirir.
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { generateShippingLabel } from "@/lib/shipping/generate-label";

export const runtime = "nodejs";
export const maxDuration = 15;

const SENDER = {
  name: process.env.SHIPPING_SENDER_NAME ?? "Pim Etiket",
  address:
    process.env.SHIPPING_SENDER_ADDRESS ??
    "Atatürk Mah. Örnek Cd. No:1",
  city: process.env.SHIPPING_SENDER_CITY ?? "Üsküdar / İstanbul",
  phone: process.env.SHIPPING_SENDER_PHONE ?? "0 850 000 00 00",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = await assertPermission("shipments", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Order
  const { data: order } = await admin
    .from("orders")
    .select("id, status, address, created_at")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as
    | {
        id: string;
        status: string;
        address: {
          name?: string;
          phone?: string;
          addr?: string;
          city?: string;
        } | null;
        created_at: string;
      }
    | null;
  if (!orderRow) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }
  if (!orderRow.address?.name) {
    return NextResponse.json(
      { error: "Sipariş adresi eksik — etiket üretilemez" },
      { status: 400 }
    );
  }

  // Order items — toplam kg tahmini için (sticker hafif, ortalama 0.5kg/item)
  const { data: items } = await admin
    .from("order_items")
    .select("qty")
    .eq("order_id", orderId);
  const itemCount = (items as { qty: number }[] | null)?.length ?? 1;
  const totalKg = Math.max(0.3, Math.min(5, itemCount * 0.5));

  // Tracking number (varsa) — son order_assignments
  const { data: assignments } = await admin
    .from("order_assignments")
    .select("tracking_number")
    .eq("order_id", orderId)
    .order("assigned_at", { ascending: false })
    .limit(1);
  const trackingNumber =
    ((assignments as { tracking_number: string | null }[] | null)?.[0]
      ?.tracking_number ?? null) || null;

  // Cargo key — tracking yoksa geçici barkod için
  const cargoKey = `PIM-${orderId}-${randomBytes(2).toString("hex").toUpperCase()}`;

  // PDF üret
  const pdf = await generateShippingLabel({
    orderCode: orderRow.id,
    trackingNumber,
    cargoKey,
    createdAt: new Date(orderRow.created_at),
    cargoCount: 1,
    totalKg,
    sender: SENDER,
    receiver: {
      name: orderRow.address.name ?? "",
      phone: orderRow.address.phone ?? "",
      address: orderRow.address.addr ?? "",
      city: orderRow.address.city ?? "",
    },
    description: "Icerik: Sticker / Etiket",
  });

  // Audit log
  await admin.from("order_events").insert([
    {
      order_id: orderId,
      event_type: "shipping_label_printed",
      status_after: orderRow.status as Enums<"order_status">,
      actor_id: auth.user.id,
      actor_role: auth.role,
      summary: trackingNumber
        ? `Kargo etiketi indirildi (tracking: ${trackingNumber})`
        : `Kargo etiketi indirildi (geçici: ${cargoKey})`,
      detail: {
        tracking_number: trackingNumber,
        cargo_key: cargoKey,
        admin_email: auth.user.email,
      },
    },
  ]);

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="kargo-${orderRow.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
