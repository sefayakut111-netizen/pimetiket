/**
 * POST /api/orders/[id]/proof/finalize
 *
 * Sefa 19 May v68 (Migration 059):
 * Müşteri tüm itemleri onayladığında çağrılır (frontend allApproved=true
 * görünce). fn_finalize_proof RPC atomic state geçişi yapar:
 *   orders.status: proof_pending → proof_approved → operator_print_review (FAZ 1b)
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

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
// Faz 2 iptali: import { sendOrderProofApproved } from "@/lib/mail/notifications";
import { generatePrintReadyForOrder } from "@/lib/proof/print-ready";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data, error } = await supabase.rpc("fn_finalize_proof", {
    p_order_id: orderId,
  });

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

  const adminClient = createAdminClient();
  const { error: reviewErr } = await adminClient
    .from("orders")
    .update({ status: "operator_print_review" })
    .eq("id", orderId)
    .eq("status", "proof_approved");

  if (reviewErr) {
    console.error(
      "[proof/finalize] operator_print_review update failed:",
      reviewErr
    );
    return NextResponse.json(
      { ok: false, error: "status_update_failed", detail: reviewErr.message },
      { status: 500 }
    );
  }

  void generatePrintReadyForOrder(orderId)
    .then(async ({ errors, generated }) => {
      if (errors.length === 0) return;
      console.warn("[proof/finalize] print-ready partial:", errors);
      Sentry.captureMessage("Print-ready PDF generation failed", {
        level: "warning",
        extra: { orderId, errorCount: errors.length, generated },
      });
      await adminClient.from("order_events").insert([
        {
          order_id: orderId,
          event_type: "print_ready_failed",
          status_after: "operator_print_review",
          actor_role: "system",
          summary: `Print-ready PDF üretilemedi (${errors.length} kalem)`,
          detail: { errors: errors.slice(0, 10), generated },
        },
      ]);
    })
    .catch(async (err) => {
      console.error("[proof/finalize] print-ready:", err);
      Sentry.captureException(err, { extra: { orderId } });
      await adminClient.from("order_events").insert([
        {
          order_id: orderId,
          event_type: "print_ready_failed",
          status_after: "operator_print_review",
          actor_role: "system",
          summary: "Print-ready PDF üretimi beklenmedik hata",
          detail: {
            error: err instanceof Error ? err.message : String(err),
          },
        },
      ]);
    });

  return NextResponse.json({
    ok: true,
    newStatus: "operator_print_review",
    message:
      "✅ Onayın alındı. Baskı öncesi son kontrolden geçiyor — operatörümüz onaylayınca üretime alınacak.",
  });
}
