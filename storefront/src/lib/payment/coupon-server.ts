/**
 * Server-side kupon doğrulama ve sipariş sonrası uygulama.
 *
 * UI preview: fn_validate_coupon (authenticated).
 * Ödeme init: sunucu tarafında total doğrulama.
 * Callback: fn_apply_coupon_admin RPC (service role, atomik FOR UPDATE).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CouponKind } from "@/lib/customer-coupon";

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

/**
 * Sipariş oluşturulduktan sonra kupon kullanımını kaydet.
 * fn_apply_coupon_admin — atomik FOR UPDATE + insert (Mig 130).
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
  });

  if (error) {
    console.error("[coupon-server] apply RPC error:", error);
    return { ok: false, reason: "rpc_error" };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, reason: "invalid_response" };
  }

  const r = data as { ok: boolean; reason?: string };
  if (r.ok) return { ok: true };

  return { ok: false, reason: r.reason ?? "unknown" };
}
