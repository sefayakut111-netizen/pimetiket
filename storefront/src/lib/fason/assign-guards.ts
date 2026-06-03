import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_MAX_CONCURRENT_ORDERS } from "@/components/admin/fason/fason-types";
import {
  mapOrderItemToCapability,
  partnerHasApprovedCapability,
  type CapabilityApprovalStatus,
} from "@/components/admin/fason/fason-capabilities";
import { ACTIVE_ASSIGNMENT_STATUS_LIST } from "./active-assignment-statuses";

type AdminClient = SupabaseClient<Database>;

export type AssignGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function fetchActiveOrderCountByPartner(
  admin: AdminClient,
  partnerIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (partnerIds.length === 0) return map;

  const { data, error } = await admin
    .from("order_assignments")
    .select("fason_partner_id")
    .in("fason_partner_id", partnerIds)
    .in("status", [...ACTIVE_ASSIGNMENT_STATUS_LIST]);

  if (error) {
    console.error("[fason] active order count error:", error);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.fason_partner_id;
    if (id) map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function assertAssignCapacityGuard(
  admin: AdminClient,
  fasonPartnerId: string
): Promise<AssignGuardResult> {
  const { data: partner, error: pErr } = await admin
    .from("fason_partners")
    .select("max_concurrent_orders")
    .eq("id", fasonPartnerId)
    .maybeSingle();

  if (pErr || !partner) {
    return { ok: false, status: 404, error: "Fason bulunamadı" };
  }

  const max =
    (partner as { max_concurrent_orders?: number | null }).max_concurrent_orders ??
    DEFAULT_MAX_CONCURRENT_ORDERS;

  const { count, error: cErr } = await admin
    .from("order_assignments")
    .select("id", { count: "exact", head: true })
    .eq("fason_partner_id", fasonPartnerId)
    .in("status", [...ACTIVE_ASSIGNMENT_STATUS_LIST]);

  if (cErr) {
    console.error("[fason/assign] capacity count error:", cErr);
    return { ok: false, status: 500, error: "Kapasite kontrolü başarısız" };
  }

  const active = count ?? 0;
  if (active >= max) {
    return {
      ok: false,
      status: 409,
      error: `Partner kapasitesi dolu (${active}/${max} aktif iş) — başka partner seç veya mevcut işleri tamamla.`,
    };
  }

  return { ok: true };
}

export async function assertAssignCapabilityGuard(
  admin: AdminClient,
  fasonPartnerId: string,
  orderId: string
): Promise<AssignGuardResult> {
  const { data: items, error: iErr } = await admin
    .from("order_items")
    .select("product, meta")
    .eq("order_id", orderId)
    .order("id", { ascending: true })
    .limit(1);

  if (iErr) {
    console.error("[fason/assign] order items error:", iErr);
    return { ok: false, status: 500, error: "Sipariş kalemi okunamadı" };
  }

  const first = items?.[0];
  if (!first) {
    console.warn(
      `[fason/assign] capability guard skipped: no items for order ${orderId}`
    );
    return { ok: true };
  }

  const product = String(first.product ?? "");
  if (product !== "etiket" && product !== "sticker") {
    console.warn(
      `[fason/assign] capability guard skipped: unknown product "${product}" order ${orderId}`
    );
    return { ok: true };
  }

  const meta = (first.meta ?? {}) as Record<string, unknown>;
  const { productType, material } = mapOrderItemToCapability(product, {
    material: typeof meta.material === "string" ? meta.material : undefined,
    materialId:
      typeof meta.materialId === "string" ? meta.materialId : undefined,
    formFactor: String(meta.formFactor ?? ""),
  });

  const { data: capabilities, error: capErr } = await admin
    .from("partner_capabilities")
    .select("capability_type, capability_value, is_verified, approval_status")
    .eq("partner_id", fasonPartnerId);

  if (capErr) {
    console.error("[fason/assign] capabilities error:", capErr);
    return { ok: false, status: 500, error: "Yetkinlik kontrolü başarısız" };
  }

  const match = partnerHasApprovedCapability(
    (capabilities ?? []).map((c) => ({
      capability_type: c.capability_type,
      capability_value: c.capability_value,
      is_verified: c.is_verified,
      approval_status: c.approval_status as CapabilityApprovalStatus | undefined,
    })),
    productType,
    material
  );

  if (!match.ok) {
    return {
      ok: false,
      status: 400,
      error: "Partner bu ürün/malzeme için onaylı değil (yetkinlik eksik).",
    };
  }

  return { ok: true };
}
