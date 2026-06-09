import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ACTIVE_ASSIGNMENT_STATUS_LIST } from "@/lib/fason/active-assignment-statuses";

export type ActivePartnerAssignmentRow = {
  id: string;
  fason_partner_id: string;
  status: string;
  assigned_at?: string | null;
  estimated_delivery?: string | null;
  in_production_at?: string | null;
  ready_at?: string | null;
  shipped_at?: string | null;
  notes?: string | null;
};

/**
 * Aktif fason ataması doğrulama — cancelled/shipped eski partner erişimini engeller.
 * order_id + fason_partner_id + status IN ACTIVE_ASSIGNMENT_STATUS_LIST.
 */
export async function assertActivePartnerAssignment<
  T extends ActivePartnerAssignmentRow = ActivePartnerAssignmentRow,
>(
  admin: SupabaseClient<Database>,
  orderId: string,
  partnerId: string,
  select = "id, fason_partner_id, status"
): Promise<{ ok: true; assignment: T } | { ok: false }> {
  const { data: asgRow } = await admin
    .from("order_assignments")
    .select(select)
    .eq("order_id", orderId)
    .eq("fason_partner_id", partnerId)
    .in("status", [...ACTIVE_ASSIGNMENT_STATUS_LIST])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!asgRow) {
    return { ok: false };
  }

  return { ok: true, assignment: asgRow as unknown as T };
}
