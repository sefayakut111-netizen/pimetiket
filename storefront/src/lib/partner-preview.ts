/**
 * Partner preview — admin/staff kullanıcıların partner panelini analiz modunda görmesi.
 *
 * Cookie tabanlı; admin oturumu korunur (magic-link impersonation yerine).
 */

export const PARTNER_PREVIEW_ID_COOKIE = "pim_partner_preview_id";

export function parsePartnerPreviewId(
  value: string | undefined | null
): string | null {
  if (!value || value.length < 8) return null;
  return value;
}

export function isPartnerPreviewMode(viewMode: string): boolean {
  return viewMode === "partner";
}
