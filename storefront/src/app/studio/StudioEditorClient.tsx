"use client";

/**
 * /studio — Aşama 3a: bıçak modu (poc.html iframe) + önizleme toggle.
 * Kapalı devre: ENABLE_STUDIO_EDITOR flag ile guard.
 * Reuse: StickerLivePreview, ProductPreviewShell, EditorUploadZone,
 * EditorShell iframe+postMessage pattern (poc.html motoru).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClampedNumberInput } from "@/components/ClampedNumberInput";
import { EditorUploadZone } from "@/components/editor/EditorUploadZone";
import { Icon } from "@/components/Icon";
import {
  ProductPreviewShell,
  StickerLivePreview,
  type PreviewView,
} from "@/components/preview";
import { FormSection, SelectableCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildEditorIframeSrc } from "@/lib/editor/build-editor-iframe-src";
import type {
  PocCutlineMeta,
  PocEditorSavedPayload,
} from "@/lib/editor/editor-handoff";
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
export type StudioMode = "onizleme" | "bicak";

export interface StudioState {
  mode: StudioMode;
  shape: StudioShape;
  width: number;
  height: number;
  material: StickerMaterial;
  finish: StickerFinish;
  qty: number;
  lockRatio: boolean;
  designUrl: string | null;
  designName?: string | null;
  /** Aşama 3b hazırlık — cutline-ready / export sonrası dolar */
  cutlineSvg: string | null;
  cutlineMeta: PocCutlineMeta | null;
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
  mode: "onizleme",
  shape: "square",
  width: 75,
  height: 75,
  material: "vinil",
  finish: "parlak",
  qty: 100,
  lockRatio: true,
  designUrl: null,
  designName: null,
  cutlineSvg: null,
  cutlineMeta: null,
};

type PocCutMode = "contour" | "hull" | "rect" | "circle";

function mapStudioShapeToPocMode(shape: StudioShape): PocCutMode {
  switch (shape) {
    case "contour":
      return "contour";
    case "circle":
      return "circle";
    case "square":
    case "rounded":
      return "rect";
  }
}

