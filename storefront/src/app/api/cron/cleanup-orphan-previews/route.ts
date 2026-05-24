/**
 * GET /api/cron/cleanup-orphan-previews
 *
 * design-previews bucket'ta cart_items veya abandoned cart ile eşleşmeyen,
 * 7+ günlük orphan thumbnail'leri temizler.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/cron-auth";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";

export const dynamic = "force-dynamic";

const BUCKET = SUPABASE_STORAGE_BUCKETS.designPreviews;
const ORPHAN_DAYS = 7;
const MAX_SCAN = 500;

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
    Date.now() - ORPHAN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: cartRows } = await admin
    .from("cart_items")
    .select("design_preview_url")
    .not("design_preview_url", "is", null);

  const referenced = new Set<string>();
  for (const row of cartRows ?? []) {
    const previewUrl = (row as { design_preview_url: string | null })
      .design_preview_url;
    if (!previewUrl) continue;
    const path = extractPreviewPath(previewUrl);
    if (path) referenced.add(path);
  }

  const { data: objects, error: listErr } = await admin.storage
    .from(BUCKET)
    .list("", { limit: MAX_SCAN, sortBy: { column: "created_at", order: "asc" } });

  if (listErr) {
    console.error("[cleanup-orphan-previews] list error:", listErr);
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const orphanPaths: string[] = [];
  for (const userFolder of objects ?? []) {
    if (!userFolder.name || userFolder.name === ".emptyFolderPlaceholder") continue;
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(userFolder.name, { limit: 100 });
    for (const file of files ?? []) {
      if (!file.name?.endsWith(".png")) continue;
      const created = file.created_at ?? file.updated_at;
      if (created && created > cutoff) continue;
      const fullPath = `${userFolder.name}/${file.name}`;
      if (!referenced.has(fullPath)) {
        orphanPaths.push(fullPath);
      }
    }
  }

  let deleted = 0;
  for (let i = 0; i < orphanPaths.length; i += 100) {
    const batch = orphanPaths.slice(i, i + 100);
    const { data, error } = await admin.storage.from(BUCKET).remove(batch);
    if (!error) {
      deleted += (data as { name: string }[])?.length ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned_users: objects?.length ?? 0,
    orphans_found: orphanPaths.length,
    deleted,
    timestamp: new Date().toISOString(),
  });
}

function extractPreviewPath(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx + marker.length).split("?")[0] ?? null;
  if (url.includes(`${BUCKET}/`)) {
    const parts = url.split(`${BUCKET}/`);
    return parts[1]?.split("?")[0] ?? null;
  }
  return null;
}
