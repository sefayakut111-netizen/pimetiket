import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";

type ProofAccessResult =
  | { ok: true; actor: "owner" | "admin" | "staff" | "partner" }
  | { ok: false; status: 401 | 403 | 404 };

type SimpleAccessResult =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404 };

/** Sipariş sahibi, admin/staff veya atanmış partner proof API'lerine erişebilir. */
export async function assertProofOrderAccess(
  admin: SupabaseClient<Database>,
  orderId: string,
  userId: string | undefined
): Promise<ProofAccessResult> {
  if (!userId) {
    return { ok: false, status: 401 };
  }

  const { data: order } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string } | null;
  if (!orderRow) {
    return { ok: false, status: 404 };
  }
  if (orderRow.user_id === userId) {
    return { ok: true, actor: "owner" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;

  if (role === "admin" || role === "staff") {
    return { ok: true, actor: role === "admin" ? "admin" : "staff" };
  }

  if (role === "partner") {
    const { data: contactRow } = await admin
      .from("partner_contacts")
      .select("partner_id")
      .eq("user_id", userId)
      .maybeSingle();
    const partnerId = (contactRow as { partner_id: string } | null)?.partner_id;
    if (!partnerId) {
      return { ok: false, status: 403 };
    }
    const asg = await assertActivePartnerAssignment(admin, orderId, partnerId);
    if (asg.ok) {
      return { ok: true, actor: "partner" };
    }
  }

  return { ok: false, status: 403 };
}

/** Partner, admin/staff — müşteri (sipariş sahibi dahil) hariç üretim indirme erişimi. */
export async function assertProductionExportAccess(
  admin: SupabaseClient<Database>,
  orderId: string,
  userId: string | undefined
): Promise<SimpleAccessResult> {
  if (!userId) {
    return { ok: false, status: 401 };
  }

  const { data: order } = await admin
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  const orderRow = order as { user_id: string } | null;
  if (!orderRow) {
    return { ok: false, status: 404 };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;

  if (role === "admin" || role === "staff") {
    return { ok: true };
  }

  if (role === "partner") {
    const { data: contactRow } = await admin
      .from("partner_contacts")
      .select("partner_id")
      .eq("user_id", userId)
      .maybeSingle();
    const partnerId = (contactRow as { partner_id: string } | null)?.partner_id;
    if (!partnerId) {
      return { ok: false, status: 403 };
    }
    const asg = await assertActivePartnerAssignment(admin, orderId, partnerId);
    if (asg.ok) {
      return { ok: true };
    }
  }

  return { ok: false, status: 403 };
}

export async function getCutlinePreviewKey(
  admin: SupabaseClient<Database>,
  orderId: string,
  itemId: string,
  designFileId: string | null
): Promise<string | null> {
  const baseQuery = admin
    .from("cutline_designs")
    .select("preview_png_url")
    .eq("order_id", orderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: cd } = designFileId
    ? await baseQuery.eq("design_file_id", designFileId).maybeSingle()
    : await baseQuery.maybeSingle();

  const key = (cd as { preview_png_url: string | null } | null)?.preview_png_url;
  return key && key.trim().length > 0 ? key : null;
}

export function parseDesignFileIdParam(
  dfParam: string | null
): string | null {
  if (
    dfParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      dfParam
    )
  ) {
    return dfParam;
  }
  return null;
}
