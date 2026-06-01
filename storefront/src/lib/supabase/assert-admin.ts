/**
 * Shared admin/staff guard for API routes.
 *
 * Bu helper, /api/admin/* + /api/payment/refund vb. tüm admin
 * endpoint'lerinde kullanılır. Cookie-based session ile auth kontrolü
 * yapar — service_role anahtarı header'da ASLA bulunmaz.
 *
 * Sefa kararı (audit 12 May P0): refund endpoint'i `x-admin-secret`
 * header'da service_role'u taşıyordu — anahtar logs / curl history /
 * proxy'lerde sızabilir. Cookie-based session ile RBAC daha güvenli.
 */

import { createClient as createServerClient } from "./server";

export interface AdminGuardResult {
  user: { id: string; email?: string };
  role: "admin" | "staff";
}

/**
 * Mevcut session admin/staff mı? Yoksa null döner — caller 403 atar.
 *
 * Usage:
 *   const auth = await assertAdmin();
 *   if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 */
export async function assertAdmin(): Promise<AdminGuardResult | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "staff") return null;

    return {
      user: { id: user.id, email: user.email },
      role: role as "admin" | "staff",
    };
  } catch {
    return null;
  }
}

/** Sipariş sahibi admin/staff mi? (payment marker + guard) */
export async function isAdminOrStaffUserId(userId: string): Promise<boolean> {
  try {
    const { createAdminClient } = await import("./admin");
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    return role === "admin" || role === "staff";
  } catch {
    return false;
  }
}
