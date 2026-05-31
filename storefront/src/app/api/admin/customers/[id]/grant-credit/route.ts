/**
 * /api/admin/customers/[id]/grant-credit  —  DEPRECATED (410 Gone)
 *
 * Sefa kararı 19 May v68, P0 #4 + Migration 015 (drop wallet):
 * "Cüzdan yok" — Anayasa. Wallet/credit sistemi 10 May 2026
 * akşamı tamamen silindi (Mig 015), tablo + RLS + index drop edildi.
 *
 * Bu endpoint daha önce CSV export handler'ının kopyasıydı; UI
 * /admin/musteriler/[id] sayfasında "Kontör ver" butonu da kaldırıldı
 * (page.tsx satır 221-222 yorumu). Yine de dosyayı silmek yerine
 * 410 Gone döndürerek;
 *   - eski client cache'leri net hata alır
 *   - geri-çağıran sürümlerde sessiz CSV indirme regression'ı önlenir
 *   - "neden böyle bir endpoint vardı" cevabı kodda kalır
 *
 * Müşteriye iyi niyet jesti için: /admin/kuponlar (coupon sistemi).
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export const runtime = "nodejs";

function gone() {
  return NextResponse.json(
    {
      error: "endpoint_deprecated",
      hint:
        "Cüzdan vizyonu kaldırıldı (Mig 015). Müşteriye iyi niyet jesti için /admin/kuponlar kullan.",
    },
    { status: 410 }
  );
}

async function guardedGone() {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return gone();
}

export async function GET() {
  return guardedGone();
}

export async function POST() {
  return guardedGone();
}

export async function PUT() {
  return guardedGone();
}

export async function PATCH() {
  return guardedGone();
}

export async function DELETE() {
  return guardedGone();
}
