/**
 * View Mode — admin/staff kullanıcılarının "müşteri görünümü" testleri.
 *
 * Kullanım:
 *   - Sefa admin olarak login. Default: view_mode=admin (yani admin paneli açık)
 *   - Sidebar'da "Müşteri görünümüne geç" → cookie pim_view_mode=customer
 *   - Cookie set olunca middleware /admin'i ENGELLER (sanki customer'mış gibi)
 *   - Customer sayfalarında üst banner: "Müşteri görünümü · Admin'e dön"
 *   - Çıkış / "Admin'e dön" → cookie silinir
 *
 * Güvenlik: Cookie SADECE UI/UX. Asıl yetki kontrolü her zaman DB.role'den.
 * Customer rolü bu cookie'yi set etse bile DB.role='customer' olduğu için
 * admin paneli zaten açılmaz. Middleware role check her durumda doğrular.
 */
export const VIEW_MODE_COOKIE = "pim_view_mode";

export type ViewMode = "admin" | "customer";

export function parseViewMode(value: string | undefined | null): ViewMode {
  return value === "customer" ? "customer" : "admin";
}

export function isImpersonatingCustomer(
  role: string | null | undefined,
  viewMode: ViewMode
): boolean {
  return (role === "admin" || role === "staff") && viewMode === "customer";
}
