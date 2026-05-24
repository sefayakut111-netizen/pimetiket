/**
 * View Mode — admin/staff kullanıcılarının "müşteri görünümü" ve "partner analiz" testleri.
 *
 * Modlar:
 *   - admin (default) — tam admin paneli
 *   - customer — müşteri storefront (/panelim)
 *   - partner — ortak partner arayüz denetimi (/partner), admin oturumu korunur
 *
 * Güvenlik: Cookie SADECE UI routing. Asıl yetki kontrolü DB.role + fn_has_permission.
 */

export const VIEW_MODE_COOKIE = "pim_view_mode";

export type ViewMode = "admin" | "customer" | "partner";

export function parseViewMode(value: string | undefined | null): ViewMode {
  if (value === "customer") return "customer";
  if (value === "partner") return "partner";
  return "admin";
}

export function isImpersonatingCustomer(
  role: string | null | undefined,
  viewMode: ViewMode
): boolean {
  return (role === "admin" || role === "staff") && viewMode === "customer";
}

export function isImpersonatingPartner(
  role: string | null | undefined,
  viewMode: ViewMode
): boolean {
  return (role === "admin" || role === "staff") && viewMode === "partner";
}
