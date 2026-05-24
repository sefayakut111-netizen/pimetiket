/**
 * GET /api/me/permissions
 *
 * Admin/staff kullanıcının modül×eylem yetki haritası.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildUserPermissions } from "@/lib/admin-rbac-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildUserPermissions(user.id);
  if (!payload) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(payload);
}
