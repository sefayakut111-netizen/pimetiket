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

    // RPC ile yetki kontrolü (server-side, SECURITY DEFINER)
    const { data: hasPerm, error: rpcErr } = await supabase.rpc(
      "fn_has_permission",
      { p_module: module, p_action: action }
    );

    if (rpcErr || hasPerm !== true) {
      return null;
    }

    // Profile bilgisini de al (caller için)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, admin_role")
      .eq("id", user.id)
      .single();

    const p = profile as {
      role?: string;
      admin_role?: string | null;
    } | null;

    return {
      user: { id: user.id, email: user.email },
      role: (p?.role === "staff" ? "staff" : "admin") as "admin" | "staff",
      adminRole: p?.admin_role ?? null,
    };
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
