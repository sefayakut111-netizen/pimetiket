/**
 * Server-side helper — kullanıcının role'ünü çek.
 *
 * Layout/Server component'lerde kullan. Client component'lerde useUser +
 * /api/me/role gibi bir endpoint daha mantıklı (henüz yok).
 */

import { cookies } from "next/headers";
import { createClient } from "./server";
import { VIEW_MODE_COOKIE, parseViewMode, type ViewMode } from "@/lib/view-mode";

export interface UserRoleInfo {
  userId: string | null;
  role: "customer" | "staff" | "admin" | null;
  viewMode: ViewMode;
  /** admin/staff ama view_mode=customer ise true */
  isImpersonating: boolean;
}

export async function getCurrentUserRole(): Promise<UserRoleInfo> {
  const cookieStore = await cookies();
  const viewMode = parseViewMode(cookieStore.get(VIEW_MODE_COOKIE)?.value);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { userId: null, role: null, viewMode, isImpersonating: false };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { userId: null, role: null, viewMode, isImpersonating: false };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const rawRole = (profile as { role?: string } | null)?.role ?? "customer";
    const role: UserRoleInfo["role"] =
      rawRole === "admin"
        ? "admin"
        : rawRole === "staff"
          ? "staff"
          : "customer";

    const isImpersonating =
      (role === "admin" || role === "staff") && viewMode === "customer";

    return { userId: user.id, role, viewMode, isImpersonating };
  } catch {
    return { userId: null, role: null, viewMode, isImpersonating: false };
  }
}
