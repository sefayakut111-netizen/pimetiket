/**
 * Mail bildirim helper'ları — server-only.
 *
 * Sefa 21 May v68 — REFACTOR:
 *   Önceki sürüm doğrudan sendMail() çağırıyordu → suppression,
 *   idempotency, retry, webhook tracking, observability YOKTU.
 *
 *   Yeni sürüm: React Email render edilmiş HTML+subject+text payload'da
 *   enqueueMail()'e gönderilir. Cron (process-mail-outbox) çıkışı
 *   `_prerendered` template key'i ile bypass render edip Resend'e gönderir.
 *
 *   Kazançlar:
 *     - mail_suppressions kontrol edilir (bounce/complaint blokları)
 *     - idempotency_key duplicate önler
 *     - Resend down → outbox'ta birikir, geri çekilir (exp backoff)
 *     - Resend webhook delivered/opened/bounce → outbox satırına yazılır
 *     - /admin/mail-health'de görünür
 *
 * Her event tipi için bir fonksiyon. notification_prefs tablosuna bakıp
 * kullanıcı opt-in mı kontrol eder, sonra outbox'a enqueue eder.
 *
 * Çağrıldığı yerler:
 *   - sendOrderConfirmation: /api/payment/callback success
 *   - sendProofReady: admin/prova approve endpoint (P1)
 *   - sendShippingUpdate: admin/siparisler "kargoya ver" endpoint (P1)
 *   - vd. (her helper'ın açıklamasına bak)
 */

import "server-only";

import { render } from "@react-email/render";
import { enqueueMail } from "./enqueue";
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

const SITE_URL_FALLBACK =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

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
// Sefa 21 May v68 — Tek noktada outbox enqueue helper.
// React Email'den render edilmiş HTML + subject + text → outbox.
// ============================================================
async function enqueuePrerendered(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Mail kategorisi — customer (transactional), lead (marketing) */
  category?: "customer" | "lead" | "admin" | "fason";
  /** orders.id (PE-2026-XXXX) → resend tag + observability link */
  orderId?: string;
  /** auth.users.id → audit trail */
  userId?: string;
  /** "order_confirmation", "proof_ready", vb. — idempotency için */
  kind: string;
  /** Tag listesi yerine kullanıcı id'siyle birleşik unique key */
  idempotencyKey?: string;
}): Promise<{ ok: boolean; suppressed?: boolean; error?: string }> {
  const result = await enqueueMail({
    to: args.to,
    templateKey: "_prerendered",
    category: args.category ?? "customer",
    targetType: args.orderId ? "order" : args.userId ? "user" : undefined,
    targetId: args.orderId ?? args.userId,
    subject: args.subject,
    payload: {
      subject: args.subject,
      html: args.html,
      text: args.text,
      _kind: args.kind,
      _user_id: args.userId,
      _order_id: args.orderId,
    },
    idempotencyKey:
      args.idempotencyKey ??
      (args.orderId
        ? `${args.kind}:${args.orderId}:${args.to.toLowerCase()}`
        : undefined),
  });
  return result;
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
  const subject = `Siparişin alındı 🎉 — ${args.orderId}`;
  const text = `Siparişin alındı! ${args.orderId} — ${props.total.toLocaleString(
    "tr-TR"
  )} ₺. Detay: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "order_confirmation",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Provan hazır — ${args.orderId}`;
  const text = `Provan hazır — ${args.orderId}. İncele: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "proof_ready",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Siparişin yola çıktı 🚚 — ${args.orderId}`;
  const text = `Siparişin yola çıktı! ${args.carrierName} ${args.trackingNumber}. Detay: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "shipping_update",
    // Tracking no kombinasyonu — aynı kargo için 2× shipping update gitmesin
    idempotencyKey: `shipping_update:${args.orderId}:${args.trackingNumber}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Tasarım düzeltmesi gerekiyor — ${args.orderId}`;
  const text = `${customerName}, tasarımda düzeltme gerekiyor. Sebep: ${args.reason}. Detay: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "qc_rejected",
    // QC her denemede yeni mail gitsin — fileName ile tekilleştir
    idempotencyKey: args.fileName
      ? `qc_rejected:${args.orderId}:${args.fileName}`
      : `qc_rejected:${args.orderId}:${Date.now()}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Tasarım inceleniyor — ${args.orderId}`;
  const text = `${customerName}, tasarımın operatör incelemesinde. 1-3 saat içinde sonuç. Detay: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "qc_flagged",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Siparişin teslim edildi ✅ — ${args.orderId}`;
  const text = `Siparişin teslim edildi: ${args.orderId}. Yorum bırak: ${SITE_URL_FALLBACK}/siparis/${args.orderId}#yorum`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "order_delivered",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = SUBJECT_BY_STATUS[args.status];
  const text = `${args.description}${args.location ? ` (${args.location})` : ""}. Takip: ${args.trackingNumber}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: `shipment_${args.status}`,
    // Aynı tracking + status için tek mail
    idempotencyKey: `shipment_${args.status}:${args.orderId}:${args.trackingNumber}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Baskı önizlemen hazır — ${args.orderId}`;
  const text = `Baskı onayını bekliyoruz — ${args.orderId}. Onay sayfası: ${SITE_URL_FALLBACK}/onay/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "proof_required",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Baskı onayını bekliyoruz — ${args.orderId}`;
  const text = `Baskı onayı hatırlatma — ${args.orderId}. ${args.pendingCount} ürün bekliyor: ${SITE_URL_FALLBACK}/onay/${args.orderId}`;

  // Hatırlatma günde 1× — aynı gün 2× tetiklenmesin
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "proof_reminder",
    idempotencyKey: `proof_reminder:${args.orderId}:${today}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
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
  const subject = `Üretime geçtik 🎉 — ${args.orderId}`;
  const text = `Teşekkürler — onayın alındı, üretim başladı. ${args.orderId}: ${SITE_URL_FALLBACK}/siparis/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "proof_approved",
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}
