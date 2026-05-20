/**
 * Mail bildirim helper'ları — server-only.
 *
 * Her event tipi için bir fonksiyon. notification_prefs tablosuna bakıp
 * kullanıcı opt-in mı kontrol eder, sonra Resend ile gönderir.
 *
 * Çağrıldığı yerler:
 *   - sendOrderConfirmation: /api/payment/callback success
 *   - sendProofReady: admin/prova approve endpoint (P1)
 *   - sendShippingUpdate: admin/siparisler "kargoya ver" endpoint (P1)
 */

import "server-only";

import { render } from "@react-email/render";
import { sendMail } from "./resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OrderConfirmationEmail,
  type OrderConfirmationProps,
} from "./templates/order-confirmation";
import {
  ProofReadyEmail,
  type ProofReadyProps,
} from "./templates/proof-ready";
import {
  ShippingUpdateEmail,
  type ShippingUpdateProps,
} from "./templates/shipping-update";
// Sefa 19 May v68 (su borusu denetimi — 4 yeni mail):
import {
  QcRejectedEmail,
  type QcRejectedProps,
} from "./templates/qc-rejected";
import {
  QcFlaggedEmail,
  type QcFlaggedProps,
} from "./templates/qc-flagged";
import {
  OrderDeliveredEmail,
  type OrderDeliveredProps,
} from "./templates/order-delivered";
import {
  ShipmentStatusEmail,
  type ShipmentStatusProps,
  type ShipmentStatusKind,
} from "./templates/shipment-status";
// Sefa 19 May v68 (Migration 059 — baskı onay akışı, 3 yeni mail):
import {
  OrderProofRequiredEmail,
  type OrderProofRequiredProps,
} from "./templates/order-proof-required";
import {
  OrderProofReminderEmail,
  type OrderProofReminderProps,
} from "./templates/order-proof-reminder";
import {
  OrderProofApprovedEmail,
  type OrderProofApprovedProps,
} from "./templates/order-proof-approved";

// ============================================================
// Pref check helper
// ============================================================

interface NotifPrefRow {
  email_order_updates: boolean;
  email_proof_ready: boolean;
  email_shipping_updates: boolean;
}

async function getEmailPref(
  userId: string,
  field: keyof NotifPrefRow
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_prefs")
    .select("email_order_updates, email_proof_ready, email_shipping_updates")
    .eq("user_id", userId)
    .single();
  if (!data) {
    // Pref satırı yoksa default açık (order_updates yasal zorunlu)
    return field === "email_order_updates" ? true : true;
  }
  return Boolean((data as unknown as NotifPrefRow)[field]);
}

async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

// ============================================================
// 1) Order confirmation
// ============================================================

