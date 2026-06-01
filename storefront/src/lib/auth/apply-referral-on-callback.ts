/**
 * OAuth / email callback sonrası davet kodunu uygula (Google kayıt fallback).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFERRAL_COOKIE_NAME,
  normalizeReferralCode,
} from "@/lib/auth/referral-code";

export async function applyReferralCodeIfNeeded(
  admin: SupabaseClient,
  userId: string,
  referralCode: string | null | undefined
): Promise<void> {
  const code = normalizeReferralCode(referralCode);
  if (!code) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.referred_by_user_id) return;

  await admin.rpc("fn_apply_referral_code", {
    p_new_user_id: userId,
    p_referral_code: code,
  });
}

export function readReferralCodeFromRequest(
  cookieValue: string | undefined,
  queryRef: string | null
): string | null {
  const fromCookie = normalizeReferralCode(
    cookieValue ? decodeURIComponent(cookieValue) : ""
  );
  if (fromCookie) return fromCookie;
  const fromQuery = normalizeReferralCode(queryRef);
  return fromQuery || null;
}

export function clearReferralCookie(response: {
  cookies: {
    set: (
      name: string,
      value: string,
      options?: { path?: string; maxAge?: number }
    ) => void;
  };
}): void {
  response.cookies.set(REFERRAL_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}
