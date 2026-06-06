import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { assertActivePartnerAssignment } from "@/lib/fason/assert-active-partner-assignment";

type DesignFileRow = {
  storage_path: string;
  mime_type: string;
  original_name: string;
  status: string;
};

export type ResolveDesignFileResult =
  | { ok: true; canonicalOrderId: string; file: DesignFileRow }
  | { ok: false; status: 401 | 403 | 404; error: string };

/** design-url + design-file proxy için ortak auth + design_files lookup. */
export async function resolveOrderDesignFile(
  admin: SupabaseClient<Database>,
  orderId: string,
  itemId: string,
  userId: string | undefined,
  designFileId: string | null
): Promise<ResolveDesignFileResult> {
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, user_id")
    .ilike("id", orderId)
    .maybeSingle();
  const orderRow = order as { id: string; user_id: string } | null;
  if (!orderRow) {
    return { ok: false, status: 404, error: "Sipariş bulunamadı" };
  }

  const canonicalOrderId = orderRow.id;
  if (orderRow.user_id !== userId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;

    if (role === "admin" || role === "staff") {
      // OK
    } else if (role === "partner") {
      const { data: contactRow } = await admin
        .from("partner_contacts")
        .select("partner_id")
        .eq("user_id", userId)
        .maybeSingle();
      const partnerId = (contactRow as { partner_id: string } | null)
        ?.partner_id;
      if (!partnerId) {
        return { ok: false, status: 403, error: "Forbidden" };
      }
      const asg = await assertActivePartnerAssignment(
        admin,
        canonicalOrderId,
        partnerId
      );
      if (!asg.ok) {
        return { ok: false, status: 403, error: "not_your_order" };
      }
    } else {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }

  const baseQuery = admin
    .from("design_files")
    .select("storage_path, mime_type, original_name, status")
    .eq("order_id", canonicalOrderId)
    .eq("order_item_id", itemId)
    .neq("status", "superseded");

  const { data: df } = designFileId
    ? await baseQuery.eq("id", designFileId).maybeSingle()
    : await baseQuery.order("version", { ascending: false }).limit(1).maybeSingle();

  const dfRow = df as DesignFileRow | null;
  if (!dfRow) {
    return { ok: false, status: 404, error: "Tasarım bulunamadı" };
  }

  return { ok: true, canonicalOrderId, file: dfRow };
}

export function parseDesignFileIdQuery(
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
