import type { SupabaseClient } from "@supabase/supabase-js";

interface KvkkDeleteRow {
  id: string;
  kind: string;
  status: string;
  grace_period_until: string | null;
  cancelled_at: string | null;
}

export type KvkkDeleteEligibility =
  | { ok: true; requestId: string }
  | { ok: false; error: string; status: number };

/**
 * R2 arşiv silme yalnızca onaylı KVKK talebi + grace süresi dolduktan sonra.
 */
export async function assertKvkkR2DeleteEligible(
  admin: SupabaseClient,
  targetUserId: string,
  kind: "account_delete" | "partial_delete"
): Promise<KvkkDeleteEligibility> {
  const { data, error } = await admin
    .from("kvkk_requests")
    .select("id, kind, status, grace_period_until, cancelled_at")
    .eq("user_id", targetUserId)
    .eq("kind", kind)
    .in("status", ["confirmed", "processing", "completed"])
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[kvkk/delete-eligibility]", error);
    return {
      ok: false,
      error: "KVKK talebi doğrulanamadı",
      status: 500,
    };
  }

  const row = data as KvkkDeleteRow | null;
  if (!row) {
    return {
      ok: false,
      error: "Onaylı KVKK silme talebi bulunamadı",
      status: 403,
    };
  }

  if (row.cancelled_at) {
    return {
      ok: false,
      error: "Silme talebi iptal edilmiş",
      status: 403,
    };
  }

  const graceUntil = row.grace_period_until
    ? new Date(row.grace_period_until).getTime()
    : null;
  const graceExpired = graceUntil !== null && graceUntil <= Date.now();

  if (row.status === "confirmed" && !graceExpired) {
    return {
      ok: false,
      error: "48 saatlik geri alma süresi henüz dolmadı",
      status: 403,
    };
  }

  return { ok: true, requestId: row.id };
}
