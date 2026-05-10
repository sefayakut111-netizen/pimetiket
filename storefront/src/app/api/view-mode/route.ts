/**
 * /api/view-mode — Admin/staff kullanıcının görünüm modunu değiştirir.
 *
 * POST { mode: "customer" } → cookie set → /panelim'e dön
 * POST { mode: "admin" }    → cookie sil → /admin'e dön
 *
 * Güvenlik:
 *   - Sadece login kullanıcı çağırabilir
 *   - DB.role admin/staff DEĞİLSE 403 (cookie zaten anlamsız çünkü middleware
 *     /admin'i blokluyor; yine de iyi uygulama)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

interface BodyShape {
  mode?: unknown;
}

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: false, // UI'nin de okuması gerek (banner)
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 gün
};

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode === "customer" ? "customer" : "admin";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role ?? "customer";

  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  if (mode === "customer") {
    cookieStore.set(VIEW_MODE_COOKIE, "customer", COOKIE_OPTIONS);
  } else {
    cookieStore.delete(VIEW_MODE_COOKIE);
  }

  return NextResponse.json({ ok: true, mode, role });
}
