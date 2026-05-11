/**
 * POST /api/me/kvkk-requests/[id]/cancel
 *
 * Müşteri 48 saat grace period içinde silme talebini geri alır.
 * - pending / confirmed status'lardan birinde ise iptal edilebilir
 * - processing / completed / cancelled / rejected ise iptal edilemez
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mevcut kaydı oku — sadece kendi talebi + iptal edilebilir status
  const { data: existing } = await admin
    .from("kvkk_requests")
    .select("id, user_id, status, kind")
    .eq("id", id)
    .maybeSingle();
  const row = existing as {
    id: string;
    user_id: string;
    status: string;
    kind: string;
  } | null;
  if (!row) {
    return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["pending", "confirmed"].includes(row.status)) {
    return NextResponse.json(
      { error: "Bu talep artık iptal edilemez (işlem başladı)" },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("kvkk_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[kvkk-cancel]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorRole: "customer",
    action: "profile.delete",
    targetType: "kvkk_request",
    targetId: id,
    summary: `KVKK talebi iptal edildi: ${row.kind}`,
    detail: { kind: row.kind, previous_status: row.status },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
