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
