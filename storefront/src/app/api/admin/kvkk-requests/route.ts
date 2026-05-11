/**
 * GET /api/admin/kvkk-requests
 *
 * Admin /admin/kvkk-talepleri sayfasında kullanılır.
 * Query params:
 *   - status: pending|confirmed|processing|completed|cancelled|rejected|all
 *   - limit: max 100, default 50
 *
 * Müşteri PII'yi de dön (email + ad) — sadece admin görür.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_STATUS = [
  "pending",
  "confirmed",
  "processing",
  "completed",
  "cancelled",
  "rejected",
] as const;

export async function GET(req: Request) {
  const supabase = await createServerClient();
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
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "all";
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
    100
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = admin
    .from("kvkk_requests")
    .select(
      "id, user_id, kind, status, scope, user_note, grace_period_until, " +
        "cancelled_at, processed_by, processed_at, admin_note, " +
        "result_path, request_ip, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusParam !== "all" && VALID_STATUS.includes(statusParam as never)) {
    query = query.eq("status", statusParam);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[admin/kvkk-requests]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Müşteri email + isim için profiles join
  const userIds = Array.from(
    new Set(
      ((rows as { user_id: string }[]) ?? []).map((r) => r.user_id)
    )
  );

  const userMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of (profiles as { id: string; full_name: string | null }[]) ?? []) {
      userMap.set(p.id, { email: null, full_name: p.full_name });
    }
    // Email için auth.users — admin API call
    const { data: authList } = await admin.auth.admin.listUsers();
    for (const u of authList?.users ?? []) {
      if (userIds.includes(u.id)) {
        const existing = userMap.get(u.id) ?? { email: null, full_name: null };
        userMap.set(u.id, { email: u.email ?? null, full_name: existing.full_name });
      }
    }
  }

  const enriched = (rows ?? []).map((r) => {
    const u = userMap.get((r as { user_id: string }).user_id);
    return {
      ...r,
      user_email: u?.email ?? null,
      user_name: u?.full_name ?? null,
    };
  });

  return NextResponse.json({ requests: enriched });
}
