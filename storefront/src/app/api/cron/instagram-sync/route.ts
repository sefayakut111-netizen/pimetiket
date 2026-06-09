/**
 * @deprecated Marka kararı (PIM-KURUMSAL-KIMLIK) — Instagram otomasyon iptal.
 * Cron registry'de yok; route sadece manuel test için bırakıldı.
 */
import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { syncInstagramToSiteImageSlots } from "@/lib/instagram/sync-slots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  const result = await syncInstagramToSiteImageSlots(6);
  return NextResponse.json({
    ...result,
    ts: new Date().toISOString(),
  });
}
