/**
 * PostHog event helper — tipli, anti-duplicate, consent-aware.
 */

import { hasConsent } from "@/lib/cookie-consent";

export type PimEvent =
  | "product_viewed"
  | "configurator_started"
  | "configurator_step"
  | "design_uploaded"
  | "cart_viewed"
  | "checkout_started"
  | "material_selected"
  | "size_selected"
  | "tier_selected"
  | "pim_chat_opened"
  | "pim_chat_message_sent"
  | "order_cancelled"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "checkout_address_filled"
  | "purchase"
  | "payment_failed"
  | "design_upload_started"
  | "design_upload_completed"
  | "design_upload_failed"
  | "proof_approved"
  | "proof_rejected"
  | "ai_chat_message_sent"
  | "review_submitted"
  | "coupon_applied"
  | "auth_signup_completed"
  | "auth_login_completed"
  | "admin_status_changed"
  | "admin_bulk_status_changed"
  | "admin_manual_order_created"
  | "admin_refund_issued";

/**
 * window.posthog type — burada single source of truth.
 * Feature-flags.ts ve diğer modüller bu type'ı extend ediyor.
 */
export interface PostHogClient {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
  opt_out_capturing?: () => void;
  isFeatureEnabled?: (key: string) => boolean | undefined;
  getFeatureFlag?: (key: string) => string | boolean | undefined;
  onFeatureFlags?: (cb: () => void) => void;
  __SV?: number;
}

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

/** Window.posthog yüklenmiş + analytics consent verilmiş mi? */
function getPostHog(): PostHogClient | null {
  if (typeof window === "undefined") return null;
  if (!hasConsent("analytics")) return null;
  const ph = window.posthog;
  if (!ph || typeof ph.capture !== "function") return null;
  return ph;
}

/**
 * Event'i yakala — PostHog yüklenmediyse sessizce geç.
 */
export function track(event: PimEvent, props: Record<string, unknown> = {}): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture(event, props);
  } catch (e) {
    // posthog stub henüz tam yüklenmedi — sessiz geç
    console.warn("[posthog] track skip:", event, e);
  }
}

/**
 * Kullanıcıyı identify et (login sonrası).
 *
 * PII kuralı: email/telefon **gönderilmez** — sadece user.id ve role.
 * GA4 gibi bir ortamda PII serbestse `email` opsiyonel verilebilir.
 */
export function identify(
  userId: string,
  props?: { role?: string; createdAt?: string }
): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.identify(userId, props ?? {});
  } catch (e) {
    console.warn("[posthog] identify skip:", e);
  }
}

/**
 * Çıkış / kullanıcı değişikliği — anonim profile geç.
 */
export function reset(): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.reset();
  } catch {
    /* silent */
  }
}
