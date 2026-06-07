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
  OrderProofReminderEmail,
  type OrderProofReminderProps,
} from "./templates/order-proof-reminder";
import {
  OrderProofApprovedEmail,
  type OrderProofApprovedProps,
} from "./templates/order-proof-approved";
// Sefa 22 May v68 (Faz 4 — Uzman akışı):
import {
  ProofHelpResolvedEmail,
  type ProofHelpResolvedProps,
} from "./templates/proof-help-resolved";
import {
  OrderCancelledEmail,
  type OrderCancelledProps,
  type OrderCancelSource,
} from "./templates/order-cancelled";
import {
  PaymentFailedEmail,
  type PaymentFailedProps,
} from "./templates/payment-failed";
import {
  RefundRequestEmail,
  type RefundRequestProps,
} from "./templates/refund-request";
import {
  RefundApprovedEmail,
  type RefundApprovedProps,
} from "./templates/refund-approved";
import {
  RefundRejectedEmail,
  type RefundRejectedProps,
} from "./templates/refund-rejected";
import {
  RefundCompletedEmail,
  type RefundCompletedProps,
} from "./templates/refund-completed";
import {
  MemberWelcomeEmail,
  type MemberWelcomeProps,
} from "./templates/member-welcome";
import {
  ReviewRequestEmail,
  type ReviewRequestProps,
} from "./templates/review-request";
import {
  AbandonedCartEmail,
  type AbandonedCartProps,
} from "./templates/abandoned-cart";
import {
  NewsletterWelcomeEmail,
  type NewsletterWelcomeProps,
} from "./templates/newsletter-welcome";
import { buildUnsubscribeUrl } from "./unsubscribe";
import { humanizeOperatorNoteForCustomer } from "./humanize-operator-note";

const SITE_URL_FALLBACK =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

// ============================================================
// Pref check helper
// ============================================================

interface NotifPrefRow {
  email_order_updates: boolean;
  email_proof_ready: boolean;
  email_shipping_updates: boolean;
  email_marketing: boolean;
}

