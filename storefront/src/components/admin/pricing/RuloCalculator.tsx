/**
 * Pim Etiket — Rulo etiket fiyat hesaplayıcı (embed + standalone)
 *
 * Sticker sayfasından farklılaşma:
 *   - Tabaka YOK, doğrudan rulo
 *   - Min 1000 adet (max 50000)
 *   - Tier 1K/2K/5K/10K/20K/50K
 *   - Malzeme + Kaplama + Özelleştirme % multiplier'lar
 *   - Lot prefix B
 *   - PDF iş emri (B serisi)
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ETIKET_TIERS,
  ETIKET_MATERIALS,
  ETIKET_COATINGS,
  ETIKET_CUSTOMIZATIONS,
  quoteEtiket,
  findEtiketTier,
  adaptEtiketToGeometryResult,
  type ProductionMode,
} from "@/lib/pricing-engine";
import {
  generateWorkOrderPDF,
  nextLot,
  peekNextLot,
} from "@/lib/pricing-pdf";
import { ProfileTabs } from "@/components/admin/pricing/ProfileTabs";
import { RollPlanSvg } from "@/components/admin/pricing/RollPlanSvg";
import { RollMiniBar } from "@/components/admin/pricing/RollMiniBar";
import { addToCart, type CartItem } from "@/lib/pricing-cart";
import { CartPanel } from "@/components/admin/pricing/CartPanel";
import {
  reconstructGeometryFromCart,
  reconstructCostFromCart,
} from "@/lib/cart-pdf-helpers";
import { StatsModal } from "@/components/admin/pricing/StatsModal";
import { recordStat } from "@/lib/pricing-stats";
import type { ProfileConfig } from "@/lib/pricing-config-types";
import { FALLBACK_ETIKET_RULO_CONFIG } from "@/lib/pricing-config-types";
import {
  comparePricebookVsLegacyArea,
  quoteRuloFromPricebook,
  FALLBACK_PRICEBOOK_SNAPSHOT,
  type PricebookSnapshot,
} from "@/lib/pricing-pricebook";

// ============================================================
// Defaults
// ============================================================

const DEFAULTS = {
  mode: "fason" as ProductionMode,
  width: 60,
  height: 80,
  qty: 5000,
  materialId: "kraft",
  coatingId: "mat",
  customizationId: "yok",
  // Production
  fasonRate: 120,
  paper: 45,
  ink: 25,
  coating: 15,
  labor: 35,
  overhead: 45,
  depreciation: 10,
  // Operation
  setup: 100, // etiket setup biraz daha pahalı
  packaging: 25, // rulo paketleme zarftan ağır
  cargo: 100,
  feePct: 2.5,
  // Margin
  marginPct: 75,
  vatPct: 20,
  minMarkupFraction: 0.10,
};

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

// ============================================================
// Page
// ============================================================

export interface RuloCalculatorProps {
  liveConfig?: ProfileConfig | null;
  embedded?: boolean;
}

export function RuloCalculator({
  liveConfig,
  embedded = false,
}: RuloCalculatorProps) {
  const toast = useToast();

  // State
  const [mode, setMode] = useState<ProductionMode>(DEFAULTS.mode);
  const [width, setWidth] = useState(DEFAULTS.width);
  const [height, setHeight] = useState(DEFAULTS.height);
  const [qty, setQty] = useState(DEFAULTS.qty);
  const [materialId, setMaterialId] = useState(DEFAULTS.materialId);
  const [coatingId, setCoatingId] = useState(DEFAULTS.coatingId);
  const [customizationId, setCustomizationId] = useState(DEFAULTS.customizationId);

  // Production
  const [fasonRate, setFasonRate] = useState(DEFAULTS.fasonRate);
  const [paper, setPaper] = useState(DEFAULTS.paper);
  const [ink, setInk] = useState(DEFAULTS.ink);
  const [coating, setCoating] = useState(DEFAULTS.coating);
  const [labor, setLabor] = useState(DEFAULTS.labor);
  const [overhead, setOverhead] = useState(DEFAULTS.overhead);
  const [depreciation, setDepreciation] = useState(DEFAULTS.depreciation);

  // Operation
  const [setup, setSetup] = useState(DEFAULTS.setup);
  const [packaging, setPackaging] = useState(DEFAULTS.packaging);
  const [cargo, setCargo] = useState(DEFAULTS.cargo);
  const [feePct, setFeePct] = useState(DEFAULTS.feePct);

  // Margin
  const [marginPct, setMarginPct] = useState(DEFAULTS.marginPct);
  const [vatPct, setVatPct] = useState(DEFAULTS.vatPct);
  const [minMarkupFraction, setMinMarkupFraction] = useState(DEFAULTS.minMarkupFraction);

  // Lot rozet
  const [nextLotPreview, setNextLotPreview] = useState("B000001");
  const [statsOpen, setStatsOpen] = useState(false);
  const [liveRuloConfig, setLiveRuloConfig] = useState<ProfileConfig>(
    liveConfig ?? FALLBACK_ETIKET_RULO_CONFIG
  );
  const [pricebookSnapshot, setPricebookSnapshot] =
    useState<PricebookSnapshot>(FALLBACK_PRICEBOOK_SNAPSHOT);
  const [livePricingLoaded, setLivePricingLoaded] = useState(!!liveConfig);

  useEffect(() => {
    setNextLotPreview(peekNextLot("B"));
  }, []);

  useEffect(() => {
    if (liveConfig) {
      setLiveRuloConfig(liveConfig);
      setLivePricingLoaded(true);
    }
  }, [liveConfig]);

  useEffect(() => {
    if (liveConfig) {
      let cancelled = false;
      (async () => {
        try {
          const pbRes = await fetch("/api/admin/pricebook", { cache: "no-store" });
          const pbJson = (await pbRes.json()) as {
            ok?: boolean;
            snapshot?: PricebookSnapshot;
          };
          if (!cancelled && pbRes.ok && pbJson.ok && pbJson.snapshot) {
            setPricebookSnapshot(pbJson.snapshot);
          }
        } catch {
          /* fallback kalır */
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    (async () => {
      try {
        const [cfgRes, pbRes] = await Promise.all([
          fetch("/api/admin/pricing?scope=etiket_rulo", { cache: "no-store" }),
          fetch("/api/admin/pricebook", { cache: "no-store" }),
        ]);
        const cfgJson = (await cfgRes.json()) as {
          ok?: boolean;
          live?: ProfileConfig;
        };
        const pbJson = (await pbRes.json()) as {
          ok?: boolean;
          snapshot?: PricebookSnapshot;
        };
        if (!cancelled && cfgRes.ok && cfgJson.ok && cfgJson.live) {
          setLiveRuloConfig(cfgJson.live);
        }
        if (!cancelled && pbRes.ok && pbJson.ok && pbJson.snapshot) {
          setPricebookSnapshot(pbJson.snapshot);
        }
      } catch {
        /* fallback kalır */
      } finally {
        if (!cancelled) setLivePricingLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveConfig]);

  // Quote
  const result = quoteEtiket({
    width,
    height,
    qty,
    materialId,
    coatingId,
    customizationId,
    production:
      mode === "fason"
        ? { mode: "fason", rate: fasonRate }
        : {
            mode: "uretim",
            paper,
            ink,
            coating,
            labor,
            overhead,
            depreciation,
          },
    operation: { setup, packaging, cargo, feePct },
    margin: { marginPct, vatPct, minMarkupFraction },
  });

  const tier = findEtiketTier(qty);

  const livePricebookQuote = useMemo(() => {
    if (!result.ok) return null;
    return quoteRuloFromPricebook(pricebookSnapshot, liveRuloConfig, {
      width_mm: width,
      height_mm: height,
      qty,
      material_key: materialId,
      selected_options: {
        coating: coatingId,
        customization: customizationId === "yok" ? [] : [customizationId],
      },
    });
  }, [
    result,
    pricebookSnapshot,
    liveRuloConfig,
    width,
    height,
    qty,
    materialId,
    coatingId,
    customizationId,
  ]);

  const liveShadow = useMemo(() => {
    if (!result.ok) return null;
    return comparePricebookVsLegacyArea(liveRuloConfig, pricebookSnapshot, {
      width_mm: width,
      height_mm: height,
      qty,
      material_key: materialId,
      selected_options: {
        coating: coatingId,
        customization: customizationId === "yok" ? [] : [customizationId],
      },
    });
  }, [
    result,
    pricebookSnapshot,
    liveRuloConfig,
    width,
    height,
    qty,
    materialId,
    coatingId,
    customizationId,
  ]);

  const fasonPartnerCost =
    result.ok && mode === "fason"
      ? result.geometry.totalM2 * fasonRate
      : null;

  function reset() {
    setMode(DEFAULTS.mode);
    setWidth(DEFAULTS.width);
    setHeight(DEFAULTS.height);
    setQty(DEFAULTS.qty);
    setMaterialId(DEFAULTS.materialId);
    setCoatingId(DEFAULTS.coatingId);
    setCustomizationId(DEFAULTS.customizationId);
    setFasonRate(DEFAULTS.fasonRate);
    setPaper(DEFAULTS.paper);
    setInk(DEFAULTS.ink);
    setCoating(DEFAULTS.coating);
    setLabor(DEFAULTS.labor);
    setOverhead(DEFAULTS.overhead);
    setDepreciation(DEFAULTS.depreciation);
    setSetup(DEFAULTS.setup);
    setPackaging(DEFAULTS.packaging);
    setCargo(DEFAULTS.cargo);
    setFeePct(DEFAULTS.feePct);
    setMarginPct(DEFAULTS.marginPct);
    setVatPct(DEFAULTS.vatPct);
    setMinMarkupFraction(DEFAULTS.minMarkupFraction);
    toast.success("Varsayılan değerlere dönüldü");
  }

  function handleGeneratePDF() {
    if (!result.ok) {
      toast.error("Önce geçerli bir hesaplama yap");
      return;
    }
    const lot = nextLot("B"); // B serisi etiket
    setNextLotPreview(peekNextLot("B"));

    // Etiket geometry → GeometryResult adapter (PDF için)
    const eg = result.geometry;
    const fakeGeom = {
      fit: {
        mode: "small" as const,
        cols: eg.cols,
        rows: eg.rowsPerRoll,
        perSheet: eg.perRoll,
        sheetsNeeded: eg.rollsNeeded,
        sheetW: eg.rollW,
        sheetH: eg.totalLengthMm / Math.max(eg.rollsNeeded, 1),
        stickerW: eg.width,
        stickerH: eg.height,
        usedW: eg.cols * eg.width + (eg.cols - 1) * eg.gap,
        usedH: eg.rowsPerRoll * eg.height + (eg.rowsPerRoll - 1) * eg.gap,
        gap: eg.gap,
        rotated: false,
        forcedDieCut: false,
        producedQty: eg.qty,
        overrun: 0,
      },
      roll: {
        rollW: eg.rollW,
        cols: eg.cols,
        rows: eg.rowsPerRoll,
        sheetsPerRoll: eg.perRoll,
        rollsNeeded: eg.rollsNeeded,
        sheetsOnLastRoll: eg.etiketsOnLastRoll,
        lastRowsCount: eg.lastRowsCount,
        lastRollLengthMm: eg.lastRollLengthMm,
        totalLengthMm: eg.totalLengthMm,
        totalArea: eg.totalM2 * 1_000_000,
        usableW: eg.cols * eg.width,
        usableL: 1470,
        extraSidePad: 0,
      },
      totalM2: eg.totalM2,
      stickerArea: eg.etiketArea,
      wastePct: eg.wastePct,
      effectiveCut: "diecut" as const,
    };

    // Malzeme/kaplama/özelleştirme isimlerini PDF'e geç
    const matName = ETIKET_MATERIALS.find((m) => m.id === materialId)?.name;
    const coatName = ETIKET_COATINGS.find((c) => c.id === coatingId)?.name;
    const custName = ETIKET_CUSTOMIZATIONS.find((c) => c.id === customizationId)?.name;

    generateWorkOrderPDF({
      lot,
      geometry: fakeGeom,
      cost: result.cost,
      requestedQty: qty,
      cut: "diecut",
      mode,
      product: "etiket",
      etiketDetails: {
        material: matName,
        coating: coatName,
        customization: custName,
      },
    });

    // İstatistik kaydı
    recordStat({
      lot,
      product: "etiket",
      mode,
      materialId,
      coatingId,
      customizationId,
      width,
      height,
      requestedQty: qty,
      producedQty: result.geometry.qty,
      overrunCount: 0,
      rollsNeeded: result.geometry.rollsNeeded,
      totalM2: result.geometry.totalM2,
      wastePct: result.geometry.wastePct,
      baseCost: result.cost.baseCost,
      intendedProfit: result.cost.intendedProfit,
      actualProfit: result.cost.actualProfit,
      vatAmount: result.cost.vatAmount,
      total: result.cost.total,
      unitPrice: result.cost.unitPrice,
      tierMultiplier: result.cost.tierMultiplier,
    });

    toast.success(`Etiket iş emri ${lot} üretildi`);
  }

  function handleAddToCart() {
    if (!result.ok) {
      toast.error("Önce geçerli bir hesaplama yap");
      return;
    }
    const r = addToCart({
      product: "etiket",
      width,
      height,
      requestedQty: qty,
      producedQty: result.geometry.qty,
      preGroupSubtotal: result.cost.subtotal,
      vatPct,
      tierMultiplier: result.cost.tierMultiplier,
      preGroupTotal: result.cost.total,
      mode,
      materialId,
      coatingId,
      customizationId,
      rollsNeeded: result.geometry.rollsNeeded,
      totalM2: result.geometry.totalM2,
      baseCost: result.cost.baseCost,
      intendedProfit: result.cost.intendedProfit,
      actualProfit: result.cost.actualProfit,
      vatAmount: result.cost.vatAmount,
      total: result.cost.total,
      unitPrice: result.cost.unitPrice,
    });
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    toast.success(`${r.item.name} sepete eklendi`);
  }

  function handleCartPDF(items: CartItem[]) {
    items.forEach((item, idx) => {
      const lot = nextLot(item.product === "sticker" ? "A" : "B");
      setTimeout(() => {
        const fakeGeom = reconstructGeometryFromCart(item);
        const fakeCost = reconstructCostFromCart(item);
        generateWorkOrderPDF({
          lot,
          geometry: fakeGeom,
          cost: fakeCost,
          requestedQty: item.requestedQty,
          cut: item.cut ?? "diecut",
          mode: item.mode,
          product: item.product,
          customerName: item.name,
        });
      }, idx * 200);
    });
    setNextLotPreview(peekNextLot("B"));
    toast.success(`${items.length} adet PDF iş emri üretiliyor`);
  }

  const outerClass = embedded
    ? ""
    : "bg-gri-50 animate-fade-up min-h-[calc(100vh-56px)] py-8 pb-20";

  return (
    <div className={outerClass}>
      <div className={embedded ? "" : "mx-auto max-w-[1280px] px-4 md:px-8"}>
        {!embedded && <ProfileTabs active="rulo" />}

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <Eyebrow>Operatör · Hesaplama aracı</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              📋 Rulo Etiket Fiyat Hesapla
            </h1>
            <p className="mt-2 text-base text-gri-700">
              Kraft / Kuşe / Beyaz / Ultra clear / Metalik · min 1000 adet,
              rulo başına hesaplama.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-pim-mercan text-white text-[12px] font-bold tabular-nums shadow-mercan"
              title="Bir sonraki PDF iş emri lot numarası (B serisi etiket)"
            >
              <Icon.Box size={12} /> Lot · {nextLotPreview}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setStatsOpen(true)}>
              📊 İstatistik
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Sıfırla
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddToCart}
              disabled={!result.ok}
            >
              🛒 Sepete Ekle
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={!result.ok}
            >
              📄 İş Emri PDF
            </Button>
          </div>
        </div>

        {/* 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 items-start">
          {/* LEFT — Input */}
          <div className="space-y-4">
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-4">Sipariş</h2>

              <Field label="Üretim Modu" hint="tedarik senaryosu">
                <SegmentToggle
                  options={[
                    { value: "fason", label: "Fason", sub: "Dış Tedarik" },
                    { value: "uretim", label: "Üretim", sub: "Kendi Makina" },
                  ]}
                  value={mode}
                  onChange={(v) => setMode(v as ProductionMode)}
                />
              </Field>

              <Field label="Etiket Boyutu" hint="milimetre">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <NumInput
                    value={width}
                    onChange={setWidth}
                    suffix="mm · GEN."
                    min={5}
                    max={520}
                  />
                  <span className="text-gri-500 font-medium">×</span>
                  <NumInput
                    value={height}
                    onChange={setHeight}
                    suffix="mm · YÜK."
                    min={5}
                    max={1470}
                  />
                </div>
              </Field>

              <Field label="Adet Kademesi" hint="referans 5000">
                <TierGrid value={qty} onChange={setQty} />
              </Field>
            </Card>

            {/* Malzeme + Kaplama + Özelleştirme */}
            <Card padding="p-5">
              <SectionTitle accent="lacivert">
                Etiket Özellikleri
              </SectionTitle>

              <Field label="Malzeme" hint="ana fason rate'e × multiplier">
                <SwatchSelect
                  options={ETIKET_MATERIALS.map((m) => ({
                    id: m.id,
                    name: m.name,
                    desc: m.desc,
                    swatch: m.swatch,
                    label: `×${m.multiplier.toFixed(2)}`,
                  }))}
                  value={materialId}
                  onChange={setMaterialId}
                />
              </Field>

              <Field label="Kaplama" hint="× multiplier">
                <PlainSelect
                  options={ETIKET_COATINGS.map((c) => ({
                    id: c.id,
                    name: c.name,
                    desc: c.desc,
                    label: `×${c.multiplier.toFixed(2)}`,
                  }))}
                  value={coatingId}
                  onChange={setCoatingId}
                />
              </Field>

              <Field label="Özelleştirme" hint="% multiplier (Sefa kuralı)">
                <PlainSelect
                  options={ETIKET_CUSTOMIZATIONS.map((c) => ({
                    id: c.id,
                    name: c.name,
                    desc: c.desc,
                    label: `×${c.multiplier.toFixed(2)}`,
                  }))}
                  value={customizationId}
                  onChange={setCustomizationId}
                />
              </Field>
            </Card>

            {mode === "fason" && (
              <Card padding="p-5">
                <SectionTitle accent="mercan">① Üretim · Fason</SectionTitle>
                <Field label="Fason Birim Maliyet" hint="m² başına (ana)">
                  <NumInput
                    value={fasonRate}
                    onChange={setFasonRate}
                    suffix="₺ / m²"
                    step={5}
                  />
                </Field>
                {result.ok && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-pim-mercan-tint/40 text-[12px] tabular-nums">
                    Efektif rate: <strong>{result.effectiveRate.toFixed(2)} ₺/m²</strong>
                    {" "}· (×{result.multipliers.material.toFixed(2)} mat × {result.multipliers.coating.toFixed(2)} kap × {result.multipliers.customization.toFixed(2)} öz)
                  </div>
                )}
              </Card>
            )}

            {mode === "uretim" && (
              <Card padding="p-5">
                <SectionTitle accent="mercan">
                  ① Üretim · Kendi Makina
                </SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kağıt / Folio">
                    <NumInput value={paper} onChange={setPaper} suffix="₺/m²" />
                  </Field>
                  <Field label="Mürekkep">
                    <NumInput value={ink} onChange={setInk} suffix="₺/m²" />
                  </Field>
                  <Field label="Kaplama">
                    <NumInput value={coating} onChange={setCoating} suffix="₺/m²" />
                  </Field>
                  <Field label="İşçilik">
                    <NumInput value={labor} onChange={setLabor} suffix="₺/m²" />
                  </Field>
                  <Field label="Genel Gider">
                    <NumInput value={overhead} onChange={setOverhead} suffix="₺/m²" />
                  </Field>
                  <Field label="Amortisman">
                    <NumInput value={depreciation} onChange={setDepreciation} suffix="₺/m²" />
                  </Field>
                </div>
              </Card>
            )}

            <Card padding="p-5">
              <SectionTitle accent="turuncu">② Operasyon</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hazırlık" hint="tek seferlik">
                  <NumInput value={setup} onChange={setSetup} suffix="₺" step={10} />
                </Field>
                <Field label="Paketleme" hint="rulo başına">
                  <NumInput value={packaging} onChange={setPackaging} suffix="₺/rulo" step={5} />
                </Field>
                <Field label="Kargo" hint="yurtiçi">
                  <NumInput value={cargo} onChange={setCargo} suffix="₺" step={10} />
                </Field>
                <Field label="İşlem Ücreti" hint="ödeme komisyonu">
                  <NumInput value={feePct} onChange={setFeePct} suffix="%" step={0.5} />
                </Field>
              </div>
            </Card>

            <Card padding="p-5">
              <SectionTitle accent="yesil">③ Kar & Vergi</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kar Marjı (markup)">
                  <NumInput value={marginPct} onChange={setMarginPct} suffix="%" step={5} />
                </Field>
                <Field label="KDV">
                  <NumInput value={vatPct} onChange={setVatPct} suffix="%" step={1} />
                </Field>
                <Field label="Min Markup Floor" hint="zarar koruma">
                  <NumInput
                    value={minMarkupFraction * 100}
                    onChange={(v) => setMinMarkupFraction(v / 100)}
                    suffix="%"
                    step={5}
                  />
                </Field>
              </div>
            </Card>
          </div>

          {/* RIGHT — Output */}
          <div className="space-y-4">
            {result.ok ? (
              <>
                {/* Price hero */}
                <Card
                  padding="p-7"
                  className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white relative overflow-hidden"
                >
                  <div
                    aria-hidden
                    className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full bg-pim-mercan/20 blur-2xl"
                  />
                  <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
                        Müşteri Satış Fiyatı (KDV Dahil)
                      </div>
                      <div className="text-[44px] md:text-[52px] font-bold leading-none tracking-tight tabular-nums">
                        {fmt(Math.round(result.cost.total))}{" "}
                        <span className="text-pim-mercan text-[36px] font-semibold">
                          ₺
                        </span>
                      </div>
                      <div className="mt-2 text-[13px] text-white/70">
                        {qty.toLocaleString("tr-TR")} adet · {result.geometry.rollsNeeded} rulo · {result.geometry.totalM2.toFixed(3)} m²
                      </div>
                    </div>
                    <div className="md:text-right">
                      <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
                        Birim Fiyat / KDV Dahil
                      </div>
                      <div className="text-[28px] md:text-[32px] font-semibold tracking-tight tabular-nums">
                        <span className="text-pim-mercan text-[22px] mr-1">₺</span>
                        {fmt(result.cost.unitPrice, 2)}
                      </div>
                      <div className="mt-2 text-[13px] text-white/70 md:text-right">
                        / adet · Tier {tier.qty.toLocaleString("tr-TR")} ({tier.label})
                      </div>
                    </div>
                  </div>

                  {/* VAT line */}
                  <div className="relative mt-6 pt-5 border-t border-white/15 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <VatCell label="Maliyet" value={`${fmt(result.cost.baseCost)} ₺`} />
                    <VatCell
                      label="Net Kar (Sefa)"
                      value={`${fmt(result.cost.actualProfit)} ₺`}
                      subtitle={`%${result.cost.actualMarkupPct.toFixed(0)} markup`}
                      warning={!!result.cost.marginWarning}
                    />
                    <VatCell label="PSP Komisyon" value={`${fmt(result.cost.processingFee)} ₺`} />
                    <VatCell label="KDV" value={`${fmt(result.cost.vatAmount)} ₺`} />
                  </div>

                  {result.cost.marginWarning && (
                    <div className="relative mt-4 px-3 py-2.5 rounded-lg bg-kirmizi/15 ring-2 ring-kirmizi/50 text-[12.5px]">
                      <div className="font-bold text-kirmizi mb-1">
                        ⚠️ DÜŞÜK MARJ UYARISI
                      </div>
                      <div className="text-white/90 tabular-nums">
                        Intended <strong>%{result.cost.marginWarning.intendedMarkupPct}</strong> →
                        actual <strong className="text-kirmizi">%{result.cost.marginWarning.actualMarkupPct.toFixed(0)}</strong>
                        {" "}(<strong>%{result.cost.marginWarning.erosionPct.toFixed(0)} erosion</strong>)
                      </div>
                    </div>
                  )}
                </Card>

                <EtiketLivePricebookPanel
                  fasonPartnerCost={fasonPartnerCost}
                  livePricebookQuote={livePricebookQuote}
                  liveShadow={liveShadow}
                  totalM2={result.geometry.totalM2}
                  loaded={livePricingLoaded}
                />

                {/* Rulo Plan Card (SVG) — sticker'daki RollPlanSvg adapter ile */}
                <Card padding="p-0" className="overflow-hidden">
                  <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="inline-block text-[10px] tracking-[0.18em] uppercase text-pim-mercan font-bold mb-1">
                        üretim katmanı
                      </span>
                      <h3 className="text-[18px] font-semibold tracking-tight">
                        Rulo Üretim Planı
                      </h3>
                      <p className="text-[12px] text-gri-700 mt-0.5">
                        Dinamik en (250-600mm) · 40mm kesim markası · 50mm başlangıç · etiket gap {result.geometry.gap}mm
                      </p>
                    </div>
                    <div className="flex gap-5 shrink-0">
                      <div className="text-right">
                        <div className="text-[9px] tracking-[0.12em] uppercase text-gri-700 font-bold mb-1">
                          Rulo
                        </div>
                        <div className="text-[20px] font-bold tracking-tight tabular-nums">
                          {result.geometry.rollsNeeded}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] tracking-[0.12em] uppercase text-gri-700 font-bold mb-1">
                          Etiket/Rulo
                        </div>
                        <div className="text-[20px] font-bold tracking-tight tabular-nums">
                          {result.geometry.etiketsOnLastRoll}/{result.geometry.perRoll}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] tracking-[0.12em] uppercase text-gri-700 font-bold mb-1">
                          Verimlilik
                        </div>
                        <div className="text-[20px] font-bold tracking-tight tabular-nums">
                          %{(
                            (result.geometry.qty /
                              (result.geometry.rollsNeeded * result.geometry.perRoll)) *
                            100
                          ).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gri-50 p-6 flex justify-center min-h-[200px]">
                    <RollPlanSvg geometry={adaptEtiketToGeometryResult(result.geometry)} />
                  </div>
                  <div className="px-5 py-3 text-[11px] text-gri-500 bg-gri-50 border-t border-dashed border-gri-200 flex flex-wrap justify-between gap-2 tabular-nums">
                    <span>
                      ⚙ {result.geometry.rollsNeeded === 1 ? "Tek rulo" : `${result.geometry.rollsNeeded} rulo`}
                      {" · "}
                      son: {result.geometry.etiketsOnLastRoll}/{result.geometry.perRoll}
                      {" · "}
                      {result.geometry.totalM2.toFixed(3)} m²
                      {" · "}
                      {result.geometry.rollW}mm en
                      {result.geometry.rollW < 600 && (
                        <span className="text-yesil ml-1">
                          ({600 - result.geometry.rollW}mm tasarruf)
                        </span>
                      )}
                    </span>
                    <span>
                      {result.geometry.cols}×{result.geometry.rowsPerRoll} grid · etiket {result.geometry.width}×{result.geometry.height}mm
                    </span>
                  </div>
                </Card>

                {/* Stats */}
                <Card padding="p-5">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-gri-700 font-bold mb-3 flex items-center justify-between">
                    <span>Üretim Özeti — Rulo</span>
                    <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-krem text-lacivert font-semibold">
                      die-cut rulo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCell label="Etiket/Rulo" value={result.geometry.perRoll.toString()} />
                    <StatCell label="Toplam Rulo" value={result.geometry.rollsNeeded.toString()} />
                    <StatCell
                      label="Harcanan Alan"
                      value={result.geometry.totalM2.toFixed(3)}
                      unit="m²"
                      accent
                    />
                    <StatCell
                      label="Fire"
                      value={`%${result.geometry.wastePct.toFixed(1)}`}
                    />
                  </div>

                  {/* Mini bar */}
                  <div className="mt-3" title="Rulo doluluk dağılımı">
                    <RollMiniBar geometry={adaptEtiketToGeometryResult(result.geometry)} />
                  </div>

                  <div className="mt-3 text-[11px] text-gri-500 tabular-nums">
                    Rulo eni: {result.geometry.rollW} mm · Grid {result.geometry.cols} kolon ×{" "}
                    {result.geometry.rowsPerRoll} satır/rulo · gap {result.geometry.gap}mm
                    {" · son rulo: "}
                    {result.geometry.etiketsOnLastRoll}/{result.geometry.perRoll}
                  </div>
                </Card>

                {/* Cost breakdown */}
                <Card padding="p-0">
                  <div className="px-5 py-4 border-b border-gri-200 bg-gri-50">
                    <h3 className="text-[15px] font-semibold">Maliyet Detayı</h3>
                  </div>
                  <div className="px-5 divide-y divide-gri-100">
                    {result.cost.productionItems.map((item, i) => (
                      <BreakdownRow key={`prod-${i}`} item={item} />
                    ))}
                    <BreakdownRow
                      item={{
                        name: "Üretim Ara Toplam",
                        formula: "①",
                        amount: result.cost.productionCost,
                      }}
                      subtotal
                    />
                    {result.cost.operationItems.map((item, i) => (
                      <BreakdownRow key={`op-${i}`} item={item} />
                    ))}
                    <BreakdownRow
                      item={{
                        name: "Operasyon Ara Toplam",
                        formula: "②",
                        amount: result.cost.operationCost,
                      }}
                      subtotal
                    />
                    <BreakdownRow
                      item={{
                        name: "Toplam Maliyet",
                        formula: "① + ②",
                        amount: result.cost.baseCost,
                      }}
                      highlight
                    />
                    <BreakdownRow
                      item={{
                        name: "Kar Marjı (intended)",
                        formula: "baseCost × marj%",
                        amount: result.cost.intendedProfit,
                      }}
                    />
                    <BreakdownRow
                      item={{
                        name: "PSP Komisyonu (gross-up)",
                        formula: "ödeme komisyonu",
                        amount: result.cost.processingFee,
                      }}
                    />
                    {Math.abs(result.cost.tierMultiplier - 1) > 0.001 && (
                      <BreakdownRow
                        item={{
                          name: result.cost.tierMultiplier > 1 ? "Tier Zam" : "Tier İndirim",
                          formula: `× ${result.cost.tierMultiplier.toFixed(2)}`,
                          amount: result.cost.tierAdjustment,
                        }}
                        negative={result.cost.tierAdjustment < 0}
                      />
                    )}
                    <BreakdownRow
                      item={{
                        name: "KDV",
                        formula: `subtotal × kdv%`,
                        amount: result.cost.vatAmount,
                      }}
                    />
                    <BreakdownRow
                      item={{
                        name: "Müşteri Satış Fiyatı",
                        formula: "KDV dahil",
                        amount: result.cost.total,
                      }}
                      total
                    />
                  </div>
                </Card>
              </>
            ) : (
              <Card padding="p-8" className="text-center">
                <Icon.Info size={32} className="mx-auto text-gri-500 mb-2" />
                <p className="text-base text-gri-700">{result.reason}</p>
              </Card>
            )}
          </div>
        </div>

        {/* Sepet panel — full width */}
        <div className="mt-6">
          <CartPanel onGeneratePDF={handleCartPDF} />
        </div>
      </div>

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
    </div>
  );
}

