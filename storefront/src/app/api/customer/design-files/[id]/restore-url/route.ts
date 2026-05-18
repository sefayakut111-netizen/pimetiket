/**
 * POST /api/customer/design-files/[id]/restore-url
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * Müşterinin arşivdeki bir tasarım dosyasına 1 saatlik signed URL üretir.
 * Yetki: sadece dosyanın sahibi (auth user) erişebilir.
 *
 * Response (success):
 *   { url: string, expiresAt: string ISO, dryRun?: boolean }
 *
 * Response (error):
 *   { error: string } — 401/403/404
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getArchivedDesignFileUrl } from "@/lib/storage/restore-service";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Dosya ID eksik" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Giriş yapmanız gerekiyor" },
      { status: 401 }
    );
  }

  const result = await getArchivedDesignFileUrl({
    designFileId: id,
    requesterId: user.id,
    requesterType: "user",
    reason: "Müşteri panel indirme talebi",
  });

  if ("error" in result) {
    const isAuth =
      result.error.toLowerCase().includes("yetkisiz") ||
      result.error.toLowerCase().includes("unauthorized");
    return NextResponse.json(result, { status: isAuth ? 403 : 404 });
  }

  return NextResponse.json({
    url: result.url,
    expiresAt: result.expiresAt.toISOString(),
    dryRun: result.dryRun,
  });
}