async function getEmailPref(
  userId: string,
  field: keyof NotifPrefRow
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("notification_prefs")
    .select(
      "email_order_updates, email_proof_ready, email_shipping_updates, email_marketing"
    )
    .eq("user_id", userId)
    .single();
  if (!data) {
    if (field === "email_marketing") return false;
    return true;
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

/** Ticari ileti — category lead + List-Unsubscribe (cron tarafında). */
async function enqueueCommercialPrerendered(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  idempotencyKey: string;
  userId?: string;
  orderId?: string;
  targetType?: "order" | "user" | "subscriber";
  targetId?: string;
}): Promise<{ ok: boolean; suppressed?: boolean; error?: string }> {
  return enqueueMail({
    to: args.to,
    templateKey: "_prerendered",
    category: "lead",
    targetType: args.targetType,
    targetId: args.targetId,
    subject: args.subject,
    payload: {
      subject: args.subject,
      html: args.html,
      text: args.text,
      _kind: args.kind,
      _user_id: args.userId,
      _order_id: args.orderId,
    },
    idempotencyKey: args.idempotencyKey,
  });
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

/** İlk prova bildirimi — sendOrderProofRequired ile mükerrer önlenir. */
export function customerProofNotifyIdempotencyKey(orderId: string): string {
  return `customer_proof_notify:${orderId}`;
}

export async function sendProofReady(args: {
  userId: string;
  orderId: string;
  /** Revize sonrası yeni bildirim için farklı anahtar ver. */
  idempotencyKey?: string;
  /** İşlemsel prova bildirimi — tercih opt-out'u atla. */
  transactional?: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!args.transactional) {
    const optedIn = await getEmailPref(args.userId, "email_proof_ready");
    if (!optedIn) return { ok: false, reason: "opted_out" };
  }

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
    idempotencyKey:
      args.idempotencyKey ?? customerProofNotifyIdempotencyKey(args.orderId),
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

/** Ödeme/recover sonrası — cutline sendProofReady ile aynı idempotency; yalnız proof_pending. */
export async function sendOrderProofRequiredIfEligible(args: {
  userId: string;
  orderId: string;
}): Promise<{ ok: boolean; reason?: string; skipped?: boolean }> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", args.orderId)
    .single();

  if (!order) return { ok: false, reason: "order_not_found" };

  const status = (order as { status: string }).status;
  if (status !== "proof_pending") {
    return { ok: false, reason: "status_not_eligible", skipped: true };
  }

  return sendOrderProofRequired(args);
}

/** Prova hazır bildirimi — sendProofReady ile tek kanal (mükerrer mail önlenir). */
export async function sendOrderProofRequired(args: {
  userId: string;
  orderId: string;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendProofReady({
    userId: args.userId,
    orderId: args.orderId,
    idempotencyKey: args.idempotencyKey,
    transactional: true,
  });
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
// 9b) Auto-refund stale proof — sendRefundCompleted wrapper (aşağıda)
// ============================================================

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

// ============================================================
// 11) Proof help resolved — Sefa 22 May v68 Faz 4
// ============================================================
// Operatör /admin/yardim-talepleri'nden cevap yazıp "Çözüldü" işaretledi.
// Müşteri bu mail ile bilgilendirilir. proof_help_request_id idempotency'de
// kullanılır (aynı ticket için tek mail).

export async function sendProofHelpResolved(args: {
  userId: string;
  orderId: string;
  helpRequestId: string;
  itemTitle: string;
  originalMessage: string;
  resolutionNote: string;
}): Promise<{ ok: boolean; reason?: string }> {
  // KVKK: yasal bildirim sayılır (sipariş güncellemesi) → order_updates pref
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  // Müşteri adı orders.address'tan
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("address")
    .eq("id", args.orderId)
    .single();
  const customerName =
    ((order as { address?: { name?: string } } | null)?.address?.name) ??
    "Müşteri";

  const props: ProofHelpResolvedProps = {
    customerName,
    orderId: args.orderId,
    itemTitle: args.itemTitle,
    originalMessage: args.originalMessage,
    resolutionNote: args.resolutionNote,
  };

  const html = await render(ProofHelpResolvedEmail(props));
  const subject = `Yardım talebine cevap geldi — ${args.orderId}`;
  const text = `Operatör cevabı:\n\n${args.resolutionNote}\n\nProvaya dön: ${SITE_URL_FALLBACK}/onay/${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "proof_help_resolved",
    // Aynı ticket için tek mail — admin tekrar resolve etse de yeniden tetiklenmez
    idempotencyKey: `proof_help_resolved:${args.helpRequestId}`,
  });

  return {
    ok: result.ok,
    reason: result.suppressed ? "suppressed" : result.error,
  };
}

// ============================================================
// P0 launch — 7 yeni transactional mail helper
// ============================================================

const STALE_PROOF_CANCEL_REASON =
  "36 saat içinde prova onayı alınamadığı için sipariş otomatik iptal edildi.";

const CUSTOMER_CANCEL_REASON =
  "Sipariş iptal talebin işlendi. Üretime girmeden vazgeçtin.";

/** PayTR iade maili — auto_refund_stale_proof ile çakışmasın */
export function refundCompletedIdempotencyKey(
  orderId: string,
  refundPaymentId?: string
): string {
  if (refundPaymentId) {
    return `refund_completed:${orderId}:${refundPaymentId}`;
  }
  return `refund_completed:${orderId}`;
}

async function resolveCustomerName(
  userId: string,
  orderId?: string
): Promise<string> {
  const admin = createAdminClient();
  if (orderId) {
    const { data: order } = await admin
      .from("orders")
      .select("address")
      .eq("id", orderId)
      .maybeSingle();
    const fromOrder = (
      order as { address?: { name?: string } } | null
    )?.address?.name;
    if (fromOrder) return fromOrder;
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const email = await getUserEmail(userId);
  return (
    (profile as { display_name?: string | null } | null)?.display_name ??
    email?.split("@")[0] ??
    "Müşteri"
  );
}

/**
 * 12) Sipariş iptal — müşteri / admin / SLA
 */
export async function sendOrderCancelled(args: {
  userId: string;
  orderId: string;
  cancelSource: OrderCancelSource;
  operatorNote?: string | null;
  refundAmount?: number | null;
  refundInitiated?: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  let reason: string;
  if (args.cancelSource === "customer") {
    reason = CUSTOMER_CANCEL_REASON;
  } else if (args.cancelSource === "stale_proof") {
    reason = STALE_PROOF_CANCEL_REASON;
  } else {
    reason = await humanizeOperatorNoteForCustomer({
      operatorNote: args.operatorNote,
      context: "order_cancel",
      orderId: args.orderId,
    });
  }

  const customerName = await resolveCustomerName(args.userId, args.orderId);

  const props: OrderCancelledProps = {
    customerName,
    orderId: args.orderId,
    reason,
    cancelSource: args.cancelSource,
    refundAmount: args.refundAmount,
    refundInitiated: args.refundInitiated,
  };

  const html = await render(OrderCancelledEmail(props));
  const subject = `Sipariş iptal edildi — ${args.orderId}`;
  const text = `${reason} ${args.orderId}: ${SITE_URL_FALLBACK}/siparislerim`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "order_cancelled",
    idempotencyKey: `order_cancelled:${args.orderId}:${args.cancelSource}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 13) Ödeme başarısız — sipariş oluşmadı
 */
export async function sendPaymentFailed(args: {
  userId: string;
  amount?: number;
  failureHint?: string;
  merchantOid?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId);

  const props: PaymentFailedProps = {
    customerName,
    amount: args.amount,
    failureHint: args.failureHint,
  };

  const html = await render(PaymentFailedEmail(props));
  const subject = "Ödeme alınamadı — sepetin duruyor";
  const text = `Ödeme tamamlanmadı. Sepet: ${SITE_URL_FALLBACK}/sepet`;

  const idKey = args.merchantOid
    ? `payment_failed:${args.merchantOid}`
    : `payment_failed:${args.userId}:${Date.now()}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    kind: "payment_failed",
    idempotencyKey: idKey,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 14) İade talebi alındı
 */
export async function sendRefundRequest(args: {
  userId: string;
  orderId: string;
  returnId: string;
  reasonLabel: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId, args.orderId);

  const props: RefundRequestProps = {
    customerName,
    orderId: args.orderId,
    returnId: args.returnId,
    reasonLabel: args.reasonLabel,
  };

  const html = await render(RefundRequestEmail(props));
  const subject = `İade talebin alındı — ${args.orderId}`;
  const text = `İade talebi inceleniyor — ${args.orderId}`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "refund_request",
    idempotencyKey: `refund_request:${args.returnId}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 15) İade talebi onaylandı
 */
export async function sendRefundApproved(args: {
  userId: string;
  orderId: string;
  returnId: string;
  adminNote: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId, args.orderId);

  const props: RefundApprovedProps = {
    customerName,
    orderId: args.orderId,
    returnId: args.returnId,
    adminNote: args.adminNote,
  };

  const html = await render(RefundApprovedEmail(props));
  const subject = `İade talebin onaylandı — ${args.orderId}`;
  const text = args.adminNote;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "refund_approved",
    idempotencyKey: `refund_approved:${args.returnId}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 16) İade talebi reddedildi (AI gerekçe)
 */
export async function sendRefundRejected(args: {
  userId: string;
  orderId: string;
  returnId: string;
  operatorNote?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_order_updates");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const reason = await humanizeOperatorNoteForCustomer({
    operatorNote: args.operatorNote,
    context: "refund_rejected",
    orderId: args.orderId,
  });

  const customerName = await resolveCustomerName(args.userId, args.orderId);

  const props: RefundRejectedProps = {
    customerName,
    orderId: args.orderId,
    returnId: args.returnId,
    reason,
  };

  const html = await render(RefundRejectedEmail(props));
  const subject = `İade talebi sonucu — ${args.orderId}`;
  const text = reason;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "refund_rejected",
    idempotencyKey: `refund_rejected:${args.returnId}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 17) Para iadesi tamamlandı — PayTR success sonrası
 * sendAutoRefundStaleProof yerine bu kullanılır (çift mail guard).
 */
export async function sendRefundCompleted(args: {
  userId: string;
  orderId: string;
  refundAmount: number;
  cardLast4?: string;
  refundPaymentId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId, args.orderId);

  const props: RefundCompletedProps = {
    customerName,
    orderId: args.orderId,
    refundAmount: args.refundAmount,
    cardLast4: args.cardLast4,
  };

  const html = await render(RefundCompletedEmail(props));
  const amountLabel = args.refundAmount.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });
  const subject = `İade kartına yansıyacak — ${args.orderId}`;
  const text = `${amountLabel} ₺ iade başlatıldı — ${args.orderId}`;

  const idempotencyKey = refundCompletedIdempotencyKey(
    args.orderId,
    args.refundPaymentId
  );

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "refund_completed",
    idempotencyKey,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/** @deprecated sendRefundCompleted kullan — geriye uyum için wrapper */
export async function sendAutoRefundStaleProof(args: {
  userId: string;
  orderId: string;
  refundAmount?: number;
  refundPaymentId?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("total")
    .eq("id", args.orderId)
    .maybeSingle();

  const total = args.refundAmount ?? (order ? Number((order as { total: number }).total) : 0);

  return sendRefundCompleted({
    userId: args.userId,
    orderId: args.orderId,
    refundAmount: total,
    refundPaymentId: args.refundPaymentId,
  });
}

/**
 * 18) Üyelik hoşgeldin — transactional, tek sefer
 */
export async function sendMemberWelcome(args: {
  userId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId);

  const props: MemberWelcomeProps = { customerName };

  const html = await render(MemberWelcomeEmail(props));
  const subject = "Pim Etiket'e hoş geldin";
  const text = `Hoş geldin! Sticker/etiket siparişi: ${SITE_URL_FALLBACK}/sticker`;

  const result = await enqueuePrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    kind: "member_welcome",
    idempotencyKey: `member_welcome:${args.userId}`,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 19) Yorum daveti — ticari (email_marketing opt-in zorunlu)
 */
export async function sendReviewRequest(args: {
  userId: string;
  orderId: string;
  productName?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_marketing");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName = await resolveCustomerName(args.userId, args.orderId);
  const productName = args.productName ?? "siparişin";
  const unsubscribeUrl = buildUnsubscribeUrl(email, "marketing");

  const props: ReviewRequestProps = {
    customerName,
    orderId: args.orderId,
    productName,
    unsubscribeUrl,
  };

  const html = await render(ReviewRequestEmail(props));
  const firstName = customerName.split(" ")[0] || customerName;
  const subject = firstName
    ? `${firstName}, ${productName} nasıl oldu?`
    : `${productName} için yorumun bizim için kıymetli`;
  const reviewLink = `${SITE_URL_FALLBACK}/yorum-yaz/${args.orderId}`;
  const text = `${productName} (${args.orderId}) için yorum yaz: ${reviewLink}\n\nAbonelikten çık: ${unsubscribeUrl}`;

  const result = await enqueueCommercialPrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    orderId: args.orderId,
    kind: "review_request",
    idempotencyKey: `review_request:${args.orderId}`,
    targetType: "order",
    targetId: args.orderId,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 20) Terk sepet — ticari (email_marketing opt-in zorunlu)
 */
export async function sendAbandonedCart(args: {
  userId: string;
  itemCount: number;
  total: number;
  customerName?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const optedIn = await getEmailPref(args.userId, "email_marketing");
  if (!optedIn) return { ok: false, reason: "opted_out" };

  const email = await getUserEmail(args.userId);
  if (!email) return { ok: false, reason: "no_email" };

  const customerName =
    args.customerName ?? (await resolveCustomerName(args.userId));
  const unsubscribeUrl = buildUnsubscribeUrl(email, "marketing");
  const totalRounded = Math.round(args.total);

  const props: AbandonedCartProps = {
    customerName,
    itemCount: args.itemCount,
    total: totalRounded,
    unsubscribeUrl,
  };

  const html = await render(AbandonedCartEmail(props));
  const firstName = customerName.split(" ")[0] || customerName;
  const subject = firstName
    ? `${firstName}, sepetindeki ${args.itemCount} ürün hâlâ bekliyor`
    : `Sepetindeki ${args.itemCount} ürün hâlâ bekliyor`;
  const text = `Sepette ${args.itemCount} ürün, toplam ${totalRounded.toLocaleString("tr-TR")} ₺.\n\nSepete dön: ${SITE_URL_FALLBACK}/sepet\n\nAbonelikten çık: ${unsubscribeUrl}`;

  const dayKey = new Date().toISOString().slice(0, 10);

  const result = await enqueueCommercialPrerendered({
    to: email,
    subject,
    html,
    text,
    userId: args.userId,
    kind: "abandoned_cart",
    idempotencyKey: `abandoned_cart:${args.userId}:${dayKey}`,
    targetType: "user",
    targetId: args.userId,
  });

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}

/**
 * 21) Bülten hoşgeldin — ticari (abone onayı sonrası)
 */
export async function sendNewsletterWelcome(args: {
  email: string;
  subscriberId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("email_subscribers")
    .select("subscribed, welcome_sent_at")
    .eq("id", args.subscriberId)
    .maybeSingle();

  const row = sub as { subscribed?: boolean; welcome_sent_at?: string | null } | null;
  if (!row?.subscribed) return { ok: false, reason: "not_subscribed" };
  if (row.welcome_sent_at) return { ok: false, reason: "already_sent" };

  const email = args.email.toLowerCase().trim();
  const unsubscribeUrl = buildUnsubscribeUrl(email, "marketing");

  const props: NewsletterWelcomeProps = { unsubscribeUrl };
  const html = await render(NewsletterWelcomeEmail(props));
  const subject = "Pim Etiket bültenine hoş geldin";
  const text = `Bültene kaydoldun. Sticker/etiket: ${SITE_URL_FALLBACK}/sticker\n\nAbonelikten çık: ${unsubscribeUrl}`;

  const result = await enqueueCommercialPrerendered({
    to: email,
    subject,
    html,
    text,
    kind: "newsletter_welcome",
    idempotencyKey: `newsletter_welcome:${args.subscriberId}`,
    targetType: "subscriber",
    targetId: args.subscriberId,
  });

  if (result.ok && !result.suppressed) {
    await admin
      .from("email_subscribers")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("id", args.subscriberId);
  }

  return { ok: result.ok, reason: result.suppressed ? "suppressed" : result.error };
}
