/** Davet / referans kodu — auth kayıt akışında paylaşılan sabitler */

export const REFERRAL_STORAGE_KEY = "pim_ref";
export const REFERRAL_COOKIE_NAME = "pim_referral_code";
export const REFERRAL_COOKIE_MAX_AGE_SEC = 600;

export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function isReferralCodePresent(raw: string | null | undefined): boolean {
  return normalizeReferralCode(raw).length >= 3;
}

export function setReferralCookie(code: string): void {
  if (typeof document === "undefined") return;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=${REFERRAL_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function persistReferralToSession(code: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeReferralCode(code);
  if (normalized) {
    window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
  } else {
    window.sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  }
}

export function readReferralFromSession(): string {
  if (typeof window === "undefined") return "";
  return normalizeReferralCode(window.sessionStorage.getItem(REFERRAL_STORAGE_KEY));
}

export function initialReferralCode(urlRef: string | null): string {
  const fromUrl = normalizeReferralCode(urlRef);
  if (fromUrl) return fromUrl;
  return readReferralFromSession();
}
