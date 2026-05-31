/**
 * Server-side kupon doğrulama ve sipariş sonrası uygulama.
 *
 * UI preview: fn_validate_coupon (authenticated).
 * Ödeme init: sunucu tarafında total doğrulama.
 * Callback: coupon_uses kaydı (service role — fn_apply_coupon auth.uid gerektirir).
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
 * fn_apply_coupon ile aynı kurallar; service role ile çalışır.
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
  const code = params.code.trim().toUpperCase();
  if (!code) return { ok: false, reason: "empty_code" };

  const { data: coupon, error: fetchErr } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchErr || !coupon) {
    console.error("[coupon-server] apply fetch error:", fetchErr);
    return { ok: false, reason: "invalid_or_expired" };
  }

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { ok: false, reason: "invalid_or_expired" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  const subtotal = params.subtotal;
  if (subtotal < Number(coupon.min_subtotal ?? 0)) {
    return { ok: false, reason: "min_subtotal" };
  }

  if (coupon.total_uses_limit != null) {
    const { count } = await admin
      .from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if ((count ?? 0) >= coupon.total_uses_limit) {
      return { ok: false, reason: "total_limit_reached" };
    }
  }

  if (coupon.per_user_limit != null) {
    const { count } = await admin
      .from("coupon_uses")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("user_id", params.userId);
    if ((count ?? 0) >= coupon.per_user_limit) {
      return { ok: false, reason: "user_limit_reached" };
    }
  }

  let discount = 0;
  const kind = coupon.kind as CouponKind;

  if (params.chargedDiscount !== undefined) {
    discount = kind === "free_ship" ? 0 : params.chargedDiscount;
  } else {
    const value = Number(coupon.value);

    if (kind === "percent") {
      discount = Math.round(subtotal * (value / 100) * 100) / 100;
      if (
        coupon.max_discount != null &&
        discount > Number(coupon.max_discount)
      ) {
        discount = Number(coupon.max_discount);
      }
    } else if (kind === "fixed") {
      discount = Math.min(value, subtotal);
    }
  }

  const { error: insertErr } = await admin.from("coupon_uses").insert({
    coupon_id: coupon.id,
    user_id: params.userId,
    order_id: params.orderId,
    discount_amount: discount,
  });

  if (insertErr) {
    console.error("[coupon-server] apply insert error:", insertErr);
    return { ok: false, reason: "insert_failed" };
  }

  return { ok: true };
}
