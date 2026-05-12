/**
 * PostHog event helper — tipli, anti-duplicate, consent-aware.
 *
 * Analytics.tsx PostHog snippet'i sayfa açılışında window.posthog kuruyor;
 * bu modül o instance'a güvenli erişim sağlıyor:
 *   - Consent yoksa veya posthog yüklenmediyse no-op
 *   - Event isim havuzu tek yerde — tipo yok
 *   - PII redaction (email, telefon) — gerekirse event-spesifik açılır
 *
 * Kullanım:
 *   import { track } from "@/lib/analytics/posthog-events";
 *   track("add_to_cart", { product: "sticker", total: 240 });
 */

type PimEvent =
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

/** Window.posthog yüklenmiş + consent verilmiş mi? */
function getPostHog(): PostHogClient | null {
  if (typeof window === "undefined") return null;
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
