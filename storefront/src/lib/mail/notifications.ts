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
  )} TL. Detay: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"}/siparis/${args.orderId}`;

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
