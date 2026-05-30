/**
 * GET /api/sablonlar/kesim/download?id=...&set=kisscut|thrucut&format=pdf|ai|eps
 *
 * Kesim bıçağı şablonu indirme — ÜYE KAPISI.
 *   - Oturum yoksa 401 { error, requiresAuth: true }.
 *   - Üye ise R2 signed URL (5 dk) döner: { url, filename, expiresAt }.
 *   - Sadece manifest'te olan id/set/format için (keyfi R2 okuma engeli).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/storage/r2-client";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  DIE_CUT_BY_ID,
  dieCutR2Key,
  dieCutDownloadFilename,
} from "@/lib/templates/die-cut-templates";

export const runtime = "nodejs";

const Query = z.object({
  id: z.string().min(1).max(80),
  set: z.enum(["kisscut", "thrucut"]),
  format: z.enum(["pdf", "ai", "eps"]),
});

const CT = {
  pdf: "application/pdf",
  ai: "application/illustrator",
  eps: "application/postscript",
} as const;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    id: url.searchParams.get("id"),
    set: url.searchParams.get("set"),
    format: url.searchParams.get("format"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const { id, set, format } = parsed.data;

  const tpl = DIE_CUT_BY_ID.get(id);
  if (!tpl) {
    return NextResponse.json({ error: "Şablon bulunamadı" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Dosyayı indirmek için üye girişi gerekli.", requiresAuth: true },
      { status: 401 }
    );
  }

  const ip = getClientIp(req);
  const limit = await rateLimit({
    key: `tpl-dl:${user.id}:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Çok fazla istek, biraz bekle." },
      { status: 429 }
    );
  }

  const key = dieCutR2Key(tpl, set, format);
  const filename = dieCutDownloadFilename(tpl, set, format);
  const signed = await getSignedDownloadUrl(key, 300, {
    downloadFilename: filename,
    contentType: CT[format],
  });

  return NextResponse.json({
    url: signed,
    filename,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  });
}