// ============================================================
// Subcomponents (sticker page'tan kopya, lokal scope)
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
  accent: "mercan" | "turuncu" | "yesil" | "lacivert";
}) {
  const dot = {
    mercan: "bg-pim-mercan",
    turuncu: "bg-turuncu",
    yesil: "bg-yesil",
    lacivert: "bg-lacivert",
  }[accent];
  return (
    <div className="flex items-center gap-2 mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-gri-700">
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dot)} />
      <span>{children}</span>
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

function SegmentToggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string; sub?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 bg-gri-50 ring-1 ring-gri-200 rounded-xl">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={cn(
              "py-2.5 rounded-lg text-[13px] font-semibold transition-colors text-center",
              selected
                ? "bg-lacivert text-white shadow-1"
                : "text-gri-700 hover:bg-white"
            )}
          >
            <div>{opt.label}</div>
            {opt.sub && (
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.04em] mt-0.5",
                  selected ? "text-white/70" : "text-gri-500"
                )}
              >
                {opt.sub}
              </div>
            )}
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
      {ETIKET_TIERS.map((tier) => {
        const selected = value === tier.qty;
        const isRef = tier.multiplier === 1;
        const isInd = tier.multiplier < 1;
        const isZam = tier.multiplier > 1;
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
            <div className="text-[16px] font-bold tracking-tight tabular-nums">
              {tier.qty >= 1000 ? `${tier.qty / 1000}K` : tier.qty}
            </div>
            <div
              className={cn(
                "text-[10px] font-bold tabular-nums mt-0.5",
                selected
                  ? "text-white/85"
                  : isZam
                    ? "text-pim-mercan"
                    : isInd
                      ? "text-yesil"
                      : "text-gri-500"
              )}
            >
              {isRef ? "referans" : tier.label.replace("zam", "").replace("indirim", "").trim()}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface SwatchOption {
  id: string;
  name: string;
  desc: string;
  swatch: string;
  label: string;
}

function SwatchSelect({
  options,
  value,
  onChange,
}: {
  options: SwatchOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={cn(
              "p-2.5 rounded-lg ring-[1.5px] text-left transition-all flex gap-2.5 items-center",
              selected
                ? "ring-lacivert bg-lacivert text-white"
                : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
            )}
          >
            <div
              className="w-9 h-9 rounded-lg shrink-0 ring-1 ring-black/[0.08]"
              style={{ background: opt.swatch }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[12.5px]">{opt.name}</div>
              <div
                className={cn(
                  "text-[10px] tabular-nums",
                  selected ? "text-white/70" : "text-gri-500"
                )}
              >
                {opt.label}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface PlainOption {
  id: string;
  name: string;
  desc: string;
  label: string;
}

function PlainSelect({
  options,
  value,
  onChange,
}: {
  options: PlainOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={cn(
              "p-2.5 rounded-lg ring-[1.5px] text-left transition-all",
              selected
                ? "ring-lacivert bg-lacivert text-white"
                : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
            )}
          >
            <div className="font-semibold text-[12.5px]">{opt.name}</div>
            <div
              className={cn(
                "text-[10px] tabular-nums",
                selected ? "text-white/70" : "text-gri-500"
              )}
            >
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
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

function StatCell({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-lg p-3", accent ? "bg-pim-mercan-tint/60" : "bg-gri-50")}>
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.08em] font-bold mb-1",
          accent ? "text-pim-mercan-koyu" : "text-gri-700"
        )}
      >
        {label}
      </div>
      <div className="text-[20px] font-bold tracking-tight tabular-nums">
        {value}
        {unit && <span className="text-[12px] text-gri-500 ml-1 font-medium">{unit}</span>}
      </div>
    </div>
  );
}

function EtiketLivePricebookPanel({
  fasonPartnerCost,
  livePricebookQuote,
  liveShadow,
  totalM2,
  loaded,
}: {
  fasonPartnerCost: number | null;
  livePricebookQuote: ReturnType<typeof quoteRuloFromPricebook> | null;
  liveShadow: ReturnType<typeof comparePricebookVsLegacyArea> | null;
  totalM2: number;
  loaded: boolean;
}) {
  return (
    <Card padding="p-5" className="ring-1 ring-pim-mercan/30 bg-pim-mercan/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-lacivert">
          Site Fiyatı (Price Book — Live)
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gri-500">
          {loaded ? "DB live_config + pricebook" : "yükleniyor…"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg bg-white ring-1 ring-gri-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gri-500 font-semibold mb-1">
            Fason Partner Maliyeti
          </div>
          {fasonPartnerCost !== null ? (
            <>
              <div className="text-[24px] font-bold tabular-nums text-lacivert">
                {fmt(Math.round(fasonPartnerCost))}{" "}
                <span className="text-[16px] text-gri-500">₺</span>
              </div>
              <div className="text-[12px] text-gri-600 mt-1">
                {totalM2.toFixed(3)} m² × fason rate (KDV hariç tahmin)
              </div>
            </>
          ) : (
            <div className="text-[13px] text-gri-600">
              Üretim modu — fason satırı yok
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white ring-1 ring-gri-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gri-500 font-semibold mb-1">
            Müşteri Fiyatı (price book)
          </div>
          {livePricebookQuote?.ok ? (
            <>
              <div className="text-[24px] font-bold tabular-nums text-lacivert">
                {fmt(Math.round(livePricebookQuote.total))}{" "}
                <span className="text-[16px] text-gri-500">₺</span>
              </div>
              <div className="text-[12px] text-gri-600 mt-1">
                Partner: {livePricebookQuote.partner_unit_per_label.toFixed(4)} ₺/adet
                · birim {fmt(livePricebookQuote.unitPrice, 2)} ₺
              </div>
            </>
          ) : (
            <div className="text-[13px] text-gri-600">
              {livePricebookQuote && !livePricebookQuote.ok
                ? `${livePricebookQuote.reason}${livePricebookQuote.hint ? `: ${livePricebookQuote.hint}` : ""}`
                : "Hesaplanamadı"}
            </div>
          )}
        </div>
      </div>

      {liveShadow?.ok &&
        liveShadow.delta_total !== null &&
        liveShadow.delta_pct !== null && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-[12px] font-semibold tabular-nums",
              Math.abs(liveShadow.delta_pct) > 15
                ? "bg-kirmizi/10 text-kirmizi ring-1 ring-kirmizi/20"
                : "bg-yesil/10 text-yesil-koyu ring-1 ring-yesil/20"
            )}
          >
            Shadow: legacy m²{" "}
            {liveShadow.legacy_total !== null
              ? `${Math.round(liveShadow.legacy_total).toLocaleString("tr-TR")} ₺`
              : "—"}{" "}
            vs price book{" "}
            {liveShadow.pricebook_total !== null
              ? `${Math.round(liveShadow.pricebook_total).toLocaleString("tr-TR")} ₺`
              : "—"}{" "}
            → fark {liveShadow.delta_total >= 0 ? "+" : ""}
            {Math.round(liveShadow.delta_total).toLocaleString("tr-TR")} ₺ (
            {liveShadow.delta_pct >= 0 ? "+" : ""}
            {liveShadow.delta_pct.toFixed(1)}%)
          </div>
        )}
    </Card>
  );
}

function BreakdownRow({
  item,
  subtotal,
  highlight,
  total,
  negative,
}: {
  item: { name: string; formula: string; amount: number };
  subtotal?: boolean;
  highlight?: boolean;
  total?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "py-3 grid grid-cols-[1fr_auto_auto] items-center gap-3",
        subtotal && "bg-gri-50/50",
        highlight && "bg-lacivert/5",
        total && "bg-pim-mercan-tint/50"
      )}
    >
      <div>
        <div
          className={cn(
            "text-[13px]",
            (highlight || total) && "font-semibold",
            subtotal && "font-medium"
          )}
        >
          {item.name}
        </div>
        <div className="text-[10px] text-gri-500 tabular-nums mt-0.5">
          {item.formula}
        </div>
      </div>
      <div />
      <div
        className={cn(
          "text-right tabular-nums font-semibold text-[13px]",
          negative && "text-yesil",
          total && "text-pim-mercan-koyu text-[16px] font-bold"
        )}
      >
        {negative ? "−" : ""}
        {fmt(Math.abs(item.amount))} ₺
      </div>
    </div>
  );
}
