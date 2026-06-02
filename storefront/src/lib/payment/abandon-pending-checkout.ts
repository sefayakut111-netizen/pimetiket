/**
 * Bekleyen PayTR oturumunu iptal et — kullanıcı /odeme'ye geri döndüğünde
 * yeni ödeme başlatabilsin.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function abandonPendingCheckoutForUser(
  userId: string
): Promise<{ abandoned: boolean; intentId?: string }> {
  const admin = createAdminClient();

  const { data: pending, error: fetchErr } = await admin
    .from("payment_intents")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr || !pending) {
    return { abandoned: false };
  }

  const { error: updateErr } = await admin
    .from("payment_intents")
    .update({
      status: "expired",
      failure_reason: "user_abandoned",
    })
    .eq("id", pending.id)
    .eq("status", "pending");

  if (updateErr) {
    console.error("[payment/abandon] update failed:", updateErr);
    return { abandoned: false };
  }

  return { abandoned: true, intentId: pending.id };
}
