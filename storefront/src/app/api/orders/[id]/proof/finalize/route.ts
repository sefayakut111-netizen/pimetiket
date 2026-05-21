/**
 * POST /api/orders/[id]/proof/finalize
 *
 * Sefa 19 May v68 (Migration 059):
 * Müşteri tüm itemleri onayladığında çağrılır (frontend allApproved=true
 * görünce). fn_finalize_proof RPC atomic state geçişi yapar:
 *   orders.status: proof_pending → proof_approved
 *
 * RPC fail koşulları (jsonb.ok=false döner):
 *   - pending_items: hala approved olmayan item var
 *   - open_help_requests: açık yardım ticket'ı var
 *   - invalid_status: sipariş bu aşamada değil
 *   - forbidden: sahip değil
 *   - order_not_found
 *
 * Sefa 21 May v68 — Faz 2: sendOrderProofApproved maili iptal edildi.
 * Müşteri butona bastığı an UI zaten "✅ Onayın alındı, üretime aldık,
 * ~5 iş günü içinde kargoda" feedback'i veriyor (response.newStatus +
 * /siparis/[id] sayfa refresh). Mail tekrarı = mail fatigue.
 *
 * Eski davranış için kod altta yorum olarak duruyor (geri açmak için
 * tek import + tek void çağrısı yeter).
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
// Faz 2 iptali: import { sendOrderProofApproved } from "@/lib/mail/notifications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc(
    "fn_finalize_proof" as never,
    { p_order_id: orderId } as never
  );

  if (error) {
    console.error("[proof/finalize] RPC error:", error);
    return NextResponse.json(
      { ok: false, error: "Finalize başarısız", detail: error.message },
      { status: 500 }
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    const errCode = (result.error as string) ?? "unknown";
    const statusCode =
      errCode === "order_not_found"
        ? 404
        : errCode === "forbidden"
          ? 403
          : 400;
    return NextResponse.json(
      { ok: false, error: errCode, ...result },
      { status: statusCode }
    );
  }

  // Sefa 21 May v68 — Faz 2: mail iptal. Müşteri UI'da onay aldı.
  // void sendOrderProofApproved({ userId: user.id, orderId }).catch((err) =>
  //   console.error("[proof/finalize] mail error:", err)
  // );

  return NextResponse.json({
    ok: true,
    newStatus: result.new_status,
    message:
      "✅ Onayın alındı. Üretime aldık — ~5 iş günü içinde kargoda olacak.",
  });
}
