import type { SupabaseClient } from "@supabase/supabase-js";

/** Mig 045 trigger + admin tracking çakışması penceresi */
export const SHIPPED_MAIL_LOOKBACK_MS = 60 * 60 * 1000;

const SHIPPED_TEMPLATE_KEYS = new Set(["customer_shipped"]);

function isShippedOutboxRow(row: {
  template_key: string;
  payload: Record<string, unknown> | null;
}): boolean {
  if (SHIPPED_TEMPLATE_KEYS.has(row.template_key)) return true;
  if (
    row.template_key === "_prerendered" &&
    row.payload?._kind === "order_shipped"
  ) {
    return true;
  }
  return false;
}

/** Son 1 saatte bu sipariş için kargoya-verildi maili kuyruğa alınmış mı? */
export async function hasRecentCustomerShippedMail(
  supabase: SupabaseClient,
  orderId: string,
  lookbackMs = SHIPPED_MAIL_LOOKBACK_MS
): Promise<boolean> {
  const since = new Date(Date.now() - lookbackMs).toISOString();

  const { data, error } = await supabase
    .from("fason_mail_outbox")
    .select("id, template_key, payload")
    .eq("target_type", "order")
    .eq("target_id", orderId)
    .gte("created_at", since);

  if (error) {
    console.warn("[shipped-mail-guard] outbox lookup failed:", error.message);
    return false;
  }

  return (data ?? []).some((row) =>
    isShippedOutboxRow(
      row as { template_key: string; payload: Record<string, unknown> | null }
    )
  );
}

/** Siparişte fason partner ataması var mı (manuel kargo değil)? */
export async function hasFasonAssignment(
  supabase: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("order_assignments")
    .select("id")
    .eq("order_id", orderId)
    .not("fason_partner_id", "is", null)
    .limit(1);

  if (error) {
    console.warn("[shipped-mail-guard] assignment lookup failed:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Fason shipped trigger zaten mail kuyrukladıysa admin tracking'den
 * ikinci kargo maili gönderme.
 */
export async function shouldSkipAdminOrderShippedMail(
  supabase: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const [fason, recent] = await Promise.all([
    hasFasonAssignment(supabase, orderId),
    hasRecentCustomerShippedMail(supabase, orderId),
  ]);
  return fason && recent;
}
