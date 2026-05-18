/**
 * POST /api/admin/archive/signed-url
 *
 * Pim Etiket 18 May v68 (R2 cold storage admin panel):
 * Admin'in arşivdeki bir dosya için 1 saatlik signed URL almasını sağlar.
 * archive_events tablosuna 'cold_access' audit log düşer (KVKK m.11/h).
 *
 * Request body:
 *   {
 *     r2Key: string,           // örn "customers/<uuid>/profile-snapshot.json"
 *     reason: string,          // örn "Müşteri WhatsApp talebi #1234"
 *     ttlSeconds?: number,     // default 3600 (1 saat), max 86400 (1 gün)
 *   }
 *
 * Response:
 *   { url: string, expiresAt: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const r2Key = (body.r2Key as string | undefined)?.trim();
  const reason = (body.reason as string | undefined)?.trim() ?? "Admin manuel erişim";
  const ttlSeconds = Math.min(
    Math.max(Number(body.ttlSeconds ?? 3600), 60),
    86400
  );

  if (!r2Key) {
    return NextResponse.json(
      { error: "r2Key zorunlu" },
      { status: 400 }
    );
  }

  // Güvenlik: key "customers/" altında olmalı (admin başka prefix'lere erişemesin)
  if (!r2Key.startsWith("customers/")) {
    return NextResponse.json(
      { error: "Geçersiz r2Key — sadece customers/ altında" },
      { status: 400 }
    );
  }

  // Signed URL üret (Promise<string> döner)
  let signedUrl: string;
  try {
    signedUrl = await getSignedDownloadUrl(r2Key, ttlSeconds);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Signed URL üretilemedi",
        details: (err as Error).message,
      },
      { status: 500 }
    );
  }
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // Audit log — service client gerek (RLS service role bypass)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // r2Key'den user_id'yi parse et: customers/<uuid>/...
  const userIdMatch = r2Key.match(
    /^customers\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i
  );
  const userId = userIdMatch ? userIdMatch[1] : null;

  await serviceClient.from("archive_events").insert({
    event_type: "cold_access",
    resource_type: "admin_signed_url",
    resource_id: userId ?? "00000000-0000-0000-0000-000000000000",
    user_id: userId,
    actor_id: auth.user.id,
    actor_type: auth.role === "admin" ? "admin" : "cowork",
    archive_path: r2Key,
    reason,
    metadata: { ttl_seconds: ttlSeconds, admin_email: auth.user.email },
  });

  return NextResponse.json({
    url: signedUrl,
    expiresAt: expiresAt.toISOString(),
  });
}
