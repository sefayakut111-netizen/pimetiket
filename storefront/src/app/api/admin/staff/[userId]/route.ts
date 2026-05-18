/**
 * PATCH /api/admin/staff/[userId]
 * DELETE /api/admin/staff/[userId]
 *
 * Sefa 18 May v68 (RBAC yayma — Migration 054):
 * Çalışan rol değiştirme + dondurma.
 *
 * PATCH body:
 *   { admin_role: 'super_admin' | 'operations' | 'customer_service' |
 *                 'production' | 'content_editor' | null }
 *
 * DELETE — admin_role'u null'a çek (çalışan değil artık)
 *
 * Sadece super_admin yetkisi.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";

export const runtime = "nodejs";

const VALID_ROLES = [
  "super_admin",
  "operations",
  "customer_service",
  "production",
  "content_editor",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Sadece super_admin yetkisi (modul=staff action=update)
  const auth = await assertPermission("staff", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const newRole = (body.admin_role as string | null | undefined) ?? null;

  if (newRole !== null && !VALID_ROLES.includes(newRole as never)) {
    return NextResponse.json(
      {
        error: `admin_role geçersiz. Kabul: ${VALID_ROLES.join(", ")} veya null`,
      },
      { status: 400 }
    );
  }

  // Kendi rolünü değiştiremezsin (super_admin sayısı 0 olmasın)
  if (userId === auth.user.id && newRole !== "super_admin") {
    return NextResponse.json(
      {
        error:
          "Kendi rolünü düşüremezsin. Başka bir super_admin'in seni güncellemesi gerek.",
      },
      { status: 400 }
    );
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Profil güncelle
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ admin_role: newRole })
    .eq("id", userId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: auth.user.id,
    actor_role: auth.role,
    action: "staff_role_changed",
    resource_type: "user",
    resource_id: userId,
    metadata: {
      new_admin_role: newRole,
      admin_email: auth.user.email,
    },
  });

  return NextResponse.json({ success: true, admin_role: newRole });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Çalışanı kaldır = admin_role null
  const auth = await assertPermission("staff", "delete");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: "Kendini çalışanlardan çıkaramazsın" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabase
    .from("profiles")
    .update({ admin_role: null })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    actor_id: auth.user.id,
    actor_role: auth.role,
    action: "staff_removed",
    resource_type: "user",
    resource_id: userId,
    metadata: { admin_email: auth.user.email },
  });

  return NextResponse.json({ success: true });
}
