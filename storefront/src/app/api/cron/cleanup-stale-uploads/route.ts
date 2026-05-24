/**
 * GET /api/cron/cleanup-stale-uploads
 *
 * upload-init ile açılıp upload-complete çağrılmamış design_files satırlarını
 * (status=uploaded, 24h+) ve ilgili storage/R2 dosyalarını temizler.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import {
  deleteR2Keys,
  isR2StorageKey,
} from "@/lib/storage/purge-r2";

export const dynamic = "force-dynamic";

const STALE_HOURS = 24;

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

  const cutoff = new Date(
    Date.now() - STALE_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: stale, error: fetchErr } = await admin
    .from("design_files")
    .select("id, storage_path")
    .eq("status", "uploaded")
    .is("sha256", null)
    .lt("created_at", cutoff)
    .limit(500);

  if (fetchErr) {
    console.error("[cleanup-stale-uploads] fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rows = (stale ?? []) as Array<{ id: string; storage_path: string }>;
  const supabasePaths = rows
    .map((r) => r.storage_path)
    .filter((p) => p && !isR2StorageKey(p));
  const r2Paths = rows
    .map((r) => r.storage_path)
    .filter((p) => p && isR2StorageKey(p));

  let storageDeleted = 0;
  for (let i = 0; i < supabasePaths.length; i += 100) {
    const batch = supabasePaths.slice(i, i + 100);
    const { data, error } = await admin.storage.from(STORAGE_BUCKET).remove(batch);
    if (!error) {
      storageDeleted += (data as { name: string }[])?.length ?? 0;
    }
  }

  const r2Result = await deleteR2Keys(r2Paths);

  if (rows.length > 0) {
    await admin
      .from("design_files")
      .delete()
      .in(
        "id",
        rows.map((r) => r.id)
      );
  }

  return NextResponse.json({
    ok: true,
    stale_found: rows.length,
    db_deleted: rows.length,
    storage_deleted: storageDeleted,
    r2_deleted: r2Result.deleted,
    r2_errors: r2Result.errors,
    timestamp: new Date().toISOString(),
  });
}
