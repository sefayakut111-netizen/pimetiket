/**
 * GET /api/admin/customers/diagnostic
 *
 * Sefa 21 May v68 — Müşteriler CRM API production debug için tek-istek
 * diagnostic endpoint. Sefa Vercel logs'a bakmak yerine doğrudan bu URL'i
 * çağırır, JSON response root cause'u söyler.
 *
 * Kontrol edilen 4 katman:
 *   1. Auth: assertAdmin geçer mi (cookie/session var mı, rol admin mi)
 *   2. ENV: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL set mi
 *   3. Client: createAdminClient sorunsuz oluşur mu
 *   4. View: v_admin_customers var mı, count(*) okunur mu (RLS bypass test)
 *
 * Çıktı (örnek):
 *   {
 *     "ok": false,
 *     "step": "view-query",
 *     "error": "relation \"v_admin_customers\" does not exist",
 *     "code": "42P01",
 *     "fix": "Migration 046 production'a push edilmemiş",
 *     "auth": { "ok": true, "userId": "...", "role": "super_admin" },
 *     "env": { "url": true, "serviceKey": true },
 *     ...
 *   }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DiagnosticResult {
  ok: boolean;
  step: "auth" | "env" | "client" | "view-query" | "complete";
  error?: string;
  code?: string;
  fix?: string;
  auth?: { ok: boolean; userId?: string; role?: string; reason?: string };
  env?: { url: boolean; serviceKey: boolean };
  view?: { exists: boolean; rowCount?: number };
  timestamp: string;
}

export async function GET() {
  const ts = new Date().toISOString();

  // ─── 1. Auth ───
  const auth = await assertPermission("customers", "view");
  if (!auth) {
    const result: DiagnosticResult = {
      ok: false,
      step: "auth",
      error: "Admin auth fail (cookie yok ya da rol uygun değil)",
      fix: "Önce /auth'tan admin hesabıyla giriş yap, sonra bu endpoint'i çağır",
      auth: { ok: false, reason: "assertPermission null döndü" },
      timestamp: ts,
    };
    return NextResponse.json(result, { status: 403 });
  }

  // ─── 2. ENV ───
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    const result: DiagnosticResult = {
      ok: false,
      step: "env",
      error: `ENV eksik: ${!url ? "NEXT_PUBLIC_SUPABASE_URL " : ""}${!serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`,
      fix: "Vercel → Settings → Environment Variables → eksik değişkeni ekle + Redeploy",
      auth: { ok: true, userId: auth.user.id, role: auth.role },
      env: { url: Boolean(url), serviceKey: Boolean(serviceKey) },
      timestamp: ts,
    };
    return NextResponse.json(result, { status: 500 });
  }

  // ─── 3. Client ───
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const result: DiagnosticResult = {
      ok: false,
      step: "client",
      error: `createAdminClient hata: ${(e as Error).message}`,
      fix: "Supabase URL veya service key formatı yanlış — Dashboard → Settings → API'den tekrar kopyala",
      auth: { ok: true, userId: auth.user.id, role: auth.role },
      env: { url: true, serviceKey: true },
      timestamp: ts,
    };
    return NextResponse.json(result, { status: 500 });
  }

  // ─── 4. View ───
  const { data, error, count } = await admin
    .from("v_admin_customers")
    .select("*", { count: "exact", head: true });

  if (error) {
    let fix = "Detay için error.message ve code'a bak";
    if (error.code === "42P01") {
      fix = "v_admin_customers view yok → Migration 046 push edilmemiş. `npx supabase db push --linked` çalıştır";
    } else if (error.code === "42501") {
      fix = "Permission denied → service_role key yanlış ya da view DEFINER ayarı bozuk. Migration 046 SQL'ini tekrar uygula";
    } else if (error.message.includes("column") && error.message.includes("does not exist")) {
      fix = "View tanımı stale (üst migration şemayı değiştirdi) → Migration 046'yı drop+recreate";
    }
    const result: DiagnosticResult = {
      ok: false,
      step: "view-query",
      error: error.message,
      code: error.code,
      fix,
      auth: { ok: true, userId: auth.user.id, role: auth.role },
      env: { url: true, serviceKey: true },
      view: { exists: false },
      timestamp: ts,
    };
    return NextResponse.json(result, { status: 500 });
  }

  // ─── BAŞARI ───
  // Sadece sayım — gerçek müşteri verisi /api/admin/customers'tan gelir
  void data;
  const result: DiagnosticResult = {
    ok: true,
    step: "complete",
    auth: { ok: true, userId: auth.user.id },
    env: { url: true, serviceKey: true },
    view: { exists: true, rowCount: count ?? 0 },
    timestamp: ts,
  };
  return NextResponse.json(result);
}
