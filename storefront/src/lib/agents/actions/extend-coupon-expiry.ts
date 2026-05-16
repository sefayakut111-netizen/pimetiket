/**
 * Aksiyon: extend_coupon_expiry — Kuponun süresini uzat.
 *
 * Payload:
 *   { couponId: string, extendDays: number, reason?: string }
 *
 * Sefa kuralı: Bitmek üzere olan + iyi performans gösteren kuponlar
 * için "uzat onayı" — Finance Auditor önerir, Sefa onaylar.
 *
 * Yeni expires_at = mevcut expires_at + extendDays
 */

import type { ActionHandler } from "../_shared/proposal";

interface ExtendCouponPayload {
  couponId: string;
  extendDays: number;
  reason?: string;
}

const extendCouponExpiry: ActionHandler = async ({ admin, payload }) => {
  const { couponId, extendDays, reason = "auditor_decision" } =
    payload as unknown as ExtendCouponPayload;

  if (!couponId || typeof couponId !== "string") {
    return {
      result: "failed",
      error: "Invalid payload: 'couponId' required",
    };
  }

  if (!extendDays || extendDays < 1 || extendDays > 365) {
    return {
      result: "failed",
      error: "Invalid payload: 'extendDays' must be 1-365",
    };
  }

  // Mevcut expires_at'i al
  const { data: coupon, error: fetchErr } = await admin
    .from("coupons")
    .select("id, code, expires_at, is_active")
    .eq("id", couponId)
    .maybeSingle();

  if (fetchErr || !coupon) {
    return {
      result: "failed",
      error: `Coupon not found: ${couponId}`,
    };
  }

  const couponRow = coupon as {
    id: string;
    code: string;
    expires_at: string | null;
    is_active: boolean;
  };

  // Yeni expires_at hesapla
  const baseDate = couponRow.expires_at
    ? new Date(couponRow.expires_at)
    : new Date();
  // Eğer süresi geçmişse, şimdiden başlat
  const startFrom = baseDate < new Date() ? new Date() : baseDate;
  const newExpiresAt = new Date(startFrom);
  newExpiresAt.setDate(newExpiresAt.getDate() + extendDays);

  const { error: updateErr } = await admin
    .from("coupons")
    .update({
      expires_at: newExpiresAt.toISOString(),
      is_active: true, // expired ise tekrar aktif
    } as never)
    .eq("id", couponId);

  if (updateErr) {
    return {
      result: "failed",
      error: `DB update failed: ${updateErr.message}`,
    };
  }

  return {
    result: "success",
    affectedRows: 1,
    affectedIds: { couponId, code: couponRow.code },
    externalCall: {
      previousExpiresAt: couponRow.expires_at,
      newExpiresAt: newExpiresAt.toISOString(),
      extendDays,
      reason,
    },
  };
};

export default extendCouponExpiry;
