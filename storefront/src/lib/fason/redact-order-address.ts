/** KVKK — partner/fason token yanıtında sadece il/ilçe (tam adres yok). */
export function redactOrderAddressForPartner(
  address: Record<string, unknown> | null | undefined
): { city: string | null; district: string | null } {
  const addr = address ?? {};
  const city =
    typeof addr.city === "string" && addr.city.trim().length > 0
      ? addr.city.trim()
      : null;
  const district =
    typeof addr.district === "string" && addr.district.trim().length > 0
      ? addr.district.trim()
      : null;
  return { city, district };
}

/** Model B — GET /api/partner/orders/[id]/shipping-info için kontrollü tam adres. */
export type PartnerFullShippingAddress = {
  recipientName: string;
  phone: string;
  addressLine: string;
  district: string | null;
  city: string | null;
  postalCode: string | null;
};

export function fullOrderAddressForPartnerShipping(
  address: Record<string, unknown> | null | undefined
): PartnerFullShippingAddress | null {
  const addr = address ?? {};
  const recipientName =
    typeof addr.name === "string" ? addr.name.trim() : "";
  const phone = typeof addr.phone === "string" ? addr.phone.trim() : "";
  const addressLine = typeof addr.addr === "string" ? addr.addr.trim() : "";
  if (!recipientName || !phone || !addressLine) return null;

  const city =
    typeof addr.city === "string" && addr.city.trim().length > 0
      ? addr.city.trim()
      : null;
  const district =
    typeof addr.district === "string" && addr.district.trim().length > 0
      ? addr.district.trim()
      : null;
  const postalCode =
    typeof addr.postal === "string" && addr.postal.trim().length > 0
      ? addr.postal.trim()
      : typeof addr.zip === "string" && addr.zip.trim().length > 0
        ? addr.zip.trim()
        : null;

  return {
    recipientName,
    phone,
    addressLine,
    district,
    city,
    postalCode,
  };
}
