"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { FasonPartner } from "@/components/admin/fason/fason-types";
import {
  FASON_MATERIAL_LABELS,
  FASON_PRODUCT_LABELS,
  FASON_PRODUCT_MATERIALS,
  FASON_PRODUCT_TYPES,
  getCapabilityRecord,
  materialsForProduct,
  parsePartnerCapabilities,
  resolveApprovalStatus,
  setMaterialsForProduct,
  toggleProductType,
  type CapabilityApprovalStatus,
  type FasonMaterial,
  type FasonProductType,
} from "@/components/admin/fason/fason-capabilities";
import { ProductMaterialPicker } from "@/components/admin/fason/product-material-picker";

function ApprovalBadge({ status }: { status: CapabilityApprovalStatus }) {
  const map = {
    approved: {
      label: "Onayli",
      className: "bg-yesil-soft text-yesil ring-yesil/30",
    },
    pending: {
      label: "Beklemede",
      className: "bg-sari-soft text-sari-koyu ring-sari/30",
    },
    rejected: {
      label: "Ret",
      className: "bg-kirmizi-soft text-kirmizi ring-kirmizi/30",
    },
  } as const;
  const meta = map[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[10px] font-semibold ring-1",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

function CapabilityApprovalActions({
  partnerId,
  capabilityId,
  status,
  onUpdated,
}: {
  partnerId: string;
  capabilityId: string;
  status: CapabilityApprovalStatus;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (next: CapabilityApprovalStatus) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${partnerId}/capabilities/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ capabilityId, status: next }),
        }
      );
      if (res.ok) onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {status !== "approved" && (
        <button
          type="button"
          disabled={busy}
          title="Onayla"
          onClick={() => void setStatus("approved")}
          className="h-7 w-7 rounded-md hover:bg-yesil-soft text-yesil flex items-center justify-center disabled:opacity-50"
        >
          <Icon.Check size={14} />
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          disabled={busy}
          title="Ret"
          onClick={() => void setStatus("rejected")}
          className="h-7 w-7 rounded-md hover:bg-kirmizi-soft text-kirmizi flex items-center justify-center disabled:opacity-50"
        >
          <Icon.X size={14} />
        </button>
      )}
      {status === "rejected" && (
        <button
          type="button"
          disabled={busy}
          title="Beklemeye al"
          onClick={() => void setStatus("pending")}
          className="h-7 px-2 rounded-md text-[10px] font-semibold hover:bg-gri-100 text-gri-700 disabled:opacity-50"
        >
          Beklemede
        </button>
      )}
    </div>
  );
}

