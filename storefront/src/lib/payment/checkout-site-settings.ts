/**
 * Sunucu tarafı site ayarları — ödeme doğrulaması için.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface CheckoutSiteSettings {
  shippingFeeTry: number;
  freeShippingThreshold: number;
  minOrderTotalTry: number;
  maxOrderTotalTry: number;
}

const DEFAULTS: CheckoutSiteSettings = {
  shippingFeeTry: 49,
  freeShippingThreshold: 500,
  minOrderTotalTry: 250,
  maxOrderTotalTry: 250000,
};

export async function fetchCheckoutSiteSettings(): Promise<CheckoutSiteSettings> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("site_settings")
      .select(
        "shipping_fee_try, free_shipping_threshold, min_order_total_try, max_order_total_try"
      )
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return DEFAULTS;

    return {
      shippingFeeTry: Number(data.shipping_fee_try ?? DEFAULTS.shippingFeeTry),
      freeShippingThreshold: Number(
        data.free_shipping_threshold ?? DEFAULTS.freeShippingThreshold
      ),
      minOrderTotalTry: Number(
        data.min_order_total_try ?? DEFAULTS.minOrderTotalTry
      ),
      maxOrderTotalTry: Number(
        data.max_order_total_try ?? DEFAULTS.maxOrderTotalTry
      ),
    };
  } catch {
    return DEFAULTS;
  }
}

export function expectedShippingFee(
  subtotal: number,
  settings: CheckoutSiteSettings
): number {
  if (subtotal <= 0) return 0;
  return subtotal >= settings.freeShippingThreshold
    ? 0
    : settings.shippingFeeTry;
}
