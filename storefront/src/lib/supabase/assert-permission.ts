/**
 * assertPermission — Granular RBAC guard for API routes.
 *
 * Sefa 18 May v68 (Migration 054):
 * Mevcut assertAdmin() guard'ı binary kontrol yapıyor (admin/staff mi?).
 * Bu yeni helper modül×eylem bazlı kontrol yapar:
 *
 *   const auth = await assertPermission("orders", "update");
 *   if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *
 * Migration 054 ile gelen fn_has_permission() RPC'sini wrap eder.
 * Geriye uyumlu: profiles.admin_role NULL ise eski profiles.role
 * (admin/staff) kontrolüne düşer (super_admin gibi davranır).
 */

import { createClient as createServerClient } from "./server";

export type AdminAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve";

export interface PermissionGuardResult {
  user: { id: string; email?: string };
  /** Geriye uyumluluk için her zaman set */
  role: "admin" | "staff";
  /** Yeni granular rol (NULL = legacy admin) */
  adminRole: string | null;
}

/**
 * Modül × eylem yetkisi kontrol et. Yetki yoksa null döner.
 *
 * @param module - 'orders' | 'customers' | 'returns' | 'finans' | vb.
 * @param action - 'view' | 'create' | 'update' | 'delete' | 'approve'
 */
export async function assertPermission(
  module: string,
  action: AdminAction
): Promise<PermissionGuardResult | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, admin_role")
      .eq("id", user.id)
      .single();

    const p = profile as {
      role?: string;
      admin_role?: string | null;
    } | null;

    if (!p || (p.role !== "admin" && p.role !== "staff")) {
      return null;
    }

    const guardResult: PermissionGuardResult = {
      user: { id: user.id, email: user.email },
      role: (p.role === "staff" ? "staff" : "admin") as "admin" | "staff",
      adminRole: p.admin_role ?? null,
    };

    // fn_has_permission ile uyumlu: super_admin → tam yetki
    if (p.admin_role === "super_admin") {
      return guardResult;
    }
    // Legacy admin (admin_role NULL) genelde tam yetki — AMA 'staff' modülünde DEĞİL
    // (self/peer super_admin atamasını engelle). '*' (assertAdminCompat) ve 'settings'
    // (Mig 055/056 super_admin'e meşru) REDDEDİLMEZ — yalnız 'staff'.
    if (!p.admin_role) {
      if (module === "staff") {
        return null;
      }
      return guardResult;
    }

    const { data: hasPerm, error: rpcErr } = await supabase.rpc(
      "fn_has_permission",
      { p_module: module, p_action: action }
    );

    if (rpcErr || hasPerm !== true) {
      return null;
    }

    return guardResult;
  } catch (err) {
    console.error("[assertPermission] error:", err);
    return null;
  }
}

/**
 * Mevcut assertAdmin() ile geriye uyumlu wrapper.
 * Eski endpoint'ler bunu kullanmaya devam edebilir.
 */
export async function assertAdminCompat(): Promise<PermissionGuardResult | null> {
  return assertPermission("*", "view");
}
