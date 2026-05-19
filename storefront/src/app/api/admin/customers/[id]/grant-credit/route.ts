/**
 * POST /api/admin/customers/[id]/grant-credit
 *
 * **DEVRE DIŞI — 410 Gone.**
 *
 * Sefa 19 May v68 (Agent denetim P0 #4):
 * Anayasa "Cüzdan vizyonu yok" (Mig 015 ile kaldırıldı). Hediye kredi
 * de cüzdan demek — müşteri bakiye görürdü, anayasa kuralı delinirdi.
 * Endpoint hiç tamamlanmamıştı zaten (loyalty_gift_credits'e yazmıyordu
 * TODO ile bırakılmıştı), kullanılırsa sessiz başarı dönüp müşteri
 * krediyi göremezdi.
 *
 * Müşteriye iyi niyet jesti için → /admin/kuponlar (tek kullanım kod,
 * expire date, min sepet, vs.).
 *
 * loyalty_grants tablosu silinmiyor (geçmiş audit izi korunsun).
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export async function POST() {
  const auth = await assertAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(
    {
      error: "feature_disabled",
      detail:
        "Hediye kredi devre dışı (Anayasa: cüzdan vizyonu yok). " +
        "Müşteriye iyi niyet jesti için /admin/kuponlar'dan tek kullanımlık kupon üret.",
      replacement: "/admin/kuponlar",
    },
    { status: 410 }
  );
}
