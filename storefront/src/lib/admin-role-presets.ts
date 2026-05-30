/**
 * Admin RBAC — 3 rol preset (UI sadeleştirme, Faz 4).
 * Backend admin_role_permissions tablosu korunur; preset → admin_role eşlemesi.
 */

import type { AdminModule } from "@/lib/admin-rbac";

export type RolePresetId = "admin" | "operator" | "finance";

export type BackendAdminRole =
  | "super_admin"
  | "operations"
  | "finance"
  | "customer_service"
  | "production"
  | "content_editor";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve";

export interface PermissionCell {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
}

export interface RolePreset {
  id: RolePresetId;
  label: string;
  description: string;
  adminRole: BackendAdminRole;
  permissions: Record<AdminModule, PermissionCell>;
}

export const PERMISSION_ACTIONS: ReadonlyArray<{
  key: PermissionAction;
  label: string;
  short: string;
}> = [
  { key: "view", label: "Görüntüle", short: "G" },
  { key: "create", label: "Oluştur", short: "O" },
  { key: "update", label: "Güncelle", short: "D" },
  { key: "delete", label: "Sil", short: "S" },
  { key: "approve", label: "Onayla", short: "A" },
];

export const ADMIN_MODULE_ROWS: ReadonlyArray<{
  id: AdminModule;
  label: string;
}> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "orders", label: "Siparişler" },
  { id: "manual_order", label: "Manuel sipariş" },
  { id: "ai_qc", label: "AI QC" },
  { id: "proof", label: "Prova" },
  { id: "shipments", label: "Kargo" },
  { id: "fason", label: "Fason / üretim partneri" },
  { id: "customers", label: "Müşteriler" },
  { id: "returns", label: "İadeler" },
  { id: "reviews", label: "Yorumlar" },
  { id: "designs", label: "Tasarımlar" },
  { id: "help_requests", label: "Destek / prova yardımı" },
  { id: "products", label: "Ürünler" },
  { id: "subscribers", label: "Aboneler" },
  { id: "gallery", label: "Galeri" },
  { id: "site_images", label: "Site görselleri" },
  { id: "blog", label: "Blog" },
  { id: "finans", label: "Finans & ödemeler" },
  { id: "coupons", label: "Kuponlar" },
  { id: "pricing", label: "Fiyat yönetimi" },
  { id: "reports", label: "Raporlar" },
  { id: "staff", label: "Çalışanlar" },
  { id: "auditors", label: "Denetçiler" },
  { id: "audit_log", label: "Denetim kaydı" },
  { id: "kvkk", label: "KVKK" },
  { id: "backups", label: "Yedekler" },
  { id: "archive", label: "Arşiv" },
  { id: "settings", label: "Ayarlar" },
  { id: "mail_health", label: "Mail sağlığı" },
];

const ALL_MODULES = ADMIN_MODULE_ROWS.map((m) => m.id);

function cell(
  view = false,
  create = false,
  update = false,
  del = false,
  approve = false
): PermissionCell {
  return { view, create, update, delete: del, approve };
}

const full = () => cell(true, true, true, true, true);
const viewOnly = () => cell(true);
const ops = () => cell(true, true, true, false, true);

function emptyMatrix(): Record<AdminModule, PermissionCell> {
  return Object.fromEntries(
    ALL_MODULES.map((m) => [m, cell()])
  ) as Record<AdminModule, PermissionCell>;
}

function withModules(
  base: Record<AdminModule, PermissionCell>,
  entries: Partial<Record<AdminModule, PermissionCell>>
): Record<AdminModule, PermissionCell> {
  return { ...base, ...entries };
}

function buildAdminPreset(): RolePreset {
  const permissions = emptyMatrix();
  for (const m of ALL_MODULES) {
    permissions[m] = full();
  }
  return {
    id: "admin",
    label: "Admin",
    description: "Tam yetki — tüm modüller ve aksiyonlar (super_admin).",
    adminRole: "super_admin",
    permissions,
  };
}

function buildOperatorPreset(): RolePreset {
  const base = emptyMatrix();
  return {
    id: "operator",
    label: "Operatör",
    description:
      "Operasyon hattı: sipariş, AI QC, prova, kargo, fason, tasarım ve destek. Finans, fiyat ve çalışan yönetimi yok.",
    adminRole: "operations",
    permissions: withModules(base, {
      dashboard: viewOnly(),
      orders: ops(),
      manual_order: cell(true, true, false, false, false),
      ai_qc: ops(),
      proof: ops(),
      shipments: ops(),
      fason: ops(),
      customers: viewOnly(),
      returns: cell(true, true, true, false, true),
      designs: cell(true, false, true, false, false),
      help_requests: ops(),
      reports: viewOnly(),
      archive: viewOnly(),
      mail_health: viewOnly(),
      audit_log: viewOnly(),
      settings: viewOnly(),
    }),
  };
}

function buildFinancePreset(): RolePreset {
  const base = emptyMatrix();
  const opView = viewOnly();
  return {
    id: "finance",
    label: "Finans",
    description:
      "Finans, kupon, fiyat ve raporlar. Operasyon modülleri yalnızca görüntüleme.",
    adminRole: "finance",
    permissions: withModules(base, {
      dashboard: viewOnly(),
      finans: ops(),
      coupons: cell(true, true, true, true, false),
      pricing: cell(true, true, true, false, false),
      reports: viewOnly(),
      orders: opView,
      manual_order: opView,
      ai_qc: opView,
      proof: opView,
      shipments: opView,
      fason: opView,
      customers: opView,
      returns: opView,
      reviews: opView,
      designs: opView,
      help_requests: opView,
      products: opView,
      audit_log: viewOnly(),
    }),
  };
}

export const ROLE_PRESETS: Record<RolePresetId, RolePreset> = {
  admin: buildAdminPreset(),
  operator: buildOperatorPreset(),
  finance: buildFinancePreset(),
};

export const ROLE_PRESET_LIST: RolePreset[] = [
  ROLE_PRESETS.admin,
  ROLE_PRESETS.operator,
  ROLE_PRESETS.finance,
];

export function presetFromAdminRole(
  adminRole: string | null
): RolePresetId | null {
  if (!adminRole) return null;
  if (adminRole === "super_admin") return "admin";
  if (adminRole === "operations") return "operator";
  if (adminRole === "finance") return "finance";
  return null;
}

export function presetById(id: RolePresetId): RolePreset {
  return ROLE_PRESETS[id];
}

export function countGrantedPermissions(
  permissions: Record<AdminModule, PermissionCell>
): number {
  let n = 0;
  for (const mod of ALL_MODULES) {
    const c = permissions[mod];
    for (const a of PERMISSION_ACTIONS) {
      if (c[a.key]) n++;
    }
  }
  return n;
}

export const MATRIX_SLOT_COUNT =
  ADMIN_MODULE_ROWS.length * PERMISSION_ACTIONS.length;