export async function sendOrderConfirmation(args: {
  userId: string;
  orderId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  // Order detail çek
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", args.orderId)
    .single();
  if (!order) return { ok: false, reason: "order_not_found" };

  const { data: items } = await admin
    .from("order_items")
    .select("*")
    .eq("order_id", args.orderId);

  const orderData = order as unknown as {
    address: { name: string };
    subtotal: number;
    shipping: number;
    total: number;
    estimated_delivery: string | null;
  };
  const itemsList = (items ?? []) as unknown as Array<{
    title: string;
    config: string;
    qty: number;
    total: number;
  }>;

  const props: OrderConfirmationProps = {
    customerName: orderData.address.name ?? "Müşteri",
    orderId: args.orderId,
    items: itemsList.map((i) => ({
      title: i.title,
      config: i.config,
      qty: i.qty,
      total: Number(i.total),
    })),
    subtotal: Number(orderData.subtotal),
    shipping: Number(orderData.shipping),
    total: Number(orderData.total),
    estimatedDelivery: orderData.estimated_delivery
      ? new Date(orderData.estimated_delivery).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : undefined,
  };

  const html = await render(OrderConfirmationEmail(props));
  const text = `Siparişin alındı! ${args.orderId} — ${props.total.toLocaleString(
    "tr-TR"
  )} ₺. Detay: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"}/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Siparişin alındı 🎉 — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "order_confirmation" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// 2) Proof ready
// ============================================================

export async function sendProofReady(args: {
  userId: string;
  orderId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_proof_ready");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address")
    .eq("id", args.orderId)
    .single();
  const { data: items } = await admin
    .from("order_items")
    .select("title")
    .eq("order_id", args.orderId)
    .limit(1);

  const customerName =
    (order as unknown as { address: { name: string } } | null)?.address.name ??
    "Müşteri";
  const productTitle =
    (items as unknown as Array<{ title: string }> | null)?.[0]?.title ??
    "Tasarım";

  const props: ProofReadyProps = {
    customerName,
    orderId: args.orderId,
    productTitle,
  };

  const html = await render(ProofReadyEmail(props));
  const text = `Provan hazır — ${args.orderId}. İncele: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Provan hazır — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "proof_ready" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// 3) Shipping update
// ============================================================

export async function sendShippingUpdate(args: {
  userId: string;
  orderId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_shipping_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address, estimated_delivery")
    .eq("id", args.orderId)
    .single();

  const orderData = order as unknown as {
    address: { name: string };
    estimated_delivery: string | null;
  } | null;

  const props: ShippingUpdateProps = {
    customerName: orderData?.address.name ?? "Müşteri",
    orderId: args.orderId,
    carrierName: args.carrierName,
    trackingNumber: args.trackingNumber,
    trackingUrl: args.trackingUrl,
    estimatedDelivery: orderData?.estimated_delivery
      ? new Date(orderData.estimated_delivery).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : undefined,
  };

  const html = await render(ShippingUpdateEmail(props));
  const text = `Siparişin yola çıktı! ${args.carrierName} ${args.trackingNumber}. Detay: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Siparişin yola çıktı 🚚 — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "shipping_update" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// Sefa 19 May v68 — Su borusu denetimi 4 yeni helper
// ============================================================

/**
 * 4) AI QC reddedildi — müşteriye düzeltme iste
 */
export async function sendQcRejected(args: {
  userId: string;
  orderId: string;
  reason: string;
  fileName?: string;
  issueCategory?: QcRejectedProps["issueCategory"];
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", args.userId)
    .maybeSingle();

  const customerName =
    (profile as { display_name?: string | null } | null)?.display_name ??
    email.split("@")[0];

  const props: QcRejectedProps = {
    customerName,
    orderId: args.orderId,
    reason: args.reason,
    fileName: args.fileName,
    issueCategory: args.issueCategory ?? "other",
  };

  const html = await render(QcRejectedEmail(props));
  const text = `${customerName}, tasarımda düzeltme gerekiyor. Sebep: ${args.reason}. Detay: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Tasarım düzeltmesi gerekiyor — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "qc_rejected" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

/**
 * 5) AI QC flagged — operatör inceliyor
 */
export async function sendQcFlagged(args: {
  userId: string;
  orderId: string;
  warnings: string[];
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", args.userId)
    .maybeSingle();

  const customerName =
    (profile as { display_name?: string | null } | null)?.display_name ??
    email.split("@")[0];

  const props: QcFlaggedProps = {
    customerName,
    orderId: args.orderId,
    warnings: args.warnings,
  };

  const html = await render(QcFlaggedEmail(props));
  const text = `${customerName}, tasarımın operatör incelemesinde. 1-3 saat içinde sonuç. Detay: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Tasarım inceleniyor — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "qc_flagged" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

/**
 * 6) Sipariş teslim edildi
 */
export async function sendOrderDelivered(args: {
  userId: string;
  orderId: string;
  deliveredAt: string;
  carrierLabel?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_shipping_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", args.userId)
    .maybeSingle();

  const customerName =
    (profile as { display_name?: string | null } | null)?.display_name ??
    email.split("@")[0];

  const props: OrderDeliveredProps = {
    customerName,
    orderId: args.orderId,
    deliveredAt: args.deliveredAt,
    carrierLabel: args.carrierLabel,
  };

  const html = await render(OrderDeliveredEmail(props));
  const text = `Siparişin teslim edildi: ${args.orderId}. Yorum bırak: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}#yorum`;

  const result = await sendMail({
    to: email,
    subject: `Siparişin teslim edildi ✅ — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "order_delivered" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

/**
 * 7) Kargo durum güncelleme — yolda / dağıtımda / failed / returned
 */
export async function sendShipmentStatus(args: {
  userId: string;
  orderId: string;
  status: ShipmentStatusKind;
  description: string;
  location?: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_shipping_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", args.userId)
    .maybeSingle();

  const customerName =
    (profile as { display_name?: string | null } | null)?.display_name ??
    email.split("@")[0];

  const props: ShipmentStatusProps = {
    customerName,
    orderId: args.orderId,
    status: args.status,
    description: args.description,
    location: args.location,
    trackingNumber: args.trackingNumber,
    trackingUrl: args.trackingUrl,
  };

  const SUBJECT_BY_STATUS: Record<ShipmentStatusKind, string> = {
    in_transit: `Kargon yola çıktı 🚚 — ${args.orderId}`,
    out_for_delivery: `Kargon bugün dağıtımda 🛵 — ${args.orderId}`,
    failed: `Teslimat başarısız ⚠️ — ${args.orderId}`,
    returned: `Kargo iade edildi ↩️ — ${args.orderId}`,
  };

  const html = await render(ShipmentStatusEmail(props));
  const text = `${args.description}${args.location ? ` (${args.location})` : ""}. Takip: ${args.trackingNumber}`;

  const result = await sendMail({
    to: email,
    subject: SUBJECT_BY_STATUS[args.status],
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: `shipment_${args.status}` },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// Sefa 19 May v68 (Migration 059 — baskı onay akışı):
// 8) Order proof required — paid → proof_pending tetikleyici
// ============================================================
//
// Çağrı: /api/payment/callback success branch'inde fire-and-forget.
// DB trigger zaten 'proof_pending' state'ine geçirir; bu mail müşteriye
// "onay sayfasına git" çağrısıdır.

export async function sendOrderProofRequired(args: {
  userId: string;
  orderId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  // Order updates kategorisinde — yasal/işlemsel, opt-out olsa bile gider
  // (ödeme sonrası kritik aksiyon talebi — kontrat akışı parçası)
  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address, total")
    .eq("id", args.orderId)
    .single();

  const { count: itemCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", args.orderId);

  if (!order) return { ok: false, reason: "order_not_found" };

  const orderData = order as unknown as {
    address: { name: string };
    total: number;
  };
  const customerName = orderData.address?.name ?? "Müşteri";

  const props: OrderProofRequiredProps = {
    customerName,
    orderId: args.orderId,
    itemCount: itemCount ?? 1,
    totalLabel: orderData.total
      ? `${Number(orderData.total).toLocaleString("tr-TR")} ₺`
      : undefined,
  };

  const html = await render(OrderProofRequiredEmail(props));
  const text = `Baskı onayını bekliyoruz — ${args.orderId}. Onay sayfası: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/onay/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Baskı önizlemen hazır — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "proof_required" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// 9) Order proof reminder — cron tetiklemeli (24sa onay yok)
// ============================================================

export async function sendOrderProofReminder(args: {
  userId: string;
  orderId: string;
  pendingCount: number;
  hoursSincePaid: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address")
    .eq("id", args.orderId)
    .single();
  const customerName =
    (order as unknown as { address: { name: string } } | null)?.address?.name ??
    "Müşteri";

  const props: OrderProofReminderProps = {
    customerName,
    orderId: args.orderId,
    pendingCount: args.pendingCount,
    hoursSincePaid: args.hoursSincePaid,
  };

  const html = await render(OrderProofReminderEmail(props));
  const text = `Baskı onayı hatırlatma — ${args.orderId}. ${args.pendingCount} ürün bekliyor: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/onay/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Baskı onayını bekliyoruz — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "proof_reminder" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}

// ============================================================
// 10) Order proof approved — fn_finalize_proof sonrası
// ============================================================

export async function sendOrderProofApproved(args: {
  userId: string;
  orderId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address, estimated_delivery")
    .eq("id", args.orderId)
    .single();
  const { count: itemCount } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", args.orderId);

  if (!order) return { ok: false, reason: "order_not_found" };

  const orderData = order as unknown as {
    address: { name: string };
    estimated_delivery: string | null;
  };
  const customerName = orderData.address?.name ?? "Müşteri";

  const props: OrderProofApprovedProps = {
    customerName,
    orderId: args.orderId,
    itemCount: itemCount ?? 1,
    estimatedDelivery: orderData.estimated_delivery
      ? new Date(orderData.estimated_delivery).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null,
  };

  const html = await render(OrderProofApprovedEmail(props));
  const text = `Teşekkürler — onayın alındı, üretim başladı. ${args.orderId}: ${
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"
  }/siparis/${args.orderId}`;

  const result = await sendMail({
    to: email,
    subject: `Üretime geçtik 🎉 — ${args.orderId}`,
    html,
    text,
    tags: [
      { name: "category", value: "transactional" },
      { name: "type", value: "proof_approved" },
    ],
  });

  return { ok: result.ok, reason: result.error };
}
