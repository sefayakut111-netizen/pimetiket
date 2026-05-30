/**
 * POST /api/editor/bg-remove — pre-order arka plan kaldırma.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectBackground } from "@/lib/proof/background-detect";
import { removeBackground } from "@/lib/proof/background-remove";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import { rateLimit } from "@/lib/rate-limit";
import type { TablesInsert } from "@/lib/supabase/types";

export const runtime = "nodejs";

const Body = z.object({
  tempDesignId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `editor-bg:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: temp } = await admin
    .from("design_temp_uploads")
    .select("id, storage_path, original_name, mime_type, size_bytes, user_id")
    .eq("id", body.tempDesignId)
    .maybeSingle();

  const row = temp as {
    id: string;
    storage_path: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    user_id: string;
  } | null;
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(row.storage_path, 300);
  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  const bgDetect = await detectBackground(
    signed.signedUrl,
    row.original_name,
    "paper"
  );
  if (!bgDetect.needsRemoval) {
    return NextResponse.json({ error: "no_bg_removal_needed" }, { status: 400 });
  }

  const removed = await removeBackground(signed.signedUrl, bgDetect);
  if (!removed.success || !removed.outputBuffer) {
    return NextResponse.json(
      { error: removed.error ?? "remove_failed" },
      { status: 500 }
    );
  }

  const newFileId = crypto.randomUUID();
  const newPath = `temp/${user.id}/${newFileId}.png`;
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(newPath, removed.outputBuffer, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const baseName = row.original_name.replace(/\.[^.]+$/, "");
  const insertRow: TablesInsert<"design_temp_uploads"> = {
    id: newFileId,
    user_id: user.id,
    storage_path: newPath,
    original_name: `${baseName}-nobg.png`,
    mime_type: "image/png",
    size_bytes: removed.outputBuffer.length,
  };
  await admin.from("design_temp_uploads").insert(insertRow);

  const { data: previewSigned } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(newPath, 3600);

  return NextResponse.json({
    ok: true,
    newTempDesignId: newFileId,
    previewUrl: previewSigned?.signedUrl ?? null,
    method: removed.method,
  });
}
