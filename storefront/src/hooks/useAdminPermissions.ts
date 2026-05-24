"use client";

import { useEffect, useState } from "react";
import {
  canAccessModule,
  type AdminModule,
  type UserPermissionsPayload,
} from "@/lib/admin-rbac";

const DEFAULT_PERMS: UserPermissionsPayload = {
  legacyFullAccess: true,
  adminRole: null,
  role: "admin",
  canViewFinancials: true,
};

export function useAdminPermissions() {
  const [permissions, setPermissions] =
    useState<UserPermissionsPayload>(DEFAULT_PERMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/permissions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : DEFAULT_PERMS))
      .then((data: UserPermissionsPayload) => {
        if (!cancelled) setPermissions(data);
      })
      .catch(() => {
        if (!cancelled) setPermissions(DEFAULT_PERMS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function canView(module: AdminModule): boolean {
    return canAccessModule(permissions, module, "view");
  }

  return {
    permissions,
    loading,
    canView,
    canViewFinancials: permissions.canViewFinancials,
    legacyFullAccess: permissions.legacyFullAccess,
  };
}
