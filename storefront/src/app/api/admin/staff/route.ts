/**
 * GET /api/admin/staff
 *
 * Sefa 18 May v68 (RBAC yayma — Migration 054):
 * Admin/staff rollü kullanıcıları listele. /admin/calisanlar sayfası
 * için gerçek veri.
 *
 * Response:
 *   {
 *     staff: [
 *       { user_id, email, display_name, admin_role, legacy_role,
 *         last_sign_in_at, email_confirmed_at, mfa_enabled }, ...
 *     ],
 *     roles: [ { role, label, description }, ... ]  // fn_list_admin_roles
 *   }
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";

export const runtime = "nodejs";

export interface StaffRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  admin_role: string | null;
  legacy_role: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  mfa_enabled: boolean;
}

function pickLatestActivity(
  ...values: Array<string | null | undefined>
): string | null {
  const dates = values.filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}

export async function GET() {
  // Sadece super_admin çalışan listesini görebilir
  const auth = await assertPermission("staff", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // admin_role NOT NULL veya legacy role admin/staff olan profilleri çek
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, admin_role, role, updated_at")
    .or("admin_role.not.is.null,role.in.(admin,staff)");

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  type ProfileRow = {
    id: string;
    display_name: string | null;
    admin_role: string | null;
    role: string | null;
    updated_at: string | null;
  };

  const rows = (profiles ?? []) as ProfileRow[];

  // Her kullanıcı için auth bilgisi + MFA çek
  const staffRows: StaffRow[] = await Promise.all(
    rows.map(async (p): Promise<StaffRow> => {
      const { data: userData } = await supabase.auth.admin.getUserById(p.id);
      const user = userData?.user;

      // MFA factors
      let mfaEnabled = false;
      try {
        const { data: factors } = await supabase.auth.admin.mfa.listFactors({
          userId: p.id,
        });
        mfaEnabled = (factors?.factors ?? []).some(
          (f) => f.status === "verified" && f.factor_type === "totp"
        );
      } catch {
        // MFA query başarısız olursa silently false
      }

      return {
        user_id: p.id,
        email: user?.email ?? null,
        display_name: p.display_name,
        admin_role: p.admin_role,
        legacy_role: p.role,
        last_sign_in_at: pickLatestActivity(
          user?.last_sign_in_at,
          p.updated_at
        ),
        email_confirmed_at: user?.email_confirmed_at ?? null,
        mfa_enabled: mfaEnabled,
      };
    })
  );

  // Rol seçenekleri (UI dropdown için)
  const { data: roles } = await supabase.rpc("fn_list_admin_roles");

  return NextResponse.json({
    staff: staffRows.sort((a, b) =>
      (a.admin_role ?? "z").localeCompare(b.admin_role ?? "z")
    ),
    roles: roles ?? [],
    currentUserId: auth.user.id,
  });
}
