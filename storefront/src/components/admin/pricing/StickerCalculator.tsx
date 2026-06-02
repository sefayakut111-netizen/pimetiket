/**
 * Pim Etiket — Sticker fiyat hesaplayıcı (embed + standalone)
 *
 * Operatör manuel fiyat hesaplama + parametre tuning aracı.
 * Sefa "fiyat geliştirme çalışmaları + manuel kontrol" için istedi.
 *
 * Pricing engine lib'i (storefront/src/lib/pricing-engine/) kullanır.
 * sticker-fiyatlama.html v0.3'ün operatör UI'ının React port'u.
 *
 * Kapsam (Faz 1):
 *    Mode toggle (fason/üretim)
 *    Cut type (tabaka/diecut)
 *    Boyut input (W × H)
 *    Tier butonları (25/50/100/250/500/1000)
 *    Üretim parametre input'ları (fason rate / 6 üretim kalemi)
 *    Site fiyatı (live config, alış/satış çift fiyat)
 *    Fason/üretim simülasyonu (operatör referans)
 *    Anlık fiyat (büyük), birim fiyat
 *    Stat kartları (tabaka, m², rulo, fire)
 *    Maliyet detayı breakdown
 *    Tolerans bandı (overrun bilgisi)
 *    Reset + varsayılana dön
 *
 * Sonraki faz (henüz yok):
 *   - Rulo plan SVG görseli
 *   - Tabaka dizgi SVG
 *   - Sepet sistemi
 *   - PDF iş emri
 *   - Lot sayacı (DB gerek)
 *   - İstatistik modal (DB gerek)
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  STICKER_TIERS,
  ROLL_MARGIN_X,
  ROLL_START_MARGIN,
  ROLL_END_MARGIN,
  type StickerTier,
  type CutType,
  type ProductionMode,
  quoteSticker,
  findTier,
  computeCost,
  type CostResult,
} from "@/lib/pricing-engine";
import { ProfileTabs } from "@/components/admin/pricing/ProfileTabs";
import { RollPlanSvg } from "@/components/admin/pricing/RollPlanSvg";
import { SheetPreviewSvg } from "@/components/admin/pricing/SheetPreviewSvg";
import { RollMiniBar } from "@/components/admin/pricing/RollMiniBar";
import { ProfileBar } from "@/components/admin/pricing/ProfileBar";
import {
  getDefaultInput,
  type CustomerType,
  type PricingProfile,
  type ProfileInputSnapshot,
} from "@/lib/pricing-profiles";
import {
  generateWorkOrderPDF,
  nextLot,
  peekNextLot,
} from "@/lib/pricing-pdf";
import { StatsModal } from "@/components/admin/pricing/StatsModal";
import { recordStat } from "@/lib/pricing-stats";
import { calculatePrice } from "@/lib/pricing-calc";
import { livePriceToCostResult } from "@/lib/pricing-live-snapshot";
import {
  FALLBACK_STICKER_CONFIG,
  type MaterialItem,
  type ProfileConfig,
} from "@/lib/pricing-config-types";
import { resolveM2Cost } from "@/lib/pricing-dual-price";

// ============================================================
// Defaults — v0.4: overhead 45 (SaaS recovery), customerType
// ============================================================

const DEFAULT_PREVIEW_MATERIAL = "vinil";
const DEFAULT_PREVIEW_FINISH = "parlak";
const DEFAULTS: ProfileInputSnapshot = getDefaultInput();

/** Simülasyon maliyetinde tier uygulanmaz — referans çarpan 1 */
const SIM_TIER: StickerTier = { qty: 250, multiplier: 1, label: "referans" };

/** Varsayılan malzeme: Opak Folyo / Vinil (id veya isim) */
function findOpakFolyoMaterial(
  config: ProfileConfig
): MaterialItem | undefined {
  const byId = config.materials.find(
    (m) => m.id === "vinil" || m.id === "opak" || m.id === "opak_folyo"
  );
  if (byId) return byId;
  return config.materials.find((m) => /opak|vinil/i.test(m.name));
}

function fasonRateForMaterial(
  config: ProfileConfig,
  materialId: string
): number {
  const selected = config.materials.find((m) => m.id === materialId);
  if (selected) return resolveM2Cost(selected);
  const opak = findOpakFolyoMaterial(config);
  return opak ? resolveM2Cost(opak) : DEFAULTS.fasonRate;
}

function applyLiveConfigDefaults(
  config: ProfileConfig,
  setters: {
    setPreviewMaterialId: (id: string) => void;
    setFasonRate: (n: number) => void;
    setSetup: (n: number) => void;
    setPackaging: (n: number) => void;
    setOperationEnabled: (v: boolean) => void;
  }
) {
  const opak = findOpakFolyoMaterial(config);
  if (opak) {
    setters.setPreviewMaterialId(opak.id);
    setters.setFasonRate(resolveM2Cost(opak));
  }
  setters.setSetup(config.operation.setup);
  setters.setPackaging(config.operation.packaging_per_unit);
  setters.setOperationEnabled(config.operation.enabled !== false);
}

// ============================================================
// Helpers
// ============================================================

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

// ============================================================
// Page
// ============================================================

export interface StickerCalculatorProps {
  liveConfig?: ProfileConfig | null;
  embedded?: boolean;
}

