/**
 * /api/view-mode — Admin/staff kullanıcının görünüm modunu değiştirir.
 *
 * POST { mode: "customer" } → müşteri storefront
 * POST { mode: "partner" }  → partner arayüz denetimi (partner seçimi yok)
 * POST { mode: "admin" }    → cookie sil → admin paneli
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";
import { PARTNER_PREVIEW_ID_COOKIE } from "@/lib/partner-preview";

interface BodyShape {
  mode?: unknown;
}

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: false,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

async function assertAdminStaff(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "customer";
  return role === "admin" || role === "staff";
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode =
    body.mode === "customer"
      ? "customer"
      : body.mode === "partner"
        ? "partner"
        : "admin";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await assertAdminStaff(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();

  if (mode === "customer") {
    cookieStore.set(VIEW_MODE_COOKIE, "customer", COOKIE_OPTIONS);
    cookieStore.delete(PARTNER_PREVIEW_ID_COOKIE);
    return NextResponse.json({ ok: true, mode: "customer" });
  }

  if (mode === "partner") {
    cookieStore.set(VIEW_MODE_COOKIE, "partner", COOKIE_OPTIONS);
    cookieStore.delete(PARTNER_PREVIEW_ID_COOKIE);

    try {
      const admin = createAdminClient();
      await admin.from("audit_log").insert({
        actor_id: user.id,
        actor_email: user.email ?? null,
        actor_role: "admin",
        action: "settings.update" as Enums<"audit_action">,
        target_type: "partner_ui",
        target_id: user.id,
        summary: "Admin partner UI preview mode enabled",
        detail: { generic: true },
      });
    } catch {
      // sessiz — audit opsiyonel
    }

    return NextResponse.json({ ok: true, mode: "partner", generic: true });
  }

  cookieStore.delete(VIEW_MODE_COOKIE);
  cookieStore.delete(PARTNER_PREVIEW_ID_COOKIE);
  return NextResponse.json({ ok: true, mode: "admin" });
}
