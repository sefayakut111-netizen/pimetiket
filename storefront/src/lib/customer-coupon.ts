/**
 * Customer-side kupon doğrulama.
 *
 * fn_validate_coupon RPC çağrısı (anon + authenticated).
 * UI'da "Kuponu kontrol et" butonu için kullanılır — tutar+oran preview
 * göstertir, INSERT yapmaz. Asıl uygulama /api/payment/init içinde
 * fn_apply_coupon ile race-safe olur.
 */

import { createClient } from "./supabase/client";

export type CouponKind = "percent" | "fixed" | "free_ship";

export interface CouponValidateOk {
  ok: true;
  discount: number;
  kind: CouponKind;
}

export interface CouponValidateFail {
  ok: false;
  reason:
    | "invalid_or_expired"
    | "min_subtotal"
    | "user_limit_reached"
    | "total_limit_reached"
    | string;
  minSubtotal?: number;
}

export type CouponValidateResult = CouponValidateOk | CouponValidateFail;

export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<CouponValidateResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_validate_coupon", {
    p_code: code.trim(),
    p_subtotal: subtotal,
  });

  if (error) {
    console.error("[coupon] validate RPC error:", error);
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
