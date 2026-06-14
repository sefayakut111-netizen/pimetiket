/**
 * Açılış kampanyası — tek kaynak (denetim P1-2).
 * Hem AnnouncementBar (duyuru) hem checkout kupon ön-doldurma buradan beslenir;
 * eskiden ikisi farklı koddu (bar: HAZIRAN20, checkout placeholder: HOSGELDIN10).
 */
export const CAMPAIGN_CODE = "HAZIRAN20";
export const CAMPAIGN_DISCOUNT_PCT = 20;

/** 30 Haziran 2026 23:59 TR sonrası kampanya kapanır. */
export const CAMPAIGN_VALID_UNTIL = new Date("2026-06-30T23:59:59+03:00");

/** Kampanya hâlâ geçerli mi? (Saf tarih kontrolü — SSR/client uyumlu.) */
export function isCampaignActive(): boolean {
  return new Date() < CAMPAIGN_VALID_UNTIL;
}
