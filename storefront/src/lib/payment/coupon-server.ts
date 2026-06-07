/**
 * Server-side kupon doğrulama ve sipariş sonrası uygulama.
 *
 * UI preview: fn_validate_coupon (authenticated).
 * Ödeme init: sunucu tarafında total doğrulama.
 * Callback: fn_apply_coupon_admin RPC (service role, atomik FOR UPDATE).
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CouponKind } from "@/lib/customer-coupon";
import { logOrderEvent } from "@/lib/order-events-server";

export type CouponResolution =
  | { ok: true; discount: number; kind: CouponKind }
  | { ok: false; reason: string; minSubtotal?: number };

export async function resolveCouponForCheckout(
  supabase: SupabaseClient,
  code: string,
  subtotal: number
): Promise<CouponResolution> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty_code" };
  }

  const { data, error } = await supabase.rpc("fn_validate_coupon", {
    p_code: trimmed,
    p_subtotal: subtotal,
  });

  if (error) {
    console.error("[coupon-server] validate RPC error:", error);
    return { ok: false, reason: "rpc_error" };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, reason: "invalid_response" };
  }

  const r = data as {
    ok: boolean;
    discount?: number;
    kind?: CouponKind;
    reason?: string;
    min_subtotal?: number;
  };

  if (r.ok && r.discount !== undefined && r.kind) {
    return {
      ok: true,
      discount: Number(r.discount),
      kind: r.kind,
    };
  }

  return {
    ok: false,
    reason: r.reason ?? "unknown",
    minSubtotal: r.min_subtotal,
  };
}

export function computeCheckoutTotals(
  subtotal: number,
  shipping: number,
  coupon: CouponResolution | null
): { discount: number; effectiveShipping: number; total: number } {
  if (!coupon?.ok) {
    return {
      discount: 0,
      effectiveShipping: shipping,
      total: subtotal + shipping,
    };
  }

  if (coupon.kind === "free_ship") {
    return {
      discount: 0,
      effectiveShipping: 0,
      total: subtotal,
    };
  }

  return {
    discount: coupon.discount,
    effectiveShipping: shipping,
    total: Math.max(0, subtotal - coupon.discount + shipping),
  };
}

type AdminClient = SupabaseClient;

async function logCouponApplyFailure(
  admin: AdminClient,
  params: {
    code: string;
    orderId: string;
    chargedDiscount?: number;
    reason: string;
    rpcMessage?: string;
  }
): Promise<void> {
  await logOrderEvent(admin, {
    orderId: params.orderId,
    eventType: "coupon_apply_failed",
    actorRole: "system",
    summary: `Kupon uygulanamadı: ${params.code}`,
    detail: {
      coupon_code: params.code,
      expected_discount: params.chargedDiscount ?? null,
      order_id: params.orderId,
      error: params.reason,
      ...(params.rpcMessage ? { rpc_message: params.rpcMessage } : {}),
    },
  });

  Sentry.captureMessage("coupon_apply_failed_after_payment", {
    level: "error",
    tags: {
      orderId: params.orderId,
      couponCode: params.code,
    },
    extra: {
      reason: params.reason,
      expected_discount: params.chargedDiscount ?? null,
      rpc_message: params.rpcMessage,
    },
  });

  const { notifyAdminCriticalAlert } = await import(
    "@/lib/mail/admin-critical-alert"
  );
  void notifyAdminCriticalAlert({
    alertKey: `coupon_apply_failed:${params.orderId}`,
    subject: `🚨 Kupon uygulanamadı — sipariş ${params.orderId}`,
    title: "Kupon ödeme sonrası uygulanamadı",
    body: `Sipariş: ${params.orderId}\nKupon: ${params.code}\nBeklenen indirim: ${params.chargedDiscount ?? "—"} ₺\nSebep: ${params.reason}${params.rpcMessage ? `\nRPC: ${params.rpcMessage}` : ""}\n\nMüşteri indirimli ödemiş olabilir — manuel inceleme gerekir.`,
    targetType: "order",
    targetId: params.orderId,
    extra: { admin_link: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com"}/admin/siparisler/${params.orderId}` },
  }).catch((err) =>
    console.error("[coupon-server] admin alert failed:", err)
  );
}

/**
 * Sipariş oluşturulduktan sonra kupon kullanımını kaydet.
 * fn_apply_coupon_admin — atomik FOR UPDATE + insert (Mig 130).
 * Başarısızlıkta order_events + Sentry (ödeme akışı değişmez).
 */
export async function applyCouponAfterOrder(
  admin: AdminClient,
  params: {
    code: string;
    subtotal: number;
    userId: string;
    orderId: string;
    /** Init snapshot'tan gelen gerçek çekilen indirim (audit doğruluğu) */
    chargedDiscount?: number;
    /** PayTR merchant_oid — rezervasyon temizliği (M2) */
    paymentIntentId?: string;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const code = params.code.trim();
  if (!code) return { ok: false, reason: "empty_code" };

  const { data, error } = await admin.rpc("fn_apply_coupon_admin", {
    p_code: code,
    p_subtotal: params.subtotal,
    p_user_id: params.userId,
    p_order_id: params.orderId,
    p_charged_discount: params.chargedDiscount ?? null,
    p_payment_intent_id: params.paymentIntentId ?? null,
  });

  if (error) {
    console.error("[coupon-server] apply RPC error:", error);
    await logCouponApplyFailure(admin, {
      code,
      orderId: params.orderId,
      chargedDiscount: params.chargedDiscount,
      reason: "rpc_error",
      rpcMessage: error.message,
    });
    return { ok: false, reason: "rpc_error" };
  }

  if (!data || typeof data !== "object") {
    await logCouponApplyFailure(admin, {
      code,
      orderId: params.orderId,
      chargedDiscount: params.chargedDiscount,
      reason: "invalid_response",
    });
    return { ok: false, reason: "invalid_response" };
  }

  const r = data as { ok: boolean; reason?: string };
  if (r.ok) return { ok: true };

  const reason = r.reason ?? "unknown";
  await logCouponApplyFailure(admin, {
    code,
    orderId: params.orderId,
    chargedDiscount: params.chargedDiscount,
    reason,
  });
  return { ok: false, reason };
}
