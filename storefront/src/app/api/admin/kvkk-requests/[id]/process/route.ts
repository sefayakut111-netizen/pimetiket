/**
 * POST /api/admin/kvkk-requests/[id]/process
 *
 * Admin KVKK talebini "processing" → "completed" / "rejected" durumuna
 * götürür. complete → depolama otomatik temizlenir (KVKK storage-purge).
 *
 * Body: { action: 'complete' | 'reject', note?: string }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";
import {
  purgeKvkkUserStorage,
  shouldPurgeKvkkStorage,
} from "@/lib/kvkk/storage-purge";
import { deleteUserPiiAndAnonymizeAuth } from "@/lib/kvkk/delete-user-pii";
import {
  deletePimConversationForUser,
  scopeIncludesPimChat,
} from "@/lib/pim/kvkk-pim-chat";

export const dynamic = "force-dynamic";

interface BodyShape {
  action?: unknown;
  note?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const auth = await assertPermission("kvkk", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }


  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "complete" && action !== "reject") {
    return NextResponse.json(
      { error: "action: 'complete' veya 'reject'" },
      { status: 400 }
    );
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mevcut kaydı çek + status uygun mu kontrol
  const { data: existing } = await admin
    .from("kvkk_requests")
    .select("id, user_id, kind, status, scope")
    .eq("id", id)
    .maybeSingle();
  const row = existing as {
    id: string;
    user_id: string;
    kind: string;
    status: string;
    scope: Record<string, unknown> | null;
  } | null;
  if (!row) {
    return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  }
  if (!["confirmed", "processing"].includes(row.status)) {
    return NextResponse.json(
      {
        error: `Bu talep ${row.status} durumunda — işleme alınamaz`,
      },
      { status: 409 }
    );
  }

  const nextStatus = action === "complete" ? "completed" : "rejected";

  let accountDeleteEmail: string | null = null;
  if (action === "complete" && row.kind === "account_delete") {
    const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
    accountDeleteEmail = authUser?.user?.email ?? null;
  }

  if (action === "complete") {
    if (
      row.kind === "partial_delete" &&
      scopeIncludesPimChat(row.scope)
    ) {
      const del = await deletePimConversationForUser(admin, row.user_id);
      if (!del.ok) {
        return NextResponse.json(
          { error: del.error ?? "Pim sohbet silinemedi" },
          { status: 500 }
        );
      }
    }

    if (
      shouldPurgeKvkkStorage(row.kind, row.scope) &&
      (row.kind === "account_delete" || row.kind === "partial_delete")
    ) {
      const purge = await purgeKvkkUserStorage({
        admin,
        userId: row.user_id,
        kind: row.kind,
        scope: row.scope,
        actorId: auth.user.id,
        actorType: "admin",
        kvkkRequestId: id,
        reason: `KVKK talebi tamamlandı: ${row.kind}`,
      });
      if (!purge.ok) {
        return NextResponse.json(
          { error: purge.error ?? "Depolama temizliği başarısız" },
          { status: 500 }
        );
      }
    }

    if (row.kind === "account_delete") {
      const piiRes = await deleteUserPiiAndAnonymizeAuth(admin, {
        userId: row.user_id,
        email: accountDeleteEmail,
        kvkkRequestId: id,
        actorId: auth.user.id,
        actorRole: "admin",
      });
      if (!piiRes.ok) {
        return NextResponse.json(
          { error: `KVKK silme (${piiRes.stage}): ${piiRes.message}` },
          { status: 500 }
        );
      }
    }
  }

  const { error: updateErr } = await admin
    .from("kvkk_requests")
    .update({
      status: nextStatus,
      processed_by: auth.user.id,
      processed_at: new Date().toISOString(),
      admin_note: note,
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/kvkk-requests process]", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role === "admin" ? "admin" : "staff",
    action: "profile.delete",
    targetType: "kvkk_request",
    targetId: id,
    summary: `KVKK talebi ${action === "complete" ? "tamamlandı" : "reddedildi"}: ${row.kind}`,
    detail: {
      kind: row.kind,
      previous_status: row.status,
      new_status: nextStatus,
      admin_note: note,
    },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
