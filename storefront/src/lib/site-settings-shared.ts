export const DEFAULT_STICKER_DELIVERY_DAYS = 3;
export const DEFAULT_ETIKET_DELIVERY_DAYS = 10;
export const DEFAULT_CONTACT_PHONE = "+90 545 699 90 63";
export const DEFAULT_CONTACT_WHATSAPP = "+90 545 699 90 63";

export interface DeliveryDaysSettings {
  sticker: number;
  etiket: number;
}

export function parseDeliveryDaysFromSettings(
  settings: Record<string, unknown>
): DeliveryDaysSettings {
  return {
    sticker: Math.max(
      1,
      Number(settings.sticker_delivery_days) || DEFAULT_STICKER_DELIVERY_DAYS
    ),
    etiket: Math.max(
      1,
      Number(settings.etiket_delivery_days) || DEFAULT_ETIKET_DELIVERY_DAYS
    ),
  };
}

export function formatDeliveryDaysLabel(
  days: number,
  locale: "tr" | "en" = "tr"
): string {
  return locale === "en" ? `${days} business days` : `${days} iş günü`;
}

export function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "tel:+905456999063";
  return digits.startsWith("90") ? `tel:+${digits}` : `tel:+90${digits}`;
}

export function phoneToWaHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "https://wa.me/905456999063";
  const normalized = digits.startsWith("90")
    ? digits
    : digits.startsWith("0")
      ? `90${digits.slice(1)}`
      : `90${digits}`;
  return `https://wa.me/${normalized}`;
}

/** Görüntü için kısa TR formatı (0545 699 90 63). */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("90")
    ? `0${digits.slice(2)}`
    : digits.startsWith("0")
      ? digits
      : `0${digits}`;
  if (local.length === 11) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 9)} ${local.slice(9)}`;
  }
  return phone.trim() || "0545 699 90 63";
}
