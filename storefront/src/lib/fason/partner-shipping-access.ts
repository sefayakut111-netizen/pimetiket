/** Model B — partner tam teslimat adresi yalnızca kargolama aşamasında */
export const PARTNER_SHIPPING_ADDRESS_STATUSES = [
  "ready",
  "in_production",
] as const;

export type PartnerShippingAddressStatus =
  (typeof PARTNER_SHIPPING_ADDRESS_STATUSES)[number];

export function canPartnerViewFullShippingAddress(
  assignmentStatus: string
): assignmentStatus is PartnerShippingAddressStatus {
  return (PARTNER_SHIPPING_ADDRESS_STATUSES as readonly string[]).includes(
    assignmentStatus
  );
}

export function partnerShippingAddressDeniedMessage(
  assignmentStatus: string
): string {
  return `Teslimat adresi yalnızca "Üretimde" veya "Kargoya hazır" aşamasında görüntülenebilir (mevcut durum: ${assignmentStatus}).`;
}
