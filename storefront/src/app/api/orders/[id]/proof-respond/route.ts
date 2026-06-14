/**
 * /api/orders/[id]/proof-respond — KALDIRILDI (legacy).
 *
 * Kanonik müşteri prova onayı: /onay → finalize/route.ts → fn_finalize_proof
 * (proof_pending → proof_approved → operator_print_review).
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Bu uç kullanımdan kaldırıldı. Prova onayı /onay sayfasından yapılır.",
    },
    { status: 410 }
  );
}
