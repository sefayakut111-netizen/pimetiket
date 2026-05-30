/**
 * POST /api/editor/save — pre-order cutline draft persist (üye zorunlu).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2 } from "@/lib/storage/r2-client";
import {
  r2EditorDraftPreviewKey,
  r2EditorDraftSvgKey,
} from "@/lib/storage/buckets";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  tempDesignId: z.string().uuid(),
  svg: z.string().min(10).max(2 * 1024 * 1024),
  preview_png_base64: z.string().optional(),
  source: z.enum(["raster", "vector", "vector-with-cutline", "psd"]),
  mode: z.enum(["contour", "hull", "rect", "circle"]),
  offset_mm: z.number().optional().nullable(),
  width_mm: z.number().positive().optional().nullable(),
  height_mm: z.number().positive().optional().nullable(),
  cutline_width_mm: z.number().positive().optional().nullable(),
  cutline_height_mm: z.number().positive().optional().nullable(),
  material_type: z.string().optional().nullable(),
  placement_json: z
    .object({
      x: z.number(),
      y: z.number(),
      scale: z.number(),
    })
    .optional()
    .nullable(),
});

const MAX_PREVIEW = 1 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit({
    key: `editor-save:${user.id}`,
    limit: 20,
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

  if (!body.svg.includes("<svg")) {
    return NextResponse.json({ error: "invalid_svg" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tempRow } = await admin
    .from("design_temp_uploads")
    .select("id")
    .eq("id", body.tempDesignId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tempRow) {
    return NextResponse.json({ error: "temp_design_not_found" }, { status: 404 });
  }

  const ts = Date.now();
  const svgKey = r2EditorDraftSvgKey(user.id, body.tempDesignId, ts);
  const svgUp = await uploadToR2({
    key: svgKey,
    body: body.svg,
    contentType: "image/svg+xml",
  });
  if (!svgUp.success) {
    return NextResponse.json({ error: "svg_upload_failed" }, { status: 500 });
  }

  let previewKey: string | null = null;
  if (body.preview_png_base64) {
    try {
      const b64 = body.preview_png_base64.replace(/^data:image\/png;base64,/, "");
      const buf = Buffer.from(b64, "base64");
      if (buf.length <= MAX_PREVIEW) {
        previewKey = r2EditorDraftPreviewKey(user.id, body.tempDesignId, ts);
        const prevUp = await uploadToR2({
          key: previewKey,
          body: buf,
          contentType: "image/png",
        });
        if (!prevUp.success) previewKey = null;
      }
    } catch {
      previewKey = null;
    }
  }

  const { data: inserted, error: insErr } = await (
    admin as unknown as {
      from: (t: string) => {
        insert: (v: Record<string, unknown>) => {
          select: (s: string) => { single: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    }
  )
    .from("editor_cutline_drafts")
    .insert({
      user_id: user.id,
      temp_design_id: body.tempDesignId,
      svg_key: svgKey,
      preview_key: previewKey,
      source: body.source,
      mode: body.mode,
      offset_mm: body.offset_mm ?? null,
      width_mm: body.width_mm ?? null,
      height_mm: body.height_mm ?? null,
      cutline_width_mm: body.cutline_width_mm ?? body.width_mm ?? null,
      cutline_height_mm: body.cutline_height_mm ?? body.height_mm ?? null,
      placement_json: body.placement_json ?? null,
      material_type: body.material_type ?? "paper",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("[editor/save] insert:", insErr);
    return NextResponse.json({ error: "draft_insert_failed" }, { status: 500 });
  }

  const draftId = (inserted as { id: string }).id;
  let previewUrl: string | null = null;
  if (previewKey) {
    const { getSignedDownloadUrl } = await import("@/lib/storage/r2-client");
    previewUrl = await getSignedDownloadUrl(previewKey, 3600);
  }

  return NextResponse.json({
    ok: true,
    draftId,
    svgKey,
    previewUrl,
  });
}
