/**
 * Süresi dolmuş snoozed aksiyonları pending kuyruğuna geri al.
 *
 * Snooze kararı status='snoozed' yazar; süre dolunca otomatik
 * pending'e dönmeleri gerekir — bu helper bunu yapar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Süresi dolmuş snoozed kayıtları pending'e çevirir. Dönen: güncellenen satır sayısı. */
export async function unsnoozeExpiredActions(
  admin: SupabaseClient
): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("auditor_pending_actions")
    .update({ status: "pending" } as never)
    .eq("status", "snoozed")
    .lt("snooze_until", now)
    .select("id");

  if (error) {
    console.error("[unsnooze] update failed:", error.message);
    return 0;
  }

  return (data ?? []).length;
}
