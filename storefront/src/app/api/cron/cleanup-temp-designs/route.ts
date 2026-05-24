/**
 * GET /api/cron/cleanup-temp-designs
 *
 * Süresi dolmuş design_temp_uploads satırlarını ve Supabase Storage
 * temp/ dosyalarını temizler (Migration 008).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authFail = assertCronAuth(req);
  if (authFail) return authFail;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase env eksik" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expired, error: fetchErr } = await admin
    .from("design_temp_uploads")
    .select("id, storage_path")
    .is("promoted_to", null)
    .lt("expires_at", new Date().toISOString());

  if (fetchErr) {
    console.error("[cleanup-temp-designs] fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rows = (expired ?? []) as Array<{ id: string; storage_path: string }>;
  let storageDeleted = 0;
  let storageErrors = 0;

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const paths = batch.map((r) => r.storage_path);
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) {
      console.error("[cleanup-temp-designs] storage delete:", error);
      storageErrors += paths.length;
    } else {
      storageDeleted += (data as { name: string }[])?.length ?? 0;
    }
  }

  const { count: dbDeleted, error: delErr } = await admin
    .from("design_temp_uploads")
    .delete({ count: "exact" })
    .is("promoted_to", null)
    .lt("expires_at", new Date().toISOString());

  if (delErr) {
    console.error("[cleanup-temp-designs] db delete:", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    expired_found: rows.length,
    db_deleted: dbDeleted ?? rows.length,
    storage_deleted: storageDeleted,
    storage_errors: storageErrors,
    timestamp: new Date().toISOString(),
  });
}
