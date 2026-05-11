/**
 * GET /api/fason/download/[token]
 *
 * Fason'un tasarım dosyasına erişim proxy'si.
 *
 * Akış:
 *   1. Token doğrula (fn_validate_fason_token RPC)
 *   2. Assignment'ı bul → order_id → design_files (approved, en güncel)
 *   3. Storage'tan fresh signed URL üret (15 dk TTL)
 *   4. fason_link_access_log INSERT (audit)
 *   5. order_events 'fason_link_accessed' log
 *   6. İlk kez tıklanıyorsa assignment.acknowledged_at + status update
 *   7. 302 redirect to signed URL
 *
 * Bu endpoint:
 *   - Public (auth gerekmez — token kendi auth'u)
 *   - Cache=no
 *   - Rate limit yok (token zaten unique + expires)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 15 * 60; // 15 dakika

function getIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Sunucu yapılandırması" },
      { status: 500 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Token doğrula
  const { data: validateData } = await admin.rpc(
    "fn_validate_fason_token" as never,
    { p_token: token } as never
  );

  const validation = (validateData as Array<{
    assignment_id: string;
    fason_partner_id: string;
    order_id: string;
    is_valid: boolean;
    reason: string;
  }>)?.[0];

  if (!validation || !validation.is_valid) {
    return NextResponse.json(
      {
        error: "Token geçersiz",
        reason: validation?.reason ?? "unknown",
      },
      { status: 401 }
    );
  }

  // 2) Onaylı tasarım dosyasını bul (en güncel approved/qc_passed)
  const { data: designFile, error: designErr } = await admin
    .from("design_files")
    .select("storage_path, original_name, mime_type, status")
    .eq("order_id", validation.order_id)
    .in("status", ["approved", "qc_passed"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (designErr || !designFile) {
    // Audit: başarısız erişim
    await admin.from("fason_link_access_log").insert({
      assignment_id: validation.assignment_id,
      ip_address: getIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      action: "download",
      success: false,
    });
    return NextResponse.json(
      { error: "Onaylı tasarım dosyası bulunamadı" },
      { status: 404 }
    );
  }

  const fileRow = designFile as {
    storage_path: string;
    original_name: string;
    mime_type: string;
    status: string;
  };

  // 3) Fresh signed URL üret (15 dk TTL)
  const { data: signedData, error: signedErr } = await admin.storage
    .from("designs")
    .createSignedUrl(fileRow.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: fileRow.original_name,
    });

  if (signedErr || !signedData?.signedUrl) {
    console.error("[fason/download] signed url error:", signedErr);
    return NextResponse.json(
      { error: "Dosya erişim hatası" },
      { status: 500 }
    );
  }

  // 4) Access log
  await admin.from("fason_link_access_log").insert({
    assignment_id: validation.assignment_id,
    ip_address: getIp(req),
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    action: "download",
    success: true,
  });

  // 5) order_events log
  await admin.from("order_events").insert({
    order_id: validation.order_id,
    event_type: "fason_link_accessed",
    actor_role: "fason",
    summary: `Fason dosyaya erişti: ${fileRow.original_name}`,
    detail: {
      assignment_id: validation.assignment_id,
      file: fileRow.original_name,
      mime_type: fileRow.mime_type,
    },
  });

  // 6) İlk erişimse acknowledged_at set + status update
  const { data: existing } = await admin
    .from("order_assignments")
    .select("status, acknowledged_at")
    .eq("id", validation.assignment_id)
    .maybeSingle();

  const assign = existing as {
    status: string;
    acknowledged_at: string | null;
  } | null;
  if (assign && !assign.acknowledged_at) {
    const newStatus =
      assign.status === "assigned" || assign.status === "sent"
        ? "acknowledged"
        : assign.status;
    await admin
      .from("order_assignments")
      .update({
        acknowledged_at: new Date().toISOString(),
        status: newStatus,
      })
      .eq("id", validation.assignment_id);

    if (newStatus === "acknowledged") {
      await admin.from("order_events").insert({
        order_id: validation.order_id,
        event_type: "fason_acknowledged",
        actor_role: "fason",
        summary: "Fason dosyaya tıkladı (ilk erişim)",
        detail: { assignment_id: validation.assignment_id },
      });
    }
  }

  // 7) Redirect to signed URL
  return NextResponse.redirect(signedData.signedUrl, 302);
}
