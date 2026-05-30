/**
 * Admin RBAC — modül tanımları, nav→modül eşlemesi, middleware path guard.
 */

import type { AdminAction } from "@/lib/supabase/assert-permission";

export type AdminModule =
  | "dashboard"
  | "orders"
  | "manual_order"
  | "ai_qc"
  | "proof"
  | "shipments"
  | "fason"
  | "customers"
  | "returns"
  | "reviews"
  | "designs"
  | "help_requests"
  | "products"
  | "subscribers"
  | "gallery"
  | "site_images"
  | "finans"
  | "coupons"
  | "staff"
  | "pricing"
  | "auditors"
  | "reports"
  | "audit_log"
  | "kvkk"
  | "backups"
  | "archive"
  | "settings"
  | "mail_health"
  | "blog";

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
}

export interface UserPermissionsPayload {
  legacyFullAccess: boolean;
  adminRole: string | null;
  role: string;
  canViewFinancials: boolean;
  permissions?: Record<string, ModulePermissions>;
}

export interface AdminNavItemDef {
  href: string;
  label: string;
  module: AdminModule;
  action?: AdminAction;
}

/** /admin path prefix → required module (view). Profil/2FA herkese açık. */
export const ADMIN_PATH_MODULES: Array<{ prefix: string; module: AdminModule }> =
  [
    { prefix: "/admin/finans", module: "finans" },
    { prefix: "/admin/odemeler", module: "finans" },
    { prefix: "/admin/kuponlar", module: "coupons" },
    { prefix: "/admin/calisanlar", module: "staff" },
    { prefix: "/admin/fiyatlar", module: "pricing" },
    { prefix: "/admin/fiyat-hesapla", module: "pricing" },
    { prefix: "/admin/denetciler", module: "auditors" },
    { prefix: "/admin/raporlar", module: "reports" },
    { prefix: "/admin/audit-log", module: "audit_log" },
    { prefix: "/admin/kvkk-talepleri", module: "kvkk" },
    { prefix: "/admin/yedekler", module: "backups" },
    { prefix: "/admin/arsiv", module: "archive" },
    { prefix: "/admin/ayarlar", module: "settings" },
    { prefix: "/admin/mail-health", module: "mail_health" },
    { prefix: "/admin/musteriler", module: "customers" },
    { prefix: "/admin/yorumlar", module: "reviews" },
    { prefix: "/admin/iadeler", module: "returns" },
    { prefix: "/admin/tasarimlar", module: "designs" },
    { prefix: "/admin/yardim-talepleri", module: "help_requests" },
    { prefix: "/admin/destek", module: "help_requests" },
    { prefix: "/admin/icerik", module: "products" },
    { prefix: "/admin/urunler", module: "products" },
    { prefix: "/admin/aboneler", module: "subscribers" },
    { prefix: "/admin/galeri", module: "gallery" },
    { prefix: "/admin/gorseller", module: "site_images" },
    { prefix: "/admin/blog", module: "blog" },
    { prefix: "/admin/siparisler", module: "orders" },
    { prefix: "/admin/siparis-ekle", module: "manual_order" },
    { prefix: "/admin/ai-qc", module: "ai_qc" },
    { prefix: "/admin/prova", module: "proof" },
    { prefix: "/admin/kargo", module: "shipments" },
    { prefix: "/admin/fason", module: "fason" },
  ];

export function resolveAdminPathModule(pathname: string): AdminModule | null {
  if (pathname === "/admin" || pathname === "/admin/") {
    return "dashboard";
  }
  if (
    pathname.startsWith("/admin/profil") ||
    pathname.startsWith("/admin/test-siparis-simulator")
  ) {
    return null;
  }
  const sorted = [...ADMIN_PATH_MODULES].sort(
    (a, b) => b.prefix.length - a.prefix.length
  );
  for (const { prefix, module } of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return module;
    }
  }
  return "dashboard";
}

/** Middleware ?denied= banner ve hata mesajları için */
export function getAdminModuleLabel(module: string): string {
  const item = ADMIN_NAV_ITEMS.find((i) => i.module === module);
  return item?.label ?? module;
}

export function canAccessModule(
  perms: UserPermissionsPayload | null | undefined,
  module: AdminModule,
  action: AdminAction = "view"
): boolean {
  if (!perms) return true;
  if (perms.legacyFullAccess) return true;
  const mod = perms.permissions?.[module];
  if (!mod) return false;
  return mod[action] === true;
}

/** Nav item tanımları — AdminShell ile paylaşılır */
export const ADMIN_NAV_ITEMS: AdminNavItemDef[] = [
  { href: "/admin", label: "Dashboard", module: "dashboard" },
  { href: "/admin/siparisler", label: "Siparişler", module: "orders" },
  { href: "/admin/siparis-ekle", label: "Manuel sipariş", module: "manual_order" },
  { href: "/admin/ai-qc", label: "AI QC", module: "ai_qc" },
  { href: "/admin/prova", label: "Prova", module: "proof" },
  { href: "/admin/kargo", label: "Kargo", module: "shipments" },
  { href: "/admin/fason", label: "Üretim Partnerleri", module: "fason" },
  { href: "/admin/musteriler", label: "Müşteriler", module: "customers" },
  { href: "/admin/yorumlar", label: "Yorumlar", module: "reviews" },
  { href: "/admin/iadeler", label: "İadeler", module: "returns" },
  { href: "/admin/tasarimlar", label: "Tasarımlar", module: "designs" },
  { href: "/admin/yardim-talepleri", label: "Yardım Talepleri", module: "help_requests" },
  { href: "/admin/icerik", label: "İçerik", module: "products" },
  { href: "/admin/urunler", label: "Ürünler", module: "products" },
  { href: "/admin/aboneler", label: "Aboneler", module: "subscribers" },
  { href: "/admin/galeri", label: "Galeri", module: "gallery" },
  { href: "/admin/gorseller", label: "Site Görselleri", module: "site_images" },
  { href: "/admin/blog", label: "Blog", module: "blog" },
  { href: "/admin/finans", label: "Finans", module: "finans" },
  { href: "/admin/kuponlar", label: "Kuponlar", module: "coupons" },
  { href: "/admin/calisanlar", label: "Çalışanlar", module: "staff" },
  { href: "/admin/fiyat-hesapla", label: "Fiyat hesapla", module: "pricing" },
  { href: "/admin/denetciler", label: "Denetçiler", module: "auditors" },
  { href: "/admin/raporlar", label: "Raporlar", module: "reports" },
  { href: "/admin/audit-log", label: "Denetim kaydı", module: "audit_log" },
  { href: "/admin/kvkk-talepleri", label: "KVKK talepleri", module: "kvkk" },
  { href: "/admin/yedekler", label: "Yedekler", module: "backups" },
  { href: "/admin/arsiv", label: "Arşiv (R2)", module: "archive" },
  { href: "/admin/fiyatlar", label: "Fiyat yönetimi", module: "pricing" },
  { href: "/admin/ayarlar", label: "Ayarlar", module: "settings" },
  { href: "/admin/mail-health", label: "Mail sağlığı", module: "mail_health" },
];
