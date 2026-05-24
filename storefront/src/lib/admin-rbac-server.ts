/**
 * Server-side permission payload builder (admin/staff UI).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import type { ModulePermissions, UserPermissionsPayload } from "@/lib/admin-rbac";

export async function buildUserPermissions(
  userId: string
): Promise<UserPermissionsPayload | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, admin_role")
    .eq("id", userId)
    .maybeSingle();

  const p = profile as {
    role?: string;
    admin_role?: string | null;
  } | null;

  if (!p || (p.role !== "admin" && p.role !== "staff")) {
    return null;
  }

  if (!p.admin_role) {
    return {
      legacyFullAccess: true,
      adminRole: null,
      role: p.role,
      canViewFinancials: true,
    };
  }

  if (p.admin_role === "super_admin") {
    return {
      legacyFullAccess: true,
      adminRole: p.admin_role,
      role: p.role,
      canViewFinancials: true,
    };
  }

  const { data: rows } = await admin
    .from("admin_role_permissions")
    .select("module, can_view, can_create, can_update, can_delete, can_approve")
    .eq("role", p.admin_role as Enums<"admin_role_v2">);

  const permissions: Record<string, ModulePermissions> = {};
  for (const row of (rows ?? []) as Array<{
    module: string;
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_approve: boolean;
  }>) {
    permissions[row.module] = {
      view: row.can_view,
      create: row.can_create,
      update: row.can_update,
      delete: row.can_delete,
      approve: row.can_approve,
    };
  }

  return {
    legacyFullAccess: false,
    adminRole: p.admin_role,
    role: p.role,
    canViewFinancials: permissions.finans?.view === true,
    permissions,
  };
}
