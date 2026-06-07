/**
 * /api/me/kvkk-requests
 *
 * GET   — Müşterinin kendi taleplerini listeler.
 * POST  — Yeni KVKK talebi oluştur. Geçerli kind'lar:
 *           - data_export
 *           - account_delete
 *           - partial_delete (scope: orders/designs/pim_chat/reviews/profile)
 *           - correction, objection, restriction (admin manuel işler)
 *
 * Resend gelene kadar:
 *   - Talep doğrudan `confirmed` olarak oluşur (email confirm step skip).
 *   - 48 saat grace period banner'ı `/ayarlar/verilerim` sayfasında görünür.
 *   - Cancel endpoint çalışır.
 *   - Admin /admin/kvkk-talepleri sayfasında processing'e alır.
 *
 * Resend gelince:
 *   - Talep `pending` oluşur, confirm_token üretilir.
 *   - fason_mail_outbox'a "kvkk_confirm_link" template eklenir.
 *   - Müşteri linke tıklayınca `confirmed` olur, grace timer başlar.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logServerAudit } from "@/lib/audit-log-server";
import { isSameOriginRequest } from "@/lib/security/csrf-origin";
import { verifyStepUpAuth } from "@/lib/security/step-up-auth";

export const dynamic = "force-dynamic";

const VALID_KINDS = [
  "data_export",
  "account_delete",
  "partial_delete",
  "correction",
  "objection",
  "restriction",
] as const;

type KvkkKind = (typeof VALID_KINDS)[number];

interface BodyShape {
  kind?: unknown;
  scope?: unknown;
  userNote?: unknown;
  password?: unknown;
  totpCode?: unknown;
}

const IRREVERSIBLE_KINDS = new Set<KvkkKind>([
  "account_delete",
  "partial_delete",
]);

interface KvkkRow {
  id: string;
  kind: KvkkKind;
  status: string;
  scope: Record<string, boolean>;
  grace_period_until: string | null;
  cancelled_at: string | null;
  result_path: string | null;
  created_at: string;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = serviceClient();
  const { data, error } = await admin
    .from("kvkk_requests")
    .select(
      "id, kind, status, scope, grace_period_until, cancelled_at, result_path, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[kvkk-requests GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: (data as KvkkRow[]) ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? (body.kind as KvkkKind) : null;
  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Geçersiz talep tipi" }, { status: 400 });
  }

  if (IRREVERSIBLE_KINDS.has(kind)) {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Geçersiz istek kaynağı" }, { status: 403 });
    }

    const stepUp = await verifyStepUpAuth(supabase, user.email, {
      password:
        typeof body.password === "string" ? body.password : undefined,
      totpCode: typeof body.totpCode === "string" ? body.totpCode : undefined,
    });
    if (!stepUp.ok) {
      return NextResponse.json(
        {
          error: stepUp.message,
          requiresTotp: stepUp.requiresTotp ?? false,
        },
        { status: stepUp.status }
      );
    }
  }

  const scope =
    body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
      ? (body.scope as Record<string, boolean>)
      : {};

  if (kind === "partial_delete" && !Object.values(scope).some(Boolean)) {
    return NextResponse.json(
      { error: "Granular silme için en az bir veri tipi seçmelisin" },
      { status: 400 }
    );
  }

  const userNote =
    typeof body.userNote === "string" ? body.userNote.slice(0, 1000) : null;

  // Resend yok — doğrudan confirmed + grace
  // Resend gelince: kind="account_delete"/"partial_delete"/"data_export"
  //   → status="pending" + confirm_token + mail outbox
  const now = new Date();
  const graceUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 saat
  const initialStatus =
    kind === "data_export" ? "processing" : "confirmed";

  const admin = serviceClient();
  const { data: row, error } = await admin
    .from("kvkk_requests")
    .insert({
      user_id: user.id,
      kind,
      status: initialStatus,
      scope,
      user_note: userNote,
      confirmed_at: now.toISOString(),
      grace_period_until: graceUntil.toISOString(),
      request_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select(
      "id, kind, status, scope, grace_period_until, cancelled_at, result_path, created_at"
    )
    .single();

  if (error || !row) {
    console.error("[kvkk-requests POST]", error);
    return NextResponse.json(
      { error: "Talep oluşturulamadı" },
      { status: 500 }
    );
  }

  // Audit log
  await logServerAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? null,
    actorRole: "customer",
    action: "profile.delete",
    targetType: "kvkk_request",
    targetId: (row as { id: string }).id,
    summary: `KVKK talebi: ${kind}${
      kind === "partial_delete"
        ? " (" +
          Object.entries(scope)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(",") +
          ")"
        : ""
    }`,
    detail: { kind, scope, status: initialStatus },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ request: row });
}