export function PartnerCapacityPanel({
  partner,
  onUpdated,
}: {
  partner: FasonPartner;
  onUpdated: (p: FasonPartner) => void;
}) {
  const parsed = parsePartnerCapabilities(partner.capabilities);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productTypes, setProductTypes] = useState(parsed.productTypes);
  const [materials, setMaterials] = useState(parsed.materials);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<FasonProductType, boolean>>({
    sticker: true,
    roll_label: true,
    sheet_label: true,
  });

  useEffect(() => {
    const next = parsePartnerCapabilities(partner.capabilities);
    setProductTypes(next.productTypes);
    setMaterials(next.materials);
  }, [partner.capabilities]);

  const reloadPartner = useCallback(async () => {
    const res = await fetch("/api/admin/fason/partners", { cache: "no-store" });
    const json = (await res.json()) as { partners?: FasonPartner[] };
    const found = (json.partners ?? []).find((p) => p.id === partner.id);
    if (found) onUpdated(found);
  }, [onUpdated, partner.id]);

  const cancelEdit = () => {
    const next = parsePartnerCapabilities(partner.capabilities);
    setProductTypes(next.productTypes);
    setMaterials(next.materials);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setError(null);
    if (productTypes.length === 0) {
      setError("En az 1 urun grubu secilmeli");
      return;
    }
    for (const pt of productTypes) {
      const selected = materialsForProduct(pt, materials);
      if (selected.length === 0) {
        setError(`${FASON_PRODUCT_LABELS[pt]} icin en az 1 malzeme secin`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/fason/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productTypes, materials }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        capabilities?: FasonPartner["capabilities"];
      };
      if (!res.ok) {
        setError(json.error ?? "Kaydedilemedi");
        return;
      }
      onUpdated({
        ...partner,
        capabilities: json.capabilities ?? partner.capabilities,
      });
      setEditing(false);
      void reloadPartner();
    } finally {
      setSaving(false);
    }
  };

  const togglePt = (pt: FasonProductType) => {
    const next = toggleProductType(productTypes, materials, pt);
    setProductTypes(next.productTypes);
    setMaterials(next.materials);
    setExpanded((e) => ({ ...e, [pt]: true }));
  };

  const toggleExpanded = (pt: FasonProductType) => {
    setExpanded((e) => ({ ...e, [pt]: !e[pt] }));
  };

  return (
    <section className="pt-4 border-t border-gri-100">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-bold uppercase text-gri-500">
          Yetenekler
        </h3>
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Duzenle
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={cancelEdit}
            >
              Iptal
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "..." : "Kaydet"}
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-kirmizi mb-2">{error}</p>}

      <div className="space-y-2">
        {FASON_PRODUCT_TYPES.map((pt) => {
          const active = productTypes.includes(pt);
          const selectedMats = materialsForProduct(pt, materials);
          const isOpen = expanded[pt] ?? active;

          return (
            <div
              key={pt}
              className={cn(
                "rounded-lg ring-1 overflow-hidden",
                active ? "ring-gri-200 bg-white" : "ring-gri-100 bg-gri-50/50"
              )}
            >
              <div className="flex items-center gap-2">
                {editing ? (
                  <button
                    type="button"
                    onClick={() => togglePt(pt)}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors",
                      active ? "text-lacivert" : "text-gri-600"
                    )}
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        active
                          ? "bg-lacivert border-lacivert text-white"
                          : "border-gri-300 bg-white"
                      )}
                    >
                      {active && <Icon.Check size={10} />}
                    </span>
                    {FASON_PRODUCT_LABELS[pt]}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => active && toggleExpanded(pt)}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-[12.5px] font-semibold",
                      active ? "text-lacivert" : "text-gri-500"
                    )}
                  >
                    {active ? (
                      <Icon.ChevR
                        size={14}
                        className={cn(
                          "shrink-0 transition-transform rotate-90",
                          isOpen ? "rotate-[270deg]" : ""
                        )}
                      />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    {FASON_PRODUCT_LABELS[pt]}
                    {!active && (
                      <span className="text-[10px] font-normal text-gri-400">
                        (pasif)
                      </span>
                    )}
                  </button>
                )}

                {active && !editing && (() => {
                  const cap = getCapabilityRecord(
                    partner.capabilities ?? [],
                    "product_type",
                    pt
                  );
                  if (!cap?.id) return null;
                  const status = resolveApprovalStatus(cap);
                  return (
                    <div className="flex items-center gap-1 pr-2">
                      <ApprovalBadge status={status} />
                      <CapabilityApprovalActions
                        partnerId={partner.id}
                        capabilityId={cap.id}
                        status={status}
                        onUpdated={() => void reloadPartner()}
                      />
                    </div>
                  );
                })()}
              </div>

              {active && (editing || isOpen) && (
                <div className="px-3 pb-3 pt-1 border-t border-gri-100">
                  {editing ? (
                    <ProductMaterialPicker
                      productLabel={`${FASON_PRODUCT_LABELS[pt]} malzemeleri`}
                      options={FASON_PRODUCT_MATERIALS[pt]}
                      selected={selectedMats}
                      onChange={(next) =>
                        setMaterials(setMaterialsForProduct(pt, materials, next))
                      }
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {selectedMats.map((m) => {
                        const cap = getCapabilityRecord(
                          partner.capabilities ?? [],
                          "material",
                          m
                        );
                        const status = cap
                          ? resolveApprovalStatus(cap)
                          : "pending";
                        return (
                          <li
                            key={m}
                            className="flex items-center justify-between gap-2 rounded-md bg-gri-50 px-2 py-1.5"
                          >
                            <span className="text-[12px] font-medium text-lacivert">
                              {FASON_MATERIAL_LABELS[m]}
                            </span>
                            <div className="flex items-center gap-1">
                              <ApprovalBadge status={status} />
                              {cap?.id && (
                                <CapabilityApprovalActions
                                  partnerId={partner.id}
                                  capabilityId={cap.id}
                                  status={status}
                                  onUpdated={() => void reloadPartner()}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
