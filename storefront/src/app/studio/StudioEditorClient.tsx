"use client";

/**
 * /studio — Aşama 1: iskelet + tek-state reactive + anlık fiyat.
 * Kapalı devre: ENABLE_STUDIO_EDITOR flag ile guard.
 * Mevcut motorlar reuse: getLivePricingConfig + quoteStickerFromConfig.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClampedNumberInput } from "@/components/ClampedNumberInput";
import { Icon } from "@/components/Icon";
import { FormSection, SelectableCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { quoteStickerFromConfig } from "@/lib/customer-pricing-from-config";
import { formatPrice, formatUnitPrice } from "@/lib/format/price";
import { getActiveMaterials } from "@/lib/pricing-materials";
import { getLivePricingConfig } from "@/lib/pricing-config-client";
import type { ProfileConfig } from "@/lib/pricing-config-types";
import {
  CUSTOMER_STICKER_TIERS,
  STICKER_MAX_H,
  STICKER_MAX_W,
  STICKER_MIN_DIM,
  STICKER_MIN_QTY,
  STICKER_MAX_QTY,
  STICKER_QTY_STEP,
  type StickerFinish,
  type StickerMaterial,
} from "@/lib/sticker-customer-pricing";

// ============================================================
// Types + defaults
// ============================================================

export type StudioShape = "contour" | "square" | "circle" | "rounded";

export interface StudioState {
  shape: StudioShape;
  width: number;
  height: number;
  material: StickerMaterial;
  finish: StickerFinish;
  qty: number;
  lockRatio: boolean;
}

const MATERIAL_IDS = ["vinil", "transparan", "holo", "simli"] as const;
const FINISH_IDS = ["parlak", "mat", "yok"] as const;

const SHAPE_OPTIONS: { id: StudioShape; label: string; icon: string }[] = [
  { id: "contour", label: "Kontur", icon: "✂️" },
  { id: "square", label: "Kare", icon: "⬜" },
  { id: "circle", label: "Yuvarlak", icon: "⚪" },
  { id: "rounded", label: "Yumuşak köşe", icon: "▢" },
];

const DEFAULT_STATE: StudioState = {
  shape: "square",
  width: 75,
  height: 75,
  material: "vinil",
  finish: "parlak",
  qty: 100,
  lockRatio: true,
};

function isRatioLockedShape(shape: StudioShape): boolean {
  return shape === "square" || shape === "circle";
}

function patchStudioState(
  prev: StudioState,
  patch: Partial<StudioState>
): StudioState {
  let next: StudioState = { ...prev, ...patch };

  if (patch.shape !== undefined) {
    if (isRatioLockedShape(patch.shape)) {
      const side = Math.max(next.width, next.height);
      next = { ...next, lockRatio: true, width: side, height: side };
    } else if (patch.shape === "rounded") {
      next = { ...next, lockRatio: prev.lockRatio };
    }
  }

  if (patch.width !== undefined && next.lockRatio && patch.height === undefined) {
    if (isRatioLockedShape(next.shape)) {
      next = { ...next, height: patch.width };
    } else if (prev.width > 0) {
      const ratio = prev.height / prev.width;
      next = { ...next, height: Math.round(patch.width * ratio) };
    }
  }

  if (patch.height !== undefined && next.lockRatio && patch.width === undefined) {
    if (isRatioLockedShape(next.shape)) {
      next = { ...next, width: patch.height };
    } else if (prev.height > 0) {
      const ratio = prev.width / prev.height;
      next = { ...next, width: Math.round(patch.height * ratio) };
    }
  }

  if (patch.lockRatio === true && !isRatioLockedShape(next.shape)) {
    // Oran kilidi açıldığında mevcut oran korunur — ek işlem gerekmez.
  }

  return next;
}

// ============================================================
// Component
// ============================================================

export default function StudioEditorClient() {
  const [state, setState] = useState<StudioState>(DEFAULT_STATE);
  const [adminConfig, setAdminConfig] = useState<ProfileConfig | null>(null);
  const [customQty, setCustomQty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLivePricingConfig("sticker").then((cfg) => {
      if (!cancelled) setAdminConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback((patchValues: Partial<StudioState>) => {
    setState((prev) => patchStudioState(prev, patchValues));
  }, []);

  const materials = useMemo(() => {
    if (!adminConfig?.materials) {
      return MATERIAL_IDS.map((id) => ({ id, name: id }));
    }
    const active = getActiveMaterials(adminConfig)
      .map((m) => ({ id: m.id as StickerMaterial, name: m.name ?? m.id }))
      .filter((m) => (MATERIAL_IDS as readonly string[]).includes(m.id));
    const defined = new Set(active.map((m) => m.id));
    const missing = MATERIAL_IDS.filter((id) => !defined.has(id)).map(
      (id) => ({ id, name: id })
    );
    return [...active, ...missing];
  }, [adminConfig]);

  const finishes = useMemo(() => {
    const items = adminConfig?.options?.finish?.items;
    if (!items) {
      return FINISH_IDS.map((id) => ({
        id,
        name: id === "parlak" ? "Parlak" : id === "mat" ? "Mat" : "Kaplamasız",
      }));
    }
    const active = items
      .map((i) => ({
        id: i.id as StickerFinish,
        name: i.name ?? i.id,
      }))
      .filter((f) => (FINISH_IDS as readonly string[]).includes(f.id));
    const defined = new Set(active.map((f) => f.id));
    const missing = FINISH_IDS.filter((id) => !defined.has(id)).map((id) => ({
      id,
      name: id === "parlak" ? "Parlak" : id === "mat" ? "Mat" : "Kaplamasız",
    }));
    return [...active, ...missing];
  }, [adminConfig]);

  const quote = useMemo(() => {
    if (!adminConfig) return null;
    return quoteStickerFromConfig(adminConfig, {
      width: state.width,
      height: state.height,
      material: state.material,
      finish: state.finish,
      qty: state.qty,
      cut: "diecut",
    });
  }, [adminConfig, state.width, state.height, state.material, state.finish, state.qty]);

  const priceError = quote && !quote.ok ? quote.reason : null;

  return (
    <main className="flex flex-col h-[calc(100vh-64px)] bg-gri-50">
      <header className="shrink-0 border-b border-gri-200 bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-lacivert">Studio</h1>
          <p className="text-[12px] text-gri-500">Kapalı devre · Aşama 1</p>
        </div>
        <span className="text-[11px] font-medium text-gri-500 bg-gri-100 px-2 py-1 rounded-md">
          Önizleme & sepet — sonraki aşama
        </span>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] xl:grid-cols-[220px_1fr_360px] min-h-0">
        {/* Sol — araç placeholder */}
        <aside className="hidden lg:flex flex-col border-r border-gri-200 bg-white p-4 gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-400">
            Araçlar
          </p>
          {["Tasarım", "Metin", "Şekil", "Katman"].map((tool) => (
            <div
              key={tool}
              className="rounded-lg border border-dashed border-gri-200 px-3 py-2.5 text-[13px] text-gri-400"
            >
              {tool}
            </div>
          ))}
        </aside>

        {/* Orta — önizleme placeholder */}
        <section className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gri-200">
          <div className="flex-1 flex items-center justify-center p-6 min-h-[240px] lg:min-h-0">
            <div className="w-full max-w-md aspect-square rounded-2xl border-2 border-dashed border-gri-200 bg-white flex flex-col items-center justify-center gap-2 text-gri-400">
              <Icon.Sticker size={40} className="opacity-40 text-gri-400" />
              <p className="text-[13px] font-medium">Önizleme alanı</p>
              <p className="text-[11px] text-gri-400">
                {state.width} × {state.height} mm · {state.shape}
              </p>
            </div>
          </div>
        </section>

        {/* Sağ — konfigürasyon paneli */}
        <aside className="flex flex-col min-h-0 bg-white overflow-y-auto">
          <div className="p-4 space-y-5">
            <FormSection title="Şekil" number={1}>
              <div className="grid grid-cols-2 gap-2">
                {SHAPE_OPTIONS.map((opt) => (
                  <SelectableCard
                    key={opt.id}
                    selected={state.shape === opt.id}
                    onClick={() => patch({ shape: opt.id })}
                    className="!p-3"
                  >
                    <span className="text-lg" aria-hidden>
                      {opt.icon}
                    </span>
                    <span className="text-[12px] font-medium text-lacivert">
                      {opt.label}
                    </span>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title="Boyut (mm)" number={2}>
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      lockRatio: !state.lockRatio,
                    })
                  }
                  disabled={isRatioLockedShape(state.shape)}
                  className={cn(
                    "flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg ring-1 transition-colors",
                    state.lockRatio
                      ? "ring-pim-mercan text-pim-mercan bg-pim-mercan-tint/30"
                      : "ring-gri-200 text-gri-600 hover:bg-gri-50",
                    isRatioLockedShape(state.shape) && "opacity-60 cursor-not-allowed"
                  )}
                  aria-pressed={state.lockRatio}
                >
                  <Icon.Lock size={14} />
                  Oran kilidi
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] text-gri-500 mb-1 block">Genişlik</span>
                  <ClampedNumberInput
                    value={state.width}
                    onChange={(v) => patch({ width: v })}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_W}
                    className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[14px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-gri-500 mb-1 block">Yükseklik</span>
                  <ClampedNumberInput
                    value={state.height}
                    onChange={(v) => patch({ height: v })}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_H}
                    disabled={isRatioLockedShape(state.shape)}
                    className={cn(
                      "w-full rounded-lg border border-gri-200 px-3 py-2 text-[14px]",
                      isRatioLockedShape(state.shape) && "opacity-60"
                    )}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection title="Malzeme" number={3}>
              <div className="grid grid-cols-2 gap-2">
                {materials.map((m) => (
                  <SelectableCard
                    key={m.id}
                    selected={state.material === m.id}
                    onClick={() => patch({ material: m.id })}
                    className="!p-3"
                  >
                    <span className="text-[12px] font-medium text-lacivert capitalize">
                      {m.name}
                    </span>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title="Yüzey" number={4}>
              <div className="grid grid-cols-3 gap-2">
                {finishes.map((f) => (
                  <SelectableCard
                    key={f.id}
                    selected={state.finish === f.id}
                    onClick={() => patch({ finish: f.id })}
                    className="!p-2.5"
                  >
                    <span className="text-[11px] font-medium text-lacivert">
                      {f.name}
                    </span>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title="Adet" number={5}>
              <div className="flex flex-wrap gap-2 mb-3">
                {CUSTOMER_STICKER_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setCustomQty(false);
                      patch({ qty: tier });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[12px] font-semibold ring-1 transition-colors",
                      !customQty && state.qty === tier
                        ? "bg-lacivert text-white ring-lacivert"
                        : "bg-white text-gri-700 ring-gri-200 hover:bg-gri-50"
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-[11px] text-gri-500 mb-1 block">Özel adet</span>
                <ClampedNumberInput
                  value={state.qty}
                  onChange={(v) => {
                    setCustomQty(true);
                    patch({ qty: v });
                  }}
                  min={STICKER_MIN_QTY}
                  max={STICKER_MAX_QTY}
                  step={STICKER_QTY_STEP}
                  className="w-full rounded-lg border border-gri-200 px-3 py-2 text-[14px]"
                />
              </label>
            </FormSection>

            {/* Anlık fiyat */}
            <div className="rounded-xl bg-krem-soft ring-1 ring-krem-deep p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-500">
                Anlık fiyat
              </p>
              {!adminConfig ? (
                <p className="text-[13px] text-gri-500 animate-pulse">
                  Fiyat config yükleniyor…
                </p>
              ) : priceError ? (
                <p className="text-[13px] text-red-600">{priceError}</p>
              ) : quote?.ok ? (
                <>
                  <p className="text-[22px] font-bold text-lacivert tabular-nums">
                    {formatPrice(quote.total)}
                  </p>
                  <p className="text-[13px] text-gri-600 tabular-nums">
                    {state.qty} adet · {formatUnitPrice(quote.unitPrice)} · KDV dahil
                  </p>
                  {quote.overrunCount > 0 ? (
                    <p className="text-[11px] text-pim-mercan font-medium">
                      +{quote.overrunCount} hediye sticker
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] text-gri-500">Fiyat hesaplanamadı.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
