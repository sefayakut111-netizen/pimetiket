/**
 * order_items.meta ↔ sepet satırı alan eşlemesi.
 * PayTR callback, admin bypass ve fn_create_order aynı shape kullanmalı.
 */

import type { CustomerCartItem } from "./customer-cart";

export type AdditionalDesignMeta = {
  tempId: string;
  previewUrl?: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
};

type CartMetaSource = {
  shape?: string;
  cut?: string;
  softCorners?: boolean;
  material?: string;
  finish?: string;
  hediyeAdet?: number;
  materialId?: string;
  coatingId?: string;
  customizationId?: string;
  winding?: number;
  coreSize?: number;
  rollLabelCount?: number;
  designCount?: number;
  designTempId?: string;
  designPreviewUrl?: string;
  designFileName?: string;
  designMimeType?: string;
  additionalDesigns?: CustomerCartItem["additionalDesigns"];
  meta?: Record<string, unknown>;
};

/** Sepet / intent snapshot satırından order_items.meta JSON üret. */
export function buildOrderItemMeta(item: CartMetaSource): Record<string, unknown> {
  const additionalDesigns = (item.additionalDesigns ?? []).filter(
    (d) => d.tempId && !d.tempId.startsWith("local-")
  );

  return {
    ...(item.meta ?? {}),
    shape: item.shape,
    cut: item.cut,
    softCorners: item.softCorners,
    material: item.material,
    finish: item.finish,
    hediyeAdet: item.hediyeAdet,
    materialId: item.materialId,
    coatingId: item.coatingId,
    customizationId: item.customizationId,
    winding: item.winding,
    coreSize: item.coreSize,
    rollLabelCount: item.rollLabelCount,
    designCount: item.designCount,
    designTempId:
      item.designTempId && !item.designTempId.startsWith("local-")
        ? item.designTempId
        : undefined,
    designPreviewUrl: item.designPreviewUrl,
    designFileName: item.designFileName,
    designMimeType: item.designMimeType,
    additionalDesigns:
      additionalDesigns.length > 0 ? additionalDesigns : undefined,
  };
}

/** meta içindeki tüm promote edilebilir temp UUID'leri (primary + ek tasarımlar). */
export function collectDesignTempIds(meta: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const primary = meta.designTempId;
  if (typeof primary === "string" && !primary.startsWith("local-")) {
    ids.push(primary);
  }
  const additional = meta.additionalDesigns;
  if (Array.isArray(additional)) {
    for (const entry of additional) {
      if (
        entry &&
        typeof entry === "object" &&
        "tempId" in entry &&
        typeof (entry as AdditionalDesignMeta).tempId === "string"
      ) {
        const tid = (entry as AdditionalDesignMeta).tempId;
        if (tid && !tid.startsWith("local-") && !ids.includes(tid)) {
          ids.push(tid);
        }
      }
    }
  }
  return ids;
}

export function orderItemHasDesigns(meta: Record<string, unknown>): boolean {
  return collectDesignTempIds(meta).length > 0;
}

/** meta.designCount + additionalDesigns ile beklenen tasarım sayısı. */
export function getExpectedDesignCount(
  meta: Record<string, unknown> | null | undefined,
  designsLength = 0
): number {
  const metaCount = Number(meta?.designCount) || 0;
  const additional = Array.isArray(meta?.additionalDesigns)
    ? meta.additionalDesigns.length
    : 0;
  const fromMeta = Math.max(metaCount, 1 + additional);
  return Math.max(fromMeta, designsLength, 1);
}

export function designHasCutline(
  cutline: { id?: string } | null | undefined
): boolean {
  return typeof cutline?.id === "string" && cutline.id.length > 0;
}

export function cutlineIsApproved(
  cutline: { status?: string } | null | undefined
): boolean {
  return (
    cutline?.status === "approved" || cutline?.status === "operator_override"
  );
}

/** Multi-design: item içindeki tüm tasarımlar müşteri tarafından onaylandı mı? */
export function itemAllDesignsApproved(item: {
  proof_status?: string;
  meta: Record<string, unknown> | null;
  designs?: Array<{ cutline?: { id?: string; status?: string } | null }>;
  cutline?: { id?: string; status?: string } | null;
}): boolean {
  const designs = item.designs ?? [];
  if (designs.length === 0) {
    return (
      item.proof_status === "approved" || cutlineIsApproved(item.cutline)
    );
  }
  const expected = getExpectedDesignCount(item.meta, designs.length);
  if (designs.length < expected) return false;
  return designs.every((d) => cutlineIsApproved(d.cutline));
}

/** Sipariş genelinde tüm tasarımlar onaylandı mı (finalize için). */
export function orderAllDesignsApproved(
  items: Array<{
    proof_status?: string;
    meta: Record<string, unknown> | null;
    designs?: Array<{ cutline?: { id?: string; status?: string } | null }>;
    cutline?: { id?: string; status?: string } | null;
  }>
): boolean {
  if (items.length === 0) return false;
  return items.every(
    (item) =>
      item.proof_status !== "help_requested" && itemAllDesignsApproved(item)
  );
}

/** Multi-design: tüm beklenen tasarımlar promote edilmiş ve bıçağı var mı? */
export function itemAllDesignsReady(item: {
  meta: Record<string, unknown> | null;
  designs: Array<{ cutline?: { id?: string } | null }>;
  cutline?: { id?: string } | null;
}): boolean {
  const designs = item.designs ?? [];
  const expected = getExpectedDesignCount(item.meta, designs.length);

  if (designs.length === 0) {
    return designHasCutline(item.cutline);
  }

  if (designs.length < expected) {
    return false;
  }

  return designs.every((d) => designHasCutline(d.cutline));
}
