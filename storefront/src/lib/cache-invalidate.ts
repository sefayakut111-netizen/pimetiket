/**
 * localStorage cache invalidation helper.
 *
 * Bütün lib'lerde dağılı STORAGE_KEY'lerin merkezi listesi.
 * - clearUserCaches(): Çıkışta çağrılır — kullanıcı verileri silinir
 *   (sepet, sipariş, iade, audit log, Pim hafıza, bildirim tercihleri).
 *   Device-global olanlar (locale, çerez onayı, pricing profilleri,
 *   admin ayarları) DOKUNULMAZ.
 * - bumpSchemaVersionIfNeeded(): Şema bump'ında stale cache'leri temizler.
 *   pim_app_schema_v versiyon kontrolü yapar.
 *
 * Sefa'nın TODO listesindeki "localStorage cache invalidation" maddesi.
 */

/** Bump bu değeri lib şeması bozulduğunda — tüm USER_KEYS silinir */
const APP_SCHEMA_VERSION = 1;
const VERSION_KEY = "pim_app_schema_v";

/** Kullanıcıya özel — logout / hesap değişiminde silinir */
const USER_KEYS = [
  "pim_audit_log_v1",
  "pim_customer_cart_v1",
  "pim_customer_orders_v1",
  "pim_customer_returns_v1",
  "pim_notification_prefs_v1",
  "pim:memory:v1",
  "pim_pending_coupon", // sessionStorage'da da olabilir
] as const;

/** Device-global — birden fazla kullanıcı paylaşır, logout'ta silinmez */
// const GLOBAL_KEYS = [
//   "pim_locale",
//   "pim_cookie_consent_v1",
//   "pim_pricing_profiles_v1",
//   "pim_pricing_stats_v1",
//   "pim_pricing_cart_v1",
//   "pim_coupons_v1",
//   "pim_site_settings_v1",
// ];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Logout veya hesap değişimi sonrası çağrılır.
 * Diğer modülleri bilgilendirmek için custom event dispatch eder
 * (bileşenler kendi cache'lerini refresh edebilir).
 */
export function clearUserCaches(): void {
  if (!isBrowser()) return;
  let cleared = 0;
  for (const key of USER_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleared++;
      }
      // pim_pending_coupon sessionStorage'da da olabilir
      if (
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(key) !== null
      ) {
        sessionStorage.removeItem(key);
        cleared++;
      }
    } catch {
      /* quota / disabled — sessizce geç */
    }
  }
  if (cleared > 0) {
    try {
      window.dispatchEvent(
        new CustomEvent("pim_caches_cleared", {
          detail: { count: cleared },
        })
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * App boot'ta çağrılır. Önceki kayıtlı şema versiyonu < bugünkünden ise
 * user cache'lerini temizler. İlk boot'ta hiçbir şey silinmez (sadece
 * versiyonu yazar).
 */
export function bumpSchemaVersionIfNeeded(): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(VERSION_KEY);
    const stored = raw == null ? null : parseInt(raw, 10);
    if (stored === APP_SCHEMA_VERSION) return;
    if (stored != null && !Number.isNaN(stored) && stored < APP_SCHEMA_VERSION) {
      clearUserCaches();
    }
    localStorage.setItem(VERSION_KEY, String(APP_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
}