export function StickerCalculator({
  liveConfig,
  embedded = false,
}: StickerCalculatorProps) {
  const toast = useToast();

  // State
  const [mode, setMode] = useState<ProductionMode>(DEFAULTS.mode);
  const [cut, setCut] = useState<CutType>(DEFAULTS.cut);
  const [width, setWidth] = useState<number>(DEFAULTS.width);
  const [height, setHeight] = useState<number>(DEFAULTS.height);
  const [qty, setQty] = useState<number>(DEFAULTS.qty);

  // Fason — varsayılan Opak Folyo config alış (m²)
  const [fasonRate, setFasonRate] = useState(() =>
    fasonRateForMaterial(
      liveConfig ?? FALLBACK_STICKER_CONFIG,
      DEFAULT_PREVIEW_MATERIAL
    )
  );

  // Üretim
  const [paper, setPaper] = useState<number>(DEFAULTS.paper);
  const [ink, setInk] = useState<number>(DEFAULTS.ink);
  const [coating, setCoating] = useState<number>(DEFAULTS.coating);
  const [labor, setLabor] = useState<number>(DEFAULTS.labor);
  const [overhead, setOverhead] = useState<number>(DEFAULTS.overhead);
  const [depreciation, setDepreciation] = useState<number>(DEFAULTS.depreciation);

  // Operatör simülasyonu — operasyon (cargo/margin yok)
  const [setup, setSetup] = useState<number>(DEFAULTS.setup);
  const [packaging, setPackaging] = useState<number>(DEFAULTS.packaging);

  const [operationEnabled, setOperationEnabled] = useState(true);

  // Site fiyat önizleme (live config malzeme/laminasyon)
  const [previewMaterialId, setPreviewMaterialId] = useState<string>(
    DEFAULT_PREVIEW_MATERIAL
  );
  const [previewFinishId, setPreviewFinishId] = useState<string>(
    DEFAULT_PREVIEW_FINISH
  );

  const [customerType, setCustomerType] = useState<CustomerType>(
    DEFAULTS.customerType
  );

  // Aktif profil ID
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();

  // Lot rozeti — bir sonraki lot numarası
  const [nextLotPreview, setNextLotPreview] = useState<string>("A000001");
  const [statsOpen, setStatsOpen] = useState(false);
  const [liveStickerConfig, setLiveStickerConfig] = useState<ProfileConfig>(
    liveConfig ?? FALLBACK_STICKER_CONFIG
  );
  const [liveConfigLoaded, setLiveConfigLoaded] = useState(!!liveConfig);
  const configDefaultsApplied = useRef(!!liveConfig);

  const selectedMaterial = useMemo(
    () =>
      liveStickerConfig.materials.find((m) => m.id === previewMaterialId),
    [liveStickerConfig, previewMaterialId]
  );

  const handleMaterialChange = (materialId: string) => {
    setPreviewMaterialId(materialId);
    setFasonRate(fasonRateForMaterial(liveStickerConfig, materialId));
  };

  useEffect(() => {
    setNextLotPreview(peekNextLot("A"));
  }, []);

  useEffect(() => {
    if (liveConfig) {
      setLiveStickerConfig(liveConfig);
      setLiveConfigLoaded(true);
      if (!configDefaultsApplied.current) {
        configDefaultsApplied.current = true;
        applyLiveConfigDefaults(liveConfig, {
          setPreviewMaterialId,
          setFasonRate,
          setSetup,
          setPackaging,
          setOperationEnabled,
        });
      }
    }
  }, [liveConfig]);

  useEffect(() => {
    if (!liveConfigLoaded || configDefaultsApplied.current) return;
    configDefaultsApplied.current = true;
    applyLiveConfigDefaults(liveStickerConfig, {
      setPreviewMaterialId,
      setFasonRate,
      setSetup,
      setPackaging,
      setOperationEnabled,
    });
  }, [liveConfigLoaded, liveStickerConfig]);

  useEffect(() => {
    if (liveConfig) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/pricing?scope=sticker", {
          cache: "no-store",
        });
        const j = (await r.json()) as { ok?: boolean; live?: ProfileConfig };
        if (!cancelled && r.ok && j.ok && j.live) {
          setLiveStickerConfig(j.live);
        }
      } catch {
        /* fallback config kalır */
      } finally {
        if (!cancelled) setLiveConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveConfig]);

  // Hesap — sol: operatör maliyet simülasyonu (fason, tier simülasyonda yok)
  const result = quoteSticker({
    width,
    height,
    cut,
    qty,
    production: { mode: "fason", rate: fasonRate },
    operation: operationEnabled
      ? { setup, packaging, feePct: 0 }
      : { setup: 0, packaging: 0, feePct: 0 },
    vatPct: liveStickerConfig.vat.pct,
  });

  const liveSitePrice = useMemo(() => {
    if (!result.ok) return null;
    return calculatePrice(
      {
        width_mm: width,
        height_mm: height,
        qty,
        material_id: previewMaterialId,
        selected_options: { finish: previewFinishId },
        billable_m2: result.geometry.totalM2,
      },
      liveStickerConfig,
      "sticker"
    );
  }, [
    result,
    width,
    height,
    qty,
    previewMaterialId,
    previewFinishId,
    liveStickerConfig,
  ]);

  const displayTier = liveSitePrice?.ok ? liveSitePrice.tier : findTier(qty);

  const simulationCost = useMemo(() => {
    if (!result.ok) return null;
    return computeCost({
      geometry: result.geometry,
      requestedQty: qty,
      production: { mode: "fason", rate: fasonRate },
      operation: operationEnabled
        ? { setup, packaging, feePct: 0, cargo: 0 }
        : { setup: 0, packaging: 0, feePct: 0, cargo: 0 },
      margin: {
        marginPct: 0,
        vatPct: liveStickerConfig.vat.pct,
        minMarkupFraction: 0,
      },
      tier: SIM_TIER,
    });
  }, [
    result,
    qty,
    fasonRate,
    setup,
    packaging,
    operationEnabled,
    liveStickerConfig.vat.pct,
  ]);

  function handleGeneratePDF() {
    if (!result.ok) {
      toast.error("Önce geçerli bir hesaplama yap");
      return;
    }
    if (!liveSitePrice?.ok) {
      toast.error(
        liveSitePrice && !liveSitePrice.ok
          ? liveSitePrice.reason
          : "Site fiyatı hesaplanamadı"
      );
      return;
    }
    const siteCost = livePriceToCostResult(liveSitePrice);
    const lot = nextLot("A");
    setNextLotPreview(peekNextLot("A"));

    generateWorkOrderPDF({
      lot,
      geometry: result.geometry,
      cost: siteCost,
      requestedQty: qty,
      cut,
      mode,
    });

    recordStat({
      lot,
      product: "sticker",
      mode,
      cut,
      width,
      height,
      requestedQty: qty,
      producedQty: result.geometry.fit.producedQty,
      overrunCount: result.geometry.fit.producedQty - qty,
      rollsNeeded: result.geometry.roll.rollsNeeded,
      totalM2: result.geometry.totalM2,
      wastePct: result.geometry.wastePct,
      baseCost: siteCost.baseCost,
      intendedProfit: siteCost.intendedProfit,
      actualProfit: siteCost.actualProfit,
      vatAmount: siteCost.vatAmount,
      total: siteCost.total,
      unitPrice: siteCost.unitPrice,
      tierMultiplier: siteCost.tierMultiplier,
    });

    toast.success(`İş emri ${lot} üretildi (PDF indirildi)`);
  }

  // Profile snapshot — current state'i serialize et
  const currentInput: ProfileInputSnapshot = {
    mode,
    cut,
    width,
    height,
    qty,
    fasonRate,
    paper,
    ink,
    coating,
    labor,
    overhead,
    depreciation,
    setup,
    packaging,
    feePct: 0,
    vatPct: liveStickerConfig.vat.pct,
    customerType,
  };

  function loadProfile(p: PricingProfile) {
    const i = { ...getDefaultInput(), ...p.input };
    setMode(i.mode);
    setCut(i.cut);
    setWidth(i.width);
    setHeight(i.height);
    setQty(i.qty);
    setFasonRate(i.fasonRate);
    setPaper(i.paper);
    setInk(i.ink);
    setCoating(i.coating);
    setLabor(i.labor);
    setOverhead(i.overhead);
    setDepreciation(i.depreciation);
    setSetup(i.setup);
    setPackaging(i.packaging);
    setCustomerType(i.customerType);
    setActiveProfileId(p.id);
    toast.success(`"${p.name}" profili yüklendi`);
  }

  function reset() {
    setMode(DEFAULTS.mode);
    setCut(DEFAULTS.cut);
    setWidth(DEFAULTS.width);
    setHeight(DEFAULTS.height);
    setQty(DEFAULTS.qty);
    applyLiveConfigDefaults(liveStickerConfig, {
      setPreviewMaterialId,
      setFasonRate,
      setSetup,
      setPackaging,
      setOperationEnabled,
    });
    setPaper(DEFAULTS.paper);
    setInk(DEFAULTS.ink);
    setCoating(DEFAULTS.coating);
    setLabor(DEFAULTS.labor);
    setOverhead(DEFAULTS.overhead);
    setDepreciation(DEFAULTS.depreciation);
    setPreviewFinishId(DEFAULT_PREVIEW_FINISH);
    setCustomerType(DEFAULTS.customerType);
    setActiveProfileId(undefined);
    toast.success("Varsayılan değerlere dönüldü");
  }

  function copyJSON() {
    const payload = { input: currentInput, result, liveSitePrice };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast.success("JSON kopyalandı"))
      .catch(() => toast.error("Kopyalama başarısız"));
  }

  const outerClass = embedded
    ? ""
    : "bg-gri-50 animate-fade-up min-h-[calc(100vh-56px)] py-8 pb-20";

  return (
    <div className={outerClass}>
      <div className={embedded ? "" : "mx-auto max-w-[1280px] px-4 md:px-8"}>
        {!embedded && <ProfileTabs active="sticker" />}

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
          <div>
            <Eyebrow>Operatör · Hesaplama aracı</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
               Sticker Fiyat Hesapla
            </h1>
            <p className="mt-2 text-base text-gri-700">
              Vinil / Transparan / Holografik / Simli için manuel hesap +
              parametre tuning.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-pim-mercan text-white text-[12px] font-bold tabular-nums shadow-mercan"
              title="Bir sonraki PDF iş emri lot numarası"
            >
              <Icon.Box size={12} /> Lot · {nextLotPreview}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setStatsOpen(true)}>
               İstatistik
            </Button>
            <Button variant="ghost" size="sm" onClick={copyJSON}>
              <Icon.Sparkle size={14} /> JSON kopyala
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Sıfırla
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={!result.ok || !liveSitePrice?.ok}
            >
               İş Emri PDF
            </Button>
          </div>
        </div>

        {/* Profile bar */}
        <ProfileBar
          currentInput={currentInput}
          activeProfileId={activeProfileId}
          onLoadProfile={loadProfile}
          onClearActive={() => setActiveProfileId(undefined)}
        />

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 items-start">
          {/* LEFT — Input (müşteri akışı: kesim → ürün → miktar → simülasyon) */}
          <div className="space-y-4">
            <FlowStepCard
              step={1}
              title="Sipariş tanımı"
              subtitle="Kesim tipi ve ürün seçimi — müşteri konfigüratörüyle aynı sıra"
            >
              <Field label="Kesim">
                <div className="grid grid-cols-2 gap-2">
                  <CutCard
                    selected={cut === "tabaka"}
                    onClick={() => setCut("tabaka")}
                    title="Tabaka"
                    desc="Yarım kesim, müşteri soyar"
                    spec="6 mm boşluk"
                  />
                  <CutCard
                    selected={cut === "diecut"}
                    onClick={() => setCut("diecut")}
                    title="Die Cut"
                    desc="Tam kesim, tek tek"
                    spec="50 mm boşluk"
                  />
                </div>
              </Field>

              <Field label="Malzeme">
                <ChipGrid
                  columns={2}
                  options={liveStickerConfig.materials.map((m) => ({
                    id: m.id,
                    label: m.name,
                  }))}
                  value={previewMaterialId}
                  onChange={handleMaterialChange}
                />
              </Field>

              <Field label="Laminasyon">
                <ChipGrid
                  columns={3}
                  options={(liveStickerConfig.options.finish?.items ?? []).map(
                    (f) => ({ id: f.id, label: f.name })
                  )}
                  value={previewFinishId}
                  onChange={setPreviewFinishId}
                />
              </Field>
            </FlowStepCard>

            <FlowStepCard
              step={2}
              title="Boyut ve adet"
              subtitle="Dizgi, tabaka, m² ve fiyat kademesini belirler"
            >
              <Field label="Boyut (mm)">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <NumInput
                    value={width}
                    onChange={setWidth}
                    suffix="GEN."
                    min={5}
                    max={400}
                  />
                  <span className="text-gri-500 font-medium text-lg">×</span>
                  <NumInput
                    value={height}
                    onChange={setHeight}
                    suffix="YÜK."
                    min={5}
                    max={650}
                  />
                </div>
              </Field>

              <Field label="Adet kademesi">
                <TierGrid value={qty} onChange={setQty} />
              </Field>
            </FlowStepCard>

            <FlowStepCard
              step={3}
              title="Maliyet simülasyonu"
              subtitle="Operatör referansı — site fiyatından bağımsız"
              muted
            >
              <Field
                label="Fason birim maliyet"
                hint={
                  selectedMaterial
                    ? `${selectedMaterial.name} · config alış ${fmt(resolveM2Cost(selectedMaterial))} ₺/m²`
                    : "Opak Folyo varsayılan"
                }
              >
                <NumInput
                  value={fasonRate}
                  onChange={setFasonRate}
                  suffix="₺ / m²"
                  step={5}
                />
              </Field>

              <div className="border-t border-gri-200 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.02em]">
                    Operasyon
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gri-700">
                      {operationEnabled ? "Aktif" : "Devre dışı"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={operationEnabled}
                      onClick={() => setOperationEnabled((v) => !v)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
                        operationEnabled ? "bg-yesil" : "bg-gri-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5",
                          operationEnabled ? "translate-x-5" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </label>
                </div>
                <div
                  className={cn(
                    "grid grid-cols-2 gap-3",
                    !operationEnabled && "opacity-40 pointer-events-none"
                  )}
                >
                  <Field label="Hazırlık">
                    <NumInput
                      value={setup}
                      onChange={setSetup}
                      suffix="₺"
                      step={10}
                    />
                  </Field>
                  <Field label="Paketleme">
                    <NumInput
                      value={packaging}
                      onChange={setPackaging}
                      suffix="₺/zarf"
                      step={5}
                    />
                  </Field>
                </div>
              </div>
            </FlowStepCard>
          </div>

          {/* RIGHT — Output: site fiyatı üstte (ana), simülasyon altta (ikincil) */}
          <div className="space-y-4">
            <SitePriceHero
              liveSitePrice={liveSitePrice}
              qty={qty}
              tier={displayTier}
              geometry={result.ok ? result.geometry : null}
            />

            <OperatorCostHero
              result={result}
              simulationCost={simulationCost}
              qty={qty}
              compact
            />

            {result.ok && simulationCost && liveSitePrice?.ok && (
              <ProfitCompareStrip
                simulationTotal={simulationCost.total}
                siteFinal={liveSitePrice.final}
              />
            )}

            {result.ok ? (
              <>
                {/* Tabaka dizgisi + özet — rulo planından önce (esnek tabaka görünür olsun) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SheetPreviewCard result={result} />
                  <UretimOzetiCard result={result} />
                </div>

                <RollPlanCard result={result} />
              </>
            ) : (
              <Card padding="p-8" className="text-center">
                <Icon.Info size={32} className="mx-auto text-gri-500 mb-2" />
                <p className="text-base text-gri-700">{result.reason}</p>
                {result.bigEtiketRedirect && (
                  <p className="text-[13px] text-gri-500 mt-2">
                    Büyük etiket servisi yakında eklenecek (max 40×65 cm üstü).
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function FlowStepCard({
  step,
  title,
  subtitle,
  muted,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      padding="p-5"
      className={cn(muted && "bg-gri-50/80 ring-gri-200")}
    >
      <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gri-100">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums",
            muted
              ? "bg-gri-200 text-gri-700"
              : "bg-lacivert text-white"
          )}
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-lacivert">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12px] text-gri-600 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.02em]">
          {label}
        </span>
        {hint && <span className="text-[11px] text-gri-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center bg-gri-50 ring-1 ring-gri-200 rounded-lg px-3 h-11 focus-within:ring-pim-mercan focus-within:bg-white transition-shadow">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        className="flex-1 bg-transparent border-none outline-none text-[14px] font-semibold tabular-nums text-lacivert"
      />
      {suffix && (
        <span className="text-[12px] text-gri-500 font-medium tabular-nums">
          {suffix}
        </span>
      )}
    </div>
  );
}

function CutCard({
  selected,
  onClick,
  title,
  desc,
  spec,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  spec: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "p-3 rounded-lg ring-[1.5px] text-left transition-all",
        selected
          ? "ring-lacivert bg-lacivert text-white"
          : "ring-gri-200 bg-white text-lacivert hover:ring-pim-mercan-soft"
      )}
    >
      <div className="font-semibold text-[13px] mb-0.5">{title}</div>
      <div
        className={cn(
          "text-[11px] leading-tight mb-1.5",
          selected ? "text-white/70" : "text-gri-700"
        )}
      >
        {desc}
      </div>
      <span
        className={cn(
          "inline-block text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full",
          selected ? "bg-pim-mercan text-white" : "bg-gri-100 text-gri-700"
        )}
      >
        {spec}
      </span>
    </button>
  );
}

function ChipGrid({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "grid-cols-2" : "grid-cols-3"
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={cn(
              "px-3 py-2.5 rounded-lg text-[13px] font-semibold ring-[1.5px] transition-all text-center",
              selected
                ? "ring-lacivert bg-lacivert text-white shadow-1"
                : "ring-gri-200 bg-white text-lacivert hover:ring-pim-mercan-soft"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TierGrid({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STICKER_TIERS.map((tier) => {
        const selected = value === tier.qty;
        const ind = tier.multiplier < 1;
        const ref = tier.multiplier === 1;
        const zam = tier.multiplier > 1;
        return (
          <button
            key={tier.qty}
            type="button"
            onClick={() => onChange(tier.qty)}
            aria-pressed={selected}
            className={cn(
              "py-3 rounded-lg ring-[1.5px] text-center transition-all",
              selected
                ? "ring-lacivert bg-lacivert text-white shadow-1"
                : "ring-gri-200 bg-white text-lacivert hover:ring-pim-mercan-soft hover:-translate-y-0.5"
            )}
          >
            <div className="text-[18px] font-bold tracking-tight tabular-nums">
              {tier.qty}
            </div>
            <div
              className={cn(
                "text-[10px] font-bold tabular-nums mt-0.5",
                selected
                  ? "text-white/85"
                  : zam
                    ? "text-pim-mercan"
                    : ind
                      ? "text-yesil"
                      : "text-gri-500"
              )}
            >
              {ref ? "referans" : tier.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OperatorCostHero({
  result,
  simulationCost,
  qty,
  compact = false,
}: {
  result: ReturnType<typeof quoteSticker>;
  simulationCost: CostResult | null;
  qty: number;
  compact?: boolean;
}) {
  if (!result.ok) {
    return (
      <Card padding="p-6" className="ring-1 ring-gri-200">
        <div className="text-[11px] uppercase tracking-[0.15em] text-gri-500 mb-2 font-semibold">
          Operatör Maliyet Simülasyonu
        </div>
        <div className="text-[32px] font-bold text-gri-400">—</div>
        <p className="mt-2 text-[13px] text-gri-600">{result.reason}</p>
      </Card>
    );
  }

  const { geometry } = result;
  const cost = simulationCost;
  if (!cost) {
    return (
      <Card padding="p-6" className="ring-1 ring-gri-200">
        <div className="text-[11px] uppercase tracking-[0.15em] text-gri-500 mb-2 font-semibold">
          Operatör Maliyet Simülasyonu
        </div>
        <div className="text-[32px] font-bold text-gri-400">—</div>
      </Card>
    );
  }

  return (
    <Card
      padding={compact ? "p-4" : "p-6"}
      className={cn(
        "ring-1 ring-gri-300 bg-gradient-to-br from-gri-50 to-white",
        compact && "opacity-95"
      )}
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-gri-500 mb-2 font-semibold">
        Simülasyon Maliyeti
      </div>
      <div
        className={cn(
          "font-bold tabular-nums text-lacivert leading-none",
          compact ? "text-[28px]" : "text-[36px]"
        )}
      >
        {fmt(Math.round(cost.total))}{" "}
        <span className={cn("text-gri-500", compact ? "text-[16px]" : "text-[20px]")}>
          ₺
        </span>
      </div>
      <p className="text-[12px] text-gri-500 mt-0.5 tabular-nums">
        KDV dahil · KDV hariç {fmt(Math.round(cost.baseCost))} ₺
      </p>
      <p className="text-[12px] text-gri-600 mt-1">
        Fason + operasyon · tier uygulanmaz
      </p>
      <p className="text-[12px] text-gri-500 mt-2 tabular-nums leading-relaxed">
        {qty.toLocaleString("tr-TR")} adet ·{" "}
        {geometry.fit.sheetsNeeded}{" "}
        {geometry.fit.mode === "tabaka" ? "tabaka" : "rulo"} ·{" "}
        {geometry.fit.cols}×{geometry.fit.rows} grid ·{" "}
        {geometry.fit.mode === "tabaka"
          ? `esnek tabaka ${geometry.fit.sheetW}×${geometry.fit.sheetH}mm`
          : "die-cut direkt rulo"}
        <br />
        {geometry.fit.mode === "tabaka" ? "Baskı alanı" : "Sticker alanı"}{" "}
        {geometry.sheetAreaM2.toFixed(3)} m² · fireli rulo{" "}
        {geometry.totalM2.toFixed(3)} m²
      </p>
      {!compact && (
        <div className="mt-4 pt-4 border-t border-gri-200 grid grid-cols-2 gap-3 text-[13px] tabular-nums">
          <div>
            <div className="text-[10px] uppercase text-gri-500 font-semibold">Üretim</div>
            {fmt(Math.round(cost.productionCost))} ₺
          </div>
          <div>
            <div className="text-[10px] uppercase text-gri-500 font-semibold">Operasyon</div>
            {fmt(Math.round(cost.operationCost))} ₺
          </div>
          <div>
            <div className="text-[10px] uppercase text-gri-500 font-semibold">KDV dahil sim.</div>
            {fmt(Math.round(cost.total))} ₺
          </div>
          <div>
            <div className="text-[10px] uppercase text-gri-500 font-semibold">Birim (KDV dahil)</div>
            {fmt(cost.unitPrice, 2)} ₺
          </div>
        </div>
      )}
    </Card>
  );
}

function ProfitCompareStrip({
  simulationTotal,
  siteFinal,
}: {
  simulationTotal: number;
  siteFinal: number;
}) {
  const diff = siteFinal - simulationTotal;
  const pct = simulationTotal > 0 ? (diff / simulationTotal) * 100 : 0;
  const isProfit = diff >= 0;

  return (
    <Card
      padding="p-4"
      className={cn(
        "ring-1",
        isProfit
          ? "ring-pim-mercan/30 bg-pim-mercan/5"
          : "ring-kirmizi/30 bg-kirmizi-soft/40"
      )}
    >
      <div className="space-y-1.5 font-mono text-[13px] tabular-nums text-lacivert">
        <div className="flex justify-between gap-4">
          <span className="text-gri-600 uppercase tracking-wide text-[11px] font-sans font-semibold">
            Simülasyon maliyeti
          </span>
          <span>
            {fmt(Math.round(simulationTotal))} ₺{" "}
            <span className="text-gri-500 font-sans text-[12px]">(KDV dahil)</span>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gri-600 uppercase tracking-wide text-[11px] font-sans font-semibold">
            Site satış fiyatı
          </span>
          <span className="font-semibold">{fmt(Math.round(siteFinal))} ₺</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-gri-200 pt-1.5">
          <span className="text-gri-600 uppercase tracking-wide text-[11px] font-sans font-semibold">
            Fark
          </span>
          <span
            className={cn(
              "font-bold",
              isProfit ? "text-pim-mercan-koyu" : "text-kirmizi"
            )}
          >
            {isProfit ? "+" : ""}
            {fmt(Math.round(diff))} ₺ ({Math.abs(pct).toFixed(0)}%{" "}
            {isProfit ? "kâr" : "zarar"})
          </span>
        </div>
      </div>
    </Card>
  );
}

function SitePriceHero({
  liveSitePrice,
  qty,
  tier,
  geometry,
}: {
  liveSitePrice: ReturnType<typeof calculatePrice> | null;
  qty: number;
  tier: StickerTier | { qty: number; multiplier: number; label: string };
  geometry: import("@/lib/pricing-engine").GeometryResult | null;
}) {
  if (!liveSitePrice?.ok) {
    return (
      <Card
        padding="p-6"
        className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white"
      >
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
          Site Fiyatı (KDV Dahil)
        </div>
        <div className="text-[32px] font-bold">—</div>
        <p className="mt-2 text-[13px] text-white/70">
          {liveSitePrice && !liveSitePrice.ok
            ? liveSitePrice.reason
            : "Hesaplanamadı"}
        </p>
      </Card>
    );
  }

  const profit = liveSitePrice.with_margin - liveSitePrice.cost_total;
  const profitPct =
    liveSitePrice.cost_total > 0
      ? (profit / liveSitePrice.cost_total) * 100
      : 0;
  const fee = liveSitePrice.with_fee - liveSitePrice.with_margin;
  const vat = liveSitePrice.final - liveSitePrice.with_fee;
  const billableM2 = liveSitePrice.billable_m2 ?? geometry?.totalM2 ?? 0;
  const sheetsNeeded = geometry?.fit.sheetsNeeded ?? 0;
  const isTabakaLayout = geometry?.fit.mode === "tabaka";
  const layoutHint =
    geometry?.fit.mode === "tabaka"
      ? `${geometry.fit.cols}×${geometry.fit.rows} · esnek ${geometry.fit.sheetW}×${geometry.fit.sheetH}mm`
      : geometry
        ? `${geometry.fit.cols}×${geometry.fit.rows} · die-cut`
        : "";

  return (
    <Card
      padding="p-6"
      className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white relative overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-[200px] h-[200px] rounded-full bg-pim-mercan/20 blur-2xl"
      />
      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
          Site Fiyatı (KDV Dahil)
        </div>
        <div className="text-[36px] font-bold tabular-nums leading-none">
          {fmt(Math.round(liveSitePrice.final))}{" "}
          <span className="text-pim-mercan text-[22px]">₺</span>
        </div>
        <p className="text-[12px] text-white/70 mt-1 tabular-nums leading-relaxed">
          {fmt(liveSitePrice.unit_price, 2)} ₺/adet · {qty.toLocaleString("tr-TR")}{" "}
          adet · {sheetsNeeded}{" "}
          {isTabakaLayout ? "tabaka" : "rulo"}
          {layoutHint ? ` · ${layoutHint}` : ""} · fatura {billableM2.toFixed(3)} m²
          {geometry ? (
            <>
              <br />
              {geometry.fit.mode === "tabaka" ? (
                <>
                  Tabaka alanı {geometry.sheetAreaM2.toFixed(3)} m² · fireli rulo{" "}
                  {geometry.totalM2.toFixed(3)} m² · Tier {tier.label}
                </>
              ) : (
                <>
                  Sticker alanı {geometry.sheetAreaM2.toFixed(3)} m² · fireli rulo{" "}
                  {geometry.totalM2.toFixed(3)} m² · Tier {tier.label}
                </>
              )}
            </>
          ) : (
            <> · Tier {tier.label}</>
          )}
        </p>
        <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 md:grid-cols-5 gap-3">
          <VatCell
            label="Maliyet (Alış)"
            value={`${fmt(Math.round(liveSitePrice.cost_total))} ₺`}
          />
          <VatCell
            label="Satış Fiyatı"
            value={`${fmt(Math.round(liveSitePrice.with_margin))} ₺`}
          />
          <VatCell
            label={profit >= 0 ? "Kâr" : "Zarar"}
            value={`${fmt(Math.round(profit))} ₺`}
            subtitle={`%${Math.abs(profitPct).toFixed(0)} ${profit >= 0 ? "kâr" : "zarar"}`}
            warning={profit < 0}
          />
          <VatCell label="PSP" value={`${fmt(Math.round(fee))} ₺`} />
          <VatCell label="KDV" value={`${fmt(Math.round(vat))} ₺`} />
        </div>
      </div>
    </Card>
  );
}

function VatCell({
  label,
  value,
  subtitle,
  warning,
}: {
  label: string;
  value: string;
  subtitle?: string;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-white/50 font-semibold mb-1">
        {label}
      </div>
      <div
        className={cn(
          "text-[14px] font-semibold tabular-nums",
          warning && "text-pim-mercan"
        )}
      >
        {value}
      </div>
      {subtitle && (
        <div
          className={cn(
            "text-[10px] mt-0.5 tabular-nums",
            warning ? "text-pim-mercan/80" : "text-white/50"
          )}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function RollPlanCard({ result }: { result: ReturnType<typeof quoteSticker> }) {
  if (!result.ok) return null;
  const { geometry } = result;
  const { fit, roll } = geometry;
  const efficiency = 100 - geometry.wastePct;
  const isTabaka = fit.mode === "tabaka";
  const baskiAlanM2 = isTabaka ? geometry.sheetAreaM2 : geometry.stickerArea;
  const baskiAlanLabel = isTabaka ? "Baskı yapılan alan" : "Sticker alanı";

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Head — title + inline stats */}
      <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block text-[10px] tracking-[0.18em] uppercase text-pim-mercan font-bold mb-1">
            üretim katmanı
          </span>
          <h3 className="text-[18px] font-semibold tracking-tight">
            Rulo Üretim Planı
          </h3>
          <p className="text-[12px] text-gri-700 mt-0.5">
            Dinamik en (250–600mm) · gap {fit.gap}mm · {ROLL_MARGIN_X}mm kesim markası ·{" "}
            {ROLL_START_MARGIN}mm başlangıç · {ROLL_END_MARGIN}mm bitiş
            {fit.mode === "tabaka"
              ? " · esnek iç tabaka (max 230×310mm)"
              : " · sticker doğrudan rulo"}
          </p>
        </div>
        <div className="flex gap-5 shrink-0">
          <RpStat label="Rulo" value={roll.rollsNeeded.toString()} />
          <RpStat
            label={isTabaka ? "Tabaka/Rulo" : "Sticker/Rulo"}
            value={`${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll}`}
          />
          <RpStat label="Verimlilik" value={`%${efficiency.toFixed(0)}`} />
        </div>
      </div>

      {/* SVG body */}
      <div className="bg-gri-50 p-6 flex justify-center min-h-[200px]">
        <RollPlanSvg geometry={geometry} />
      </div>

      {/* Foot */}
      <div className="px-5 py-3.5 text-[13px] text-gri-600 bg-gri-50 border-t border-dashed border-gri-200 tabular-nums">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <span>
            {roll.rollsNeeded === 1 ? "Tek rulo" : `${roll.rollsNeeded} rulo`} ·{" "}
            {roll.rollsNeeded === 1
              ? `${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} ${isTabaka ? "tabaka" : "sticker"}`
              : `son: ${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll}${isTabaka ? "" : " sticker"}`}
          </span>
          <span>
            {fit.cols}×{fit.rows} grid ·{" "}
            {fit.mode === "diecut"
              ? fit.forcedDieCut
                ? "die-cut (tabaka sığmadı)"
                : `Sticker ${fit.stickerW}×${fit.stickerH}mm · die-cut direkt rulo`
              : `esnek tabaka ${fit.sheetW}×${fit.sheetH}mm`}
          </span>
        </div>
        <p className="mt-1.5 text-gri-700 leading-snug">
          {baskiAlanLabel}:{" "}
          <strong>{baskiAlanM2.toFixed(3)} m²</strong>
          {" · "}
          Fireli rulo: <strong>{geometry.totalM2.toFixed(3)} m²</strong>
          {" · "}
          {roll.rollW}mm en
          {roll.rollW < 600 && (
            <span className="text-yesil ml-1">
              ({600 - roll.rollW}mm tasarruf)
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}

function RpStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[11px] tracking-[0.12em] uppercase text-gri-700 font-bold mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SheetPreviewCard({
  result,
}: {
  result: ReturnType<typeof quoteSticker>;
}) {
  if (!result.ok) return null;
  const { geometry } = result;
  const { fit } = geometry;
  const isTabaka = fit.mode === "tabaka";

  return (
    <Card padding="p-5">
      <div className="text-[13px] uppercase tracking-[0.12em] text-gri-700 font-bold mb-3 flex items-center justify-between">
        <span>
          {isTabaka
            ? `${fit.sheetW / 10}×${fit.sheetH / 10} cm Esnek Tabaka`
            : `Die-cut Yakın Plan · ${fit.stickerW}×${fit.stickerH} mm`}
        </span>
        <span className="text-[12px] tabular-nums px-2 py-0.5 rounded-full bg-krem text-lacivert font-semibold">
          {isTabaka
            ? `${fit.cols}×${fit.rows} · ${fit.perSheet} ad · gap ${fit.gap}mm`
            : `${fit.cols}×${fit.rows} rulo grid · gap ${fit.gap}mm`}
        </span>
      </div>
      <div className="bg-gri-50 ring-1 ring-dashed ring-gri-200 rounded-lg p-3 flex items-center justify-center overflow-hidden min-h-[280px]">
        <SheetPreviewSvg geometry={geometry} />
      </div>
      {fit.rotated && (
        <div className="mt-2 text-[11px] text-gri-500 text-center tabular-nums">
          ⟳ sticker 90° döndürüldü ({fit.stickerW}×{fit.stickerH}mm)
        </div>
      )}
    </Card>
  );
}

function UretimOzetiCard({
  result,
}: {
  result: ReturnType<typeof quoteSticker>;
}) {
  if (!result.ok) return null;
  const { geometry } = result;
  const { fit, roll } = geometry;
  const isTabaka = fit.mode === "tabaka";
  const baskiAlanM2 = isTabaka ? geometry.sheetAreaM2 : geometry.stickerArea;
  const baskiAlanHint = isTabaka ? "tabakaların alanı" : "sticker alanı";

  return (
    <Card padding="p-5">
      <div className="text-[13px] uppercase tracking-[0.12em] text-gri-700 font-bold mb-3 flex items-center justify-between">
        <span>Üretim Özeti</span>
        <span
          className={cn(
            "text-[11px] tabular-nums px-2 py-0.5 rounded-full font-semibold",
            fit.mode === "diecut"
              ? "bg-pim-mercan text-white"
              : "bg-krem text-lacivert"
          )}
        >
          {fit.mode === "diecut"
            ? fit.forcedDieCut
              ? "die-cut · tabaka sığmadı"
              : "die-cut · direkt rulo"
            : "esnek tabaka"}
        </span>
      </div>

      {/* 4 stat */}
      <div className="grid grid-cols-2 gap-3">
        <StatCell
          label={isTabaka ? "Adet/Tabaka" : "Adet/Rulo"}
          value={fit.perSheet.toString()}
        />
        {isTabaka && (
          <StatCell label="Toplam Tabaka" value={fit.sheetsNeeded.toString()} />
        )}
        <StatCell
          label="Baskı yapılan alan"
          hint={baskiAlanHint}
          value={baskiAlanM2.toFixed(3)}
          unit="m²"
        />
        <StatCell
          label={isTabaka ? "Fireli rulo tabaka" : "Fireli rulo"}
          hint="fire + kesim markası dahil"
          value={geometry.totalM2.toFixed(3)}
          unit="m²"
          accent
        />
        <StatCell
          label="Toplam Rulo"
          value={roll.rollsNeeded.toString()}
          className="col-span-2"
        />
      </div>

      {/* Mini bar */}
      <div className="mt-3" title="60cm rulo eninde dolu / fire dağılımı">
        <RollMiniBar geometry={geometry} />
      </div>

      {/* Waste */}
      <div className="mt-3 px-3 py-2 rounded-lg bg-pim-mercan-tint/40 text-[12px] flex justify-between items-center border-l-[3px] border-pim-mercan">
        <span>
          <strong className="text-pim-mercan-koyu">
            %{geometry.wastePct.toFixed(1)} fire
          </strong>
        </span>
        <span className="text-gri-700 tabular-nums text-[12px]">
          {geometry.stickerArea.toFixed(3)} m² sticker
          {isTabaka ? (
            <>
              {" · "}
              {geometry.sheetAreaM2.toFixed(3)} m² tabaka
            </>
          ) : null}
          {" · "}
          {geometry.totalM2.toFixed(3)} m² rulo
        </span>
      </div>

      {/* Layout details */}
      <div className="mt-3 text-[10.5px] text-gri-500 tabular-nums">
        {isTabaka ? (
          <>Tabaka: {fit.sheetW}×{fit.sheetH}mm · </>
        ) : (
          <>Sticker: {fit.stickerW}×{fit.stickerH}mm · </>
        )}
        Grid: {fit.cols}×{fit.rows} · Gap: {fit.gap}mm
        {fit.forcedDieCut && " · zorla die-cut"}
      </div>
    </Card>
  );
}

function StatCell({
  label,
  value,
  unit,
  accent,
  hint,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        accent ? "bg-pim-mercan-tint/60" : "bg-gri-50",
        className
      )}
    >
      <div
        className={cn(
          "text-[11px] uppercase tracking-[0.08em] font-bold mb-1",
          accent ? "text-pim-mercan-koyu" : "text-gri-700"
        )}
      >
        {label}
      </div>
      {hint ? (
        <div className="text-[10px] text-gri-600 mb-1 normal-case tracking-normal font-medium">
          {hint}
        </div>
      ) : null}
      <div className="text-[20px] font-bold tracking-tight tabular-nums">
        {value}
        {unit && <span className="text-[12px] text-gri-500 ml-1 font-medium">{unit}</span>}
      </div>
    </div>
  );
}
