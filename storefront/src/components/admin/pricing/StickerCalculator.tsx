/**
 * Pim Etiket â€” Sticker fiyat hesaplayÄ±cÄ± (embed + standalone)
 *
 * OperatÃ¶r manuel fiyat hesaplama + parametre tuning aracÄ±.
 * Sefa "fiyat geliÅŸtirme Ã§alÄ±ÅŸmalarÄ± + manuel kontrol" iÃ§in istedi.
 *
 * Pricing engine lib'i (storefront/src/lib/pricing-engine/) kullanÄ±r.
 * sticker-fiyatlama.html v0.3'Ã¼n operatÃ¶r UI'Ä±nÄ±n React port'u.
 *
 * Kapsam (Faz 1):
 *   âœ“ Mode toggle (fason/Ã¼retim)
 *   âœ“ Cut type (tabaka/diecut)
 *   âœ“ Boyut input (W Ã— H)
 *   âœ“ Tier butonlarÄ± (25/50/100/250/500/1000)
 *   âœ“ Ãœretim parametre input'larÄ± (fason rate / 6 Ã¼retim kalemi)
 *   âœ“ Site fiyatÄ± (live config, alÄ±ÅŸ/satÄ±ÅŸ Ã§ift fiyat)
 *   âœ“ Fason/Ã¼retim simÃ¼lasyonu (operatÃ¶r referans)
 *   âœ“ AnlÄ±k fiyat (bÃ¼yÃ¼k), birim fiyat
 *   âœ“ Stat kartlarÄ± (tabaka, mÂ², rulo, fire)
 *   âœ“ Maliyet detayÄ± breakdown
 *   âœ“ Tolerans bandÄ± (overrun bilgisi)
 *   âœ“ Reset + varsayÄ±lana dÃ¶n
 *
 * Sonraki faz (henÃ¼z yok):
 *   - Rulo plan SVG gÃ¶rseli
 *   - Tabaka dizgi SVG
 *   - Sepet sistemi
 *   - PDF iÅŸ emri
 *   - Lot sayacÄ± (DB gerek)
 *   - Ä°statistik modal (DB gerek)
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  STICKER_TIERS,
  type StickerTier,
  type CutType,
  quoteSticker,
  findTier,
} from "@/lib/pricing-engine";
import { ProfileTabs } from "@/components/admin/pricing/ProfileTabs";
import { RollPlanSvg } from "@/components/admin/pricing/RollPlanSvg";
import { ProfileBar } from "@/components/admin/pricing/ProfileBar";
import {
  getDefaultInput,
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
  type ProfileConfig,
} from "@/lib/pricing-config-types";

// ============================================================
// Defaults â€” v0.4: overhead 45 (SaaS recovery), customerType
// ============================================================

const DEFAULT_PREVIEW_MATERIAL = "vinil";
const DEFAULT_PREVIEW_FINISH = "parlak";
const DEFAULTS: ProfileInputSnapshot = getDefaultInput();

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

  // State â€” mÃ¼ÅŸteri konfigÃ¼ratÃ¶rÃ¼ ile aynÄ± akÄ±ÅŸ
  const [cut, setCut] = useState<CutType>(DEFAULTS.cut);
  const [width, setWidth] = useState<number>(DEFAULTS.width);
  const [height, setHeight] = useState<number>(DEFAULTS.height);
  const [qty, setQty] = useState<number>(DEFAULTS.qty);
  const [fasonRate, setFasonRate] = useState<number>(DEFAULTS.fasonRate);

  const [previewMaterialId, setPreviewMaterialId] = useState<string>(
    DEFAULT_PREVIEW_MATERIAL
  );
  const [previewFinishId, setPreviewFinishId] = useState<string>(
    DEFAULT_PREVIEW_FINISH
  );

  // Aktif profil ID
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();

  // Lot rozeti â€” bir sonraki lot numarasÄ±
  const [nextLotPreview, setNextLotPreview] = useState<string>("A000001");
  const [statsOpen, setStatsOpen] = useState(false);
  const [liveStickerConfig, setLiveStickerConfig] = useState<ProfileConfig>(
    liveConfig ?? FALLBACK_STICKER_CONFIG
  );
  const [liveConfigLoaded, setLiveConfigLoaded] = useState(!!liveConfig);

  useEffect(() => {
    setNextLotPreview(peekNextLot("A"));
  }, []);

  useEffect(() => {
    if (liveConfig) {
      setLiveStickerConfig(liveConfig);
      setLiveConfigLoaded(true);
    }
  }, [liveConfig]);

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
        /* fallback config kalÄ±r */
      } finally {
        if (!cancelled) setLiveConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveConfig]);

  // Hesap â€” geometri + fason simÃ¼lasyonu
  const result = quoteSticker({
    width,
    height,
    cut,
    qty,
    production: { mode: "fason", rate: fasonRate },
    operation: { setup: 0, packaging: 0, feePct: 0 },
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

  const fasonPartnerCost = result.ok ? result.geometry.totalM2 * fasonRate : null;

  function handleGeneratePDF() {
    if (!result.ok) {
      toast.error("Ã–nce geÃ§erli bir hesaplama yap");
      return;
    }
    if (!liveSitePrice?.ok) {
      toast.error(
        liveSitePrice && !liveSitePrice.ok
          ? liveSitePrice.reason
          : "Site fiyatÄ± hesaplanamadÄ±"
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
      mode: "fason",
    });

    recordStat({
      lot,
      product: "sticker",
      mode: "fason",
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

    toast.success(`Ä°ÅŸ emri ${lot} Ã¼retildi (PDF indirildi)`);
  }

  // Profile snapshot â€” current state'i serialize et
  const currentInput: ProfileInputSnapshot = {
    ...getDefaultInput(),
    mode: "fason",
    cut,
    width,
    height,
    qty,
    fasonRate,
  };

  function loadProfile(p: PricingProfile) {
    const i = { ...getDefaultInput(), ...p.input };
    setCut(i.cut);
    setWidth(i.width);
    setHeight(i.height);
    setQty(i.qty);
    setFasonRate(i.fasonRate);
    setActiveProfileId(p.id);
    toast.success(`"${p.name}" profili yÃ¼klendi`);
  }

  function reset() {
    const d = getDefaultInput();
    setCut(d.cut);
    setWidth(d.width);
    setHeight(d.height);
    setQty(d.qty);
    setFasonRate(d.fasonRate);
    setPreviewMaterialId(DEFAULT_PREVIEW_MATERIAL);
    setPreviewFinishId(DEFAULT_PREVIEW_FINISH);
    setActiveProfileId(undefined);
    toast.success("VarsayÄ±lan deÄŸerlere dÃ¶nÃ¼ldÃ¼");
  }

  function copyJSON() {
    const payload = { input: currentInput, result, liveSitePrice };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast.success("JSON kopyalandÄ±"))
      .catch(() => toast.error("Kopyalama baÅŸarÄ±sÄ±z"));
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
            <Eyebrow>OperatÃ¶r Â· Hesaplama aracÄ±</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              ğŸ· Sticker Fiyat Hesapla
            </h1>
            <p className="mt-2 text-base text-gri-700">
              Vinil / Transparan / Holografik / Simli iÃ§in manuel hesap +
              parametre tuning.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-pim-mercan text-white text-[12px] font-bold tabular-nums shadow-mercan"
              title="Bir sonraki PDF iÅŸ emri lot numarasÄ±"
            >
              <Icon.Box size={12} /> Lot Â· {nextLotPreview}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setStatsOpen(true)}>
              ğŸ“Š Ä°statistik
            </Button>
            <Button variant="ghost" size="sm" onClick={copyJSON}>
              <Icon.Sparkle size={14} /> JSON kopyala
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              SÄ±fÄ±rla
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={!result.ok || !liveSitePrice?.ok}
            >
              ğŸ“„ Ä°ÅŸ Emri PDF
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
          {/* LEFT â€” Input (mÃ¼ÅŸteri konfigÃ¼ratÃ¶rÃ¼ akÄ±ÅŸÄ±) */}
          <div className="space-y-4">
            {/* Kart 1: ÃœrÃ¼n seÃ§imi */}
            <Card padding="p-5">
              <SectionTitle accent="mercan">â‘  ÃœrÃ¼n SeÃ§imi</SectionTitle>

              <Field label="Malzeme">
                <ChipGrid
                  options={liveStickerConfig.materials.map((m) => ({
                    id: m.id,
                    label: m.name,
                  }))}
                  value={previewMaterialId}
                  onChange={setPreviewMaterialId}
                />
              </Field>

              <Field label="FiniÅŸ">
                <ChipGrid
                  options={(liveStickerConfig.options.finish?.items ?? []).map(
                    (f) => ({ id: f.id, label: f.name })
                  )}
                  value={previewFinishId}
                  onChange={setPreviewFinishId}
                />
              </Field>

              <Field label="Kesim Tipi" hint="fire & dizgi farkÄ±">
                <div className="grid grid-cols-2 gap-2">
                  <CutCard
                    selected={cut === "tabaka"}
                    onClick={() => setCut("tabaka")}
                    title="Tabaka"
                    desc="YarÄ±m kesim, mÃ¼ÅŸteri soyar"
                    spec="6 mm boÅŸluk"
                  />
                  <CutCard
                    selected={cut === "diecut"}
                    onClick={() => setCut("diecut")}
                    title="Die Cut"
                    desc="Tam kesim, tek tek"
                    spec="50 mm boÅŸluk"
                  />
                </div>
              </Field>
            </Card>

            {/* Kart 2: Boyut + adet */}
            <Card padding="p-5">
              <SectionTitle accent="turuncu">â‘¡ Boyut + Adet</SectionTitle>

              <Field label="Sticker Boyutu" hint="milimetre">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <NumInput
                    value={width}
                    onChange={setWidth}
                    suffix="mm Â· GEN."
                    min={5}
                    max={400}
                  />
                  <span className="text-gri-500 font-medium">Ã—</span>
                  <NumInput
                    value={height}
                    onChange={setHeight}
                    suffix="mm Â· YÃœK."
                    min={5}
                    max={650}
                  />
                </div>
              </Field>

              <Field label="Adet Kademesi" hint="tasarÄ±m baÅŸÄ±na">
                <TierGrid value={qty} onChange={setQty} />
              </Field>
            </Card>

            {/* Kart 3: Fason maliyet simÃ¼lasyonu */}
            <Card padding="p-5">
              <SectionTitle accent="yesil">â‘¢ Fason Maliyet</SectionTitle>
              <Field label="Fason Birim Maliyet" hint="mÂ² baÅŸÄ±na Â· simÃ¼lasyon">
                <NumInput
                  value={fasonRate}
                  onChange={setFasonRate}
                  suffix="â‚º / mÂ²"
                  step={5}
                />
              </Field>
            </Card>
          </div>

          {/* RIGHT â€” Output */}
          <div className="space-y-4">
            <SitePriceHero
              liveSitePrice={liveSitePrice}
              qty={qty}
              tier={displayTier}
              totalM2={result.ok ? result.geometry.totalM2 : 0}
              sheetsNeeded={result.ok ? result.geometry.fit.sheetsNeeded : 0}
            />

            {result.ok && fasonPartnerCost != null && liveSitePrice?.ok && (
              <SimulationCostCard
                fasonCost={fasonPartnerCost}
                fasonRate={fasonRate}
                totalM2={result.geometry.totalM2}
                siteFinal={liveSitePrice.final}
              />
            )}

            {result.ok ? (
              <RollPlanCard result={result} />
            ) : (
              <Card padding="p-8" className="text-center">
                <Icon.Info size={32} className="mx-auto text-gri-500 mb-2" />
                <p className="text-base text-gri-700">{result.reason}</p>
                {result.bigEtiketRedirect && (
                  <p className="text-[13px] text-gri-500 mt-2">
                    BÃ¼yÃ¼k etiket servisi yakÄ±nda eklenecek (max 40Ã—65 cm Ã¼stÃ¼).
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>

        <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      </div>
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

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

function SectionTitle({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: "mercan" | "turuncu" | "yesil";
}) {
  const dotColor = {
    mercan: "bg-pim-mercan",
    turuncu: "bg-turuncu",
    yesil: "bg-yesil",
  }[accent];
  return (
    <div className="flex items-center gap-2 mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-gri-700">
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColor)} />
      <span>{children}</span>
    </div>
  );
}

function ChipGrid({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "h-11 px-3 rounded-lg text-[13px] font-medium transition-all text-left truncate",
            value === o.id
              ? "bg-lacivert text-white ring-2 ring-lacivert shadow-1"
              : "bg-gri-50 ring-1 ring-gri-200 text-gri-700 hover:bg-white hover:ring-gri-300"
          )}
        >
          {o.label}
        </button>
      ))}
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
              {ref ? "referans" : tier.label.replace("zam", "").replace("indirim", "").trim()}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SitePriceHero({
  liveSitePrice,
  qty,
  tier,
  totalM2,
  sheetsNeeded,
}: {
  liveSitePrice: ReturnType<typeof calculatePrice> | null;
  qty: number;
  tier: StickerTier | { qty: number; multiplier: number; label: string };
  totalM2: number;
  sheetsNeeded: number;
}) {
  if (!liveSitePrice?.ok) {
    return (
      <Card
        padding="p-6"
        className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white"
      >
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
          Site FiyatÄ± (KDV Dahil)
        </div>
        <div className="text-[32px] font-bold">â€”</div>
        <p className="mt-2 text-[13px] text-white/70">
          {liveSitePrice && !liveSitePrice.ok
            ? liveSitePrice.reason
            : "HesaplanamadÄ±"}
        </p>
      </Card>
    );
  }

  const profit = liveSitePrice.with_margin - liveSitePrice.cost_total;
  const profitPct =
    liveSitePrice.cost_total > 0
      ? (profit / liveSitePrice.cost_total) * 100
      : 0;
  const vat = liveSitePrice.final - liveSitePrice.with_fee;
  const billableM2 = liveSitePrice.billable_m2 ?? totalM2;

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
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold">
            Site FiyatÄ± (KDV Dahil)
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold">
              Birim Fiyat
            </div>
            <div className="text-[22px] font-bold tabular-nums leading-none mt-0.5">
              {fmt(liveSitePrice.unit_price, 2)}{" "}
              <span className="text-[14px] text-white/70 font-medium">â‚º/adet</span>
            </div>
          </div>
        </div>
        <div className="text-[42px] font-bold tabular-nums leading-none">
          {fmt(Math.round(liveSitePrice.final))}{" "}
          <span className="text-pim-mercan text-[24px]">â‚º</span>
        </div>
        <p className="text-[13px] text-white/70 mt-2 tabular-nums">
          {qty.toLocaleString("tr-TR")} adet Â· {sheetsNeeded} tabaka Â·{" "}
          {billableM2.toFixed(3)} mÂ² Â· Tier {tier.label}
        </p>
        <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-2 md:grid-cols-4 gap-3">
          <VatCell
            label="Maliyet"
            value={`${fmt(Math.round(liveSitePrice.cost_total))} â‚º`}
          />
          <VatCell
            label="SatÄ±ÅŸ"
            value={`${fmt(Math.round(liveSitePrice.with_margin))} â‚º`}
          />
          <VatCell
            label="KÃ¢r"
            value={`${fmt(Math.round(profit))} â‚º`}
            subtitle={`%${profitPct.toFixed(0)} kÃ¢r`}
          />
          <VatCell label="KDV" value={`${fmt(Math.round(vat))} â‚º`} />
        </div>
      </div>
    </Card>
  );
}

function SimulationCostCard({
  fasonCost,
  fasonRate,
  totalM2,
  siteFinal,
}: {
  fasonCost: number;
  fasonRate: number;
  totalM2: number;
  siteFinal: number;
}) {
  const diff = siteFinal - fasonCost;
  const pct = fasonCost > 0 ? (diff / fasonCost) * 100 : 0;
  const profitable = diff >= 0;

  return (
    <Card padding="p-5" className="ring-1 ring-gri-200 bg-gri-50/50">
      <div className="text-[11px] uppercase tracking-[0.15em] text-gri-500 mb-3 font-semibold">
        SimÃ¼lasyon Maliyeti
      </div>
      <div className="space-y-2 text-[14px] tabular-nums text-gri-800">
        <p>
          Fason: <strong>{fmt(Math.round(fasonCost))} â‚º</strong> (
          {fmt(fasonRate)} â‚º/mÂ² Ã— {totalM2.toFixed(3)} mÂ²)
        </p>
        <p>
          Site satÄ±ÅŸ: <strong>{fmt(Math.round(siteFinal))} â‚º</strong>
        </p>
        <div className="border-t border-gri-200 pt-3 mt-3">
          <p className="font-semibold text-lacivert">
            FARK: {diff >= 0 ? "+" : ""}
            {fmt(Math.round(diff))} â‚º ({pct.toFixed(0)}% kÃ¢r)
          </p>
          <p
            className={cn(
              "text-[13px] mt-1",
              profitable ? "text-yesil" : "text-pim-mercan-koyu"
            )}
          >
            {profitable
              ? "Fason bu fiyatla kÃ¢rlÄ± âœ…"
              : "Fason bu fiyatla zarar âš ï¸"}
          </p>
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
  const efficiency =
    (fit.sheetsNeeded / (roll.rollsNeeded * roll.sheetsPerRoll)) * 100;

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Head â€” title + inline stats */}
      <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block text-[10px] tracking-[0.18em] uppercase text-pim-mercan font-bold mb-1">
            Ã¼retim katmanÄ±
          </span>
          <h3 className="text-[18px] font-semibold tracking-tight">
            Rulo Ãœretim PlanÄ±
          </h3>
          <p className="text-[12px] text-gri-700 mt-0.5">
            Dinamik en (250-600mm) Â· 40mm kesim markasÄ± Â· 50mm baÅŸlangÄ±Ã§
          </p>
        </div>
        <div className="flex gap-5 shrink-0">
          <RpStat label="Rulo" value={roll.rollsNeeded.toString()} />
          <RpStat
            label="Tabaka/Rulo"
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
      <div className="px-5 py-3 text-[11px] text-gri-500 bg-gri-50 border-t border-dashed border-gri-200 flex flex-wrap justify-between gap-2 tabular-nums">
        <span>
          âš™ {roll.rollsNeeded === 1 ? "Tek rulo" : `${roll.rollsNeeded} rulo`} Â·{" "}
          {roll.rollsNeeded === 1
            ? `${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} tabaka`
            : `son: ${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll}`}{" "}
          Â· {geometry.totalM2.toFixed(3)} mÂ² Â· {roll.rollW}mm en
          {roll.rollW < 600 && (
            <span className="text-yesil ml-1">
              ({600 - roll.rollW}mm tasarruf)
            </span>
          )}
        </span>
        <span>
          {fit.cols}Ã—{fit.rows} grid Â·{" "}
          {fit.mode === "big" ? "40Ã—65 bÃ¼yÃ¼k tabaka" : "23Ã—31 kÃ¼Ã§Ã¼k tabaka"}
        </span>
      </div>
    </Card>
  );
}

function RpStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] tracking-[0.12em] uppercase text-gri-700 font-bold mb-1">
        {label}
      </div>
      <div className="text-[20px] font-bold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  );
}
