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
  materialsForProduct,
  parsePartnerCapabilities,
  setMaterialsForProduct,
  toggleProductType,
  type FasonMaterial,
  type FasonProductType,
} from "@/components/admin/fason/fason-capabilities";

function MaterialChip({
  label,
  selected,
  interactive,
  onClick,
}: {
  label: string;
  selected: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors",
    selected
      ? "bg-pim-mercan text-white"
      : "bg-gri-100 text-gri-600",
    interactive && "cursor-pointer hover:ring-1 hover:ring-pim-mercan/40"
  );
  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {label}
      </button>
    );
  }
  return <span className={className}>{label}</span>;
}

function ProductMaterialEditor({
  productType,
  materials,
  onChange,
}: {
  productType: FasonProductType;
  materials: FasonMaterial[];
  onChange: (next: FasonMaterial[]) => void;
}) {
  const options = FASON_PRODUCT_MATERIALS[productType];
  const selected = materialsForProduct(productType, materials);
  const allSelected =
    options.length > 0 && options.every((m) => selected.includes(m));

  return (
    <div className="ml-6 mt-2 space-y-2 border-l-2 border-gri-200 pl-3">
      <div className="flex flex-wrap gap-1.5">
        <MaterialChip
          label="Tumu"
          selected={allSelected}
          interactive
          onClick={() => onChange(allSelected ? [] : [...options])}
        />
        {options.map((m) => (
          <MaterialChip
            key={m}
            label={FASON_MATERIAL_LABELS[m]}
            selected={selected.includes(m)}
            interactive
            onClick={() =>
              onChange(
                selected.includes(m)
                  ? selected.filter((x) => x !== m)
                  : [...selected, m]
              )
            }
          />
        ))}
      </div>
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

  useEffect(() => {
    const next = parsePartnerCapabilities(partner.capabilities);
    setProductTypes(next.productTypes);
    setMaterials(next.materials);
  }, [partner.capabilities]);

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
      const nextCaps = [
        ...productTypes.map((v) => ({
          id: `pt-${v}`,
          capability_type: "product_type" as const,
          capability_value: v,
          is_verified: true,
        })),
        ...materials.map((v) => ({
          id: `mat-${v}`,
          capability_type: "material" as const,
          capability_value: v,
          is_verified: true,
        })),
      ];
      onUpdated({ ...partner, capabilities: json.capabilities ?? nextCaps });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const togglePt = (pt: FasonProductType) => {
    const next = toggleProductType(productTypes, materials, pt);
    setProductTypes(next.productTypes);
    setMaterials(next.materials);
  };

  return (
    <section className="pt-4 border-t border-gri-100">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-bold uppercase text-gri-500">
          Kapasite
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

      {error && (
        <p className="text-[11px] text-kirmizi mb-2">{error}</p>
      )}

      <div className="space-y-3">
        {FASON_PRODUCT_TYPES.map((pt) => {
          const active = productTypes.includes(pt);
          const selectedMats = materialsForProduct(pt, materials);
          const options = FASON_PRODUCT_MATERIALS[pt];
          const allSelected =
            active &&
            options.length > 0 &&
            options.every((m) => selectedMats.includes(m));

          return (
            <div key={pt}>
              {editing ? (
                <button
                  type="button"
                  onClick={() => togglePt(pt)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold transition-colors",
                    active
                      ? "bg-lacivert text-white"
                      : "bg-gri-50 text-gri-700 ring-1 ring-gri-200 hover:ring-lacivert"
                  )}
                >
                  {active && <Icon.Check size={14} className="shrink-0" />}
                  {FASON_PRODUCT_LABELS[pt]}
                </button>
              ) : (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold",
                    active
                      ? "bg-lacivert text-white"
                      : "bg-gri-50 text-gri-500 ring-1 ring-gri-200"
                  )}
                >
                  {active && <Icon.Check size={14} className="shrink-0" />}
                  {FASON_PRODUCT_LABELS[pt]}
                </div>
              )}

              {active && editing && (
                <ProductMaterialEditor
                  productType={pt}
                  materials={materials}
                  onChange={(next) =>
                    setMaterials(setMaterialsForProduct(pt, materials, next))
                  }
                />
              )}

              {active && !editing && (
                <div className="ml-6 mt-2 flex flex-wrap gap-1.5 border-l-2 border-gri-200 pl-3">
                  {allSelected ? (
                    <MaterialChip label="Tumu" selected />
                  ) : null}
                  {options.map((m) => (
                    <MaterialChip
                      key={m}
                      label={FASON_MATERIAL_LABELS[m]}
                      selected={selectedMats.includes(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
