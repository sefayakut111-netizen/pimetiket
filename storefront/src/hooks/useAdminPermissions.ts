"use client";

import { useEffect, useState } from "react";
import {
  canAccessModule,
  type AdminModule,
  type UserPermissionsPayload,
} from "@/lib/admin-rbac";

const FAIL_CLOSED_PERMS: UserPermissionsPayload = {
  legacyFullAccess: false,
  adminRole: null,
  role: "staff",
  canViewFinancials: false,
};

export function useAdminPermissions() {
  const [permissions, setPermissions] =
    useState<UserPermissionsPayload>(FAIL_CLOSED_PERMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/permissions", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return FAIL_CLOSED_PERMS;
        return (await r.json()) as UserPermissionsPayload;
      })
      .then((data: UserPermissionsPayload) => {
        if (!cancelled) setPermissions(data);
      })
      .catch(() => {
        if (!cancelled) setPermissions(FAIL_CLOSED_PERMS);
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