function mapStudioShapeToPreview(shape: StudioShape): {
  shape: "die" | "square" | "circle";
  softCorners: boolean;
} {
  switch (shape) {
    case "contour":
      return { shape: "die", softCorners: false };
    case "square":
      return { shape: "square", softCorners: false };
    case "circle":
      return { shape: "circle", softCorners: false };
    case "rounded":
      return { shape: "square", softCorners: true };
  }
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

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
  const [previewView, setPreviewView] = useState<PreviewView>("3d");
  const [pocReady, setPocReady] = useState(false);
  const [cutlineStatus, setCutlineStatus] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef(state);
  const [iframeSrc] = useState(() =>
    buildEditorIframeSrc({ material: DEFAULT_STATE.material, mode: "contour" })
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const postToPoc = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      payload,
      window.location.origin
    );
  }, []);

  const syncStudioToPoc = useCallback(() => {
    const s = stateRef.current;
    const pocMode = mapStudioShapeToPocMode(s.shape);
    postToPoc({
      type: "pim-editor-set-size",
      widthMm: s.width,
      heightMm: s.height,
    });
    postToPoc({
      type: "pim-editor-set-shape",
      shape: s.shape === "circle" ? "circle" : "rect",
      mode: pocMode,
      widthMm: s.width,
      heightMm: s.height,
      cornerRadiusMm:
        s.shape === "rounded"
          ? Math.round(Math.min(s.width, s.height) * 0.12)
          : 0,
    });
    if (s.designUrl) {
      postToPoc({
        type: "pim-load-design",
        url: s.designUrl,
        fileName: s.designName ?? undefined,
      });
    }
  }, [postToPoc]);

  const handleFileSelected = useCallback((file: File) => {
    setState((prev) => {
      revokeBlobUrl(prev.designUrl);
      return patchStudioState(prev, {
        designUrl: URL.createObjectURL(file),
        designName: file.name,
        cutlineSvg: null,
        cutlineMeta: null,
      });
    });
    setCutlineStatus("Görsel yüklendi — bıçak hesaplanıyor…");
  }, []);

  const handleRemoveDesign = useCallback(() => {
    setState((prev) => {
      revokeBlobUrl(prev.designUrl);
      return patchStudioState(prev, {
        designUrl: null,
        designName: null,
        cutlineSvg: null,
        cutlineMeta: null,
      });
    });
    setCutlineStatus(null);
  }, []);

  useEffect(() => {
    if (state.mode !== "bicak") {
      setPocReady(false);
      return;
    }

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = e.data as Record<string, unknown> | undefined;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "pim-poc-ready") {
        setPocReady(true);
        setCutlineStatus("Görsel yükle — bıçak otomatik netleşir");
        syncStudioToPoc();
      } else if (data.type === "pim-poc-loaded") {
        setCutlineStatus("Tasarım yüklendi — kontur hesaplanıyor…");
        setState((prev) =>
          prev.cutlineSvg || prev.cutlineMeta
            ? { ...prev, cutlineSvg: null, cutlineMeta: null }
            : prev
        );
      } else if (data.type === "pim-cutline-ready") {
        const meta = (data.meta as PocCutlineMeta | undefined) ?? null;
        setState((prev) => ({ ...prev, cutlineMeta: meta }));
        setCutlineStatus("Bıçak hazır");
        postToPoc({ type: "pim-request-export" });
      } else if (data.type === "pim-editor-saved") {
        const payload = data as unknown as PocEditorSavedPayload;
        setState((prev) => ({
          ...prev,
          cutlineSvg: payload.svg,
          cutlineMeta: payload.meta,
        }));
        setCutlineStatus("Bıçak SVG kaydedildi (3b hazır)");
      } else if (
        data.type === "pim-cutline-auto-failed" ||
        data.type === "pim-poc-error"
      ) {
        setCutlineStatus(
          `Bıçak hatası: ${String(data.error ?? "bilinmeyen")}`
        );
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [state.mode, postToPoc, syncStudioToPoc]);

  useEffect(() => {
    if (state.mode !== "bicak" || !pocReady) return;
    syncStudioToPoc();
    setState((prev) =>
      prev.cutlineSvg || prev.cutlineMeta
        ? { ...prev, cutlineSvg: null, cutlineMeta: null }
        : prev
    );
    setCutlineStatus("Ayarlar güncellendi — kontur yenileniyor…");
  }, [
    state.mode,
    state.shape,
    state.width,
    state.height,
    state.material,
    state.designUrl,
    state.designName,
    pocReady,
    syncStudioToPoc,
  ]);

  useEffect(() => {
    return () => revokeBlobUrl(state.designUrl);
  }, [state.designUrl]);

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
  const previewShape = mapStudioShapeToPreview(state.shape);

  return (
    <main className="flex flex-col h-[calc(100vh-64px)] bg-gri-50">
      <header className="shrink-0 border-b border-gri-200 bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-lacivert">Studio</h1>
          <p className="text-[12px] text-gri-500">Kapalı devre · Aşama 3a</p>
        </div>
        <span className="text-[11px] font-medium text-gri-500 bg-gri-100 px-2 py-1 rounded-md">
          Cutline→önizleme & sepet — sonraki aşama
        </span>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] xl:grid-cols-[220px_1fr_360px] min-h-0">
        {/* Sol — tasarım upload + araç placeholder */}
        <aside className="hidden lg:flex flex-col border-r border-gri-200 bg-white p-4 gap-3 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gri-400">
            Araçlar
          </p>
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-lacivert">Tasarım</p>
            <EditorUploadZone
              designLoaded={!!state.designUrl}
              fileName={state.designName}
              onFileSelected={handleFileSelected}
              onRemoveBg={() => {}}
            />
            {state.designUrl ? (
              <button
                type="button"
                onClick={handleRemoveDesign}
                className="w-full text-[12px] font-medium text-gri-600 hover:text-red-600 py-1.5 rounded-lg hover:bg-gri-50 transition-colors"
              >
                Görseli kaldır
              </button>
            ) : null}
          </div>
          {["Metin", "Şekil", "Katman"].map((tool) => (
            <div
              key={tool}
              className="rounded-lg border border-dashed border-gri-200 px-3 py-2.5 text-[13px] text-gri-400"
            >
              {tool}
            </div>
          ))}
        </aside>

        {/* Orta — bıçak / önizleme modu */}
        <section className="relative flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gri-200 overflow-hidden">
          <div className="lg:hidden p-4 border-b border-gri-200 bg-white space-y-2">
            <p className="text-[12px] font-medium text-lacivert">Tasarım</p>
            <EditorUploadZone
              designLoaded={!!state.designUrl}
              fileName={state.designName}
              onFileSelected={handleFileSelected}
              onRemoveBg={() => {}}
            />
            {state.designUrl ? (
              <button
                type="button"
                onClick={handleRemoveDesign}
                className="w-full text-[12px] font-medium text-gri-600 hover:text-red-600 py-1.5"
              >
                Görseli kaldır
              </button>
            ) : null}
          </div>

          {/* Mod toggle — StickerApp Edit design / Preview */}
          <div className="absolute top-3 right-3 z-20 flex rounded-lg bg-white/95 p-0.5 shadow-1 ring-1 ring-gri-200 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => patch({ mode: "bicak" })}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors",
                state.mode === "bicak"
                  ? "bg-lacivert text-white"
                  : "text-gri-600 hover:bg-gri-50"
              )}
            >
              Bıçak
            </button>
            <button
              type="button"
              onClick={() => patch({ mode: "onizleme" })}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors",
                state.mode === "onizleme"
                  ? "bg-lacivert text-white"
                  : "text-gri-600 hover:bg-gri-50"
              )}
            >
              Önizleme
            </button>
          </div>

          {state.mode === "bicak" ? (
            <div className="flex flex-1 flex-col min-h-0 p-4 pt-12">
              {cutlineStatus ? (
                <p className="mb-2 text-[11px] text-gri-600 px-1">{cutlineStatus}</p>
              ) : null}
              {state.cutlineMeta ? (
                <p className="mb-2 text-[10px] text-gri-500 px-1 tabular-nums">
                  cutline-ready · {state.cutlineMeta.mode} ·{" "}
                  {state.cutlineSvg ? "SVG kayıtlı" : "SVG bekleniyor"}
                </p>
              ) : null}
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gri-200 bg-gri-100 shadow-sm">
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  title="Bıçak editörü"
                  className="block h-full w-full min-h-[420px] border-0"
                  scrolling="no"
                  sandbox="allow-scripts allow-same-origin allow-downloads"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 md:p-6 min-h-[320px] lg:min-h-0 overflow-y-auto">
              <div className="w-full max-w-lg">
                <ProductPreviewShell
                  width={state.width}
                  height={state.height}
                  view={previewView}
                  onViewChange={setPreviewView}
                  footnote={
                    state.designUrl
                      ? "Yüklediğin görsel canlı önizlemede"
                      : "Görsel yüklemeden örnek sticker gösterilir"
                  }
                >
                  <StickerLivePreview
                    cutMode="diecut"
                    shape={previewShape.shape}
                    softCorners={previewShape.softCorners}
                    material={state.material}
                    finish={state.finish}
                    width={state.width}
                    height={state.height}
                    qty={state.qty}
                    view={previewView}
                    designUrl={state.designUrl}
                  />
                </ProductPreviewShell>
              </div>
            </div>
          )}
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
