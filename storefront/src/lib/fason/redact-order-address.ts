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

/** Partner/fason uçlarında order_items.meta whitelist redaksiyonu. */
export function redactItemMetaForPartner(
  meta: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  const copyString = (k: string) => {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  };
  const copyNumber = (k: string) => {
    const v = meta[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  };
  const copyBoolean = (k: string) => {
    const v = meta[k];
    if (typeof v === "boolean") out[k] = v;
  };
  copyString("shape");
  copyString("cut");
  copyString("material");
  copyString("material_type");
  copyString("finish");
  copyBoolean("softCorners");
  copyNumber("winding");
  copyNumber("coreSize");
  copyNumber("rollLabelCount");
  copyNumber("hediyeAdet");
  copyNumber("designCount");
  return out;
}

/** Partner/fason free-text alanlarında PII şekli temizleme (passthrough — chip'leri korur). */
export function sanitizeFreeTextForPartner(
  value: string | null | undefined
): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return value
    .replace(/[\x00-\x1f]/g, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[gizli]")
    .replace(
      /(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
      "[gizli]"
    )
    .replace(/\d[\d\s-]{9,}\d/g, "[gizli]")
    .replace(/https?:\/\/\S+/gi, "[gizli]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}
