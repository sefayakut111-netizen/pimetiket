/**
 * Çerez izni — KVKK + GDPR uyumlu opt-in tabanlı.
 *
 * 4 kategori:
 *   - necessary:   her zaman aktif (oturum, sepet) — opt-out yok
 *   - functional:  tercih kaydı (dil, tema)
 *   - analytics:   GA4 + PostHog
 *   - marketing:   reklam, retargeting (gelecek)
 *
 * State localStorage'da persist olur, 12 ay sonra "Yeniden onay iste"
 * (KVKK m.5 — açık rıza yenilenmesi).
 */

export type ConsentCategory =
  | "necessary"
  | "functional"
  | "analytics"
  | "marketing";

export interface ConsentState {
  /** İzin verilmiş kategoriler */
  categories: Record<ConsentCategory, boolean>;
  /** Onay/red tarihi (ISO) */
  decidedAt: string;
  /** Versiyon — politika değişirse yeniden sor */
  version: number;
}

/** Mevcut çerez politikası versiyonu. Değişirse banner tekrar gösterilir. */
export const CONSENT_VERSION = 1;

/** Onay süresi (ay) — bu süre dolduktan sonra yeniden sorulur */
const RECONSENT_AFTER_MONTHS = 12;

const STORAGE_KEY = "pim_cookie_consent_v1";

const DEFAULT_STATE: ConsentState = {
  categories: {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  },
  decidedAt: "",
  version: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Kayıtlı consent'i oku. Yoksa null döner (banner gösterilir). */
export function readConsent(): ConsentState | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // Versiyon eski → yeniden sor
    if (parsed.version !== CONSENT_VERSION) return null;
    // 12 aydan eski → yeniden sor
    if (parsed.decidedAt) {
      const decided = new Date(parsed.decidedAt);
      const now = new Date();
      const monthsDiff =
        (now.getFullYear() - decided.getFullYear()) * 12 +
        (now.getMonth() - decided.getMonth());
      if (monthsDiff >= RECONSENT_AFTER_MONTHS) return null;
    }
    // necessary her zaman true (zorunlu)
    parsed.categories.necessary = true;
    return parsed;
  } catch {
    return null;
  }
}

/** Consent'i yaz + custom event dispatch (analytics init için) */
export function writeConsent(
  categories: Partial<Record<ConsentCategory, boolean>>
): ConsentState {
  const state: ConsentState = {
    categories: {
      necessary: true, // her zaman
      functional: categories.functional ?? false,
      analytics: categories.analytics ?? false,
      marketing: categories.marketing ?? false,
    },
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  if (isBrowser()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(
        new CustomEvent("pim_consent_changed", { detail: state })
      );
    } catch {
      // localStorage full / disabled
    }
  }
  return state;
}

/** Tüm kategorileri kabul et (kabul butonu) */
export function acceptAll(): ConsentState {
  return writeConsent({
    functional: true,
    analytics: true,
    marketing: true,
  });
}

/** Sadece zorunlu (red butonu) */
export function rejectNonEssential(): ConsentState {
  return writeConsent({
    functional: false,
    analytics: false,
    marketing: false,
  });
}

/** Belirli bir kategoriye izin var mı? Sync, cache'siz okuma */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const state = readConsent();
  return Boolean(state?.categories[category]);
}
