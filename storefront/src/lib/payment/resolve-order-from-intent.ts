/**
 * payment_intents.order_id eksik olsa bile payments tablosundan sipariş bulur
 * ve intent'i backfill eder (POST callback kısmi tamamlanma / eski kayıtlar).
 */

import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function resolveOrderIdFromIntent(
  admin: AdminClient,
  merchantOid: string,
  intentOrderId: string | null | undefined
): Promise<string | null> {
  if (intentOrderId) return intentOrderId;

  const { data: paymentRow } = await admin
    .from("payments")
    .select("order_id")
    .eq("psp_transaction_id", merchantOid)
    .eq("action", "charge")
    .eq("status", "success")
    .maybeSingle();

  const orderId = (paymentRow as { order_id?: string } | null)?.order_id ?? null;
  if (!orderId) return null;

  await admin
    .from("payment_intents")
    .update({ order_id: orderId })
    .eq("id", merchantOid);

  return orderId;
}
