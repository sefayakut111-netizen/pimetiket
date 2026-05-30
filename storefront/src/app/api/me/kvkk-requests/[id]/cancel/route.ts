/**
 * POST /api/me/kvkk-requests/[id]/cancel
 *
 * Müşteri kendi KVKK talebini grace period içinde iptal eder.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = serviceClient();

  const { data: row } = await admin
    .from("kvkk_requests")
    .select("id, user_id, status, grace_period_until")
    .eq("id", id)
    .maybeSingle();

  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  }

  if (!["confirmed", "pending"].includes(row.status)) {
    return NextResponse.json(
      { error: "Bu talep artık iptal edilemez" },
      { status: 409 }
    );
  }

  const { data: updated, error } = await admin
    .from("kvkk_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["confirmed", "pending"])
    .select("id, status, cancelled_at")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "İptal edilemedi" }, { status: 409 });
  }

  await logServerAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorRole: "customer",
    action: "profile.delete",
    targetType: "kvkk_request",
    targetId: id,
    summary: "KVKK talebi iptal edildi",
  });

  return NextResponse.json({ request: updated });
}
