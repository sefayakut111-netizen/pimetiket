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
 *   ✓ Mode toggle (fason/üretim)
 *   ✓ Cut type (tabaka/diecut)
 *   ✓ Boyut input (W × H)
 *   ✓ Tier butonları (25/50/100/250/500/1000)
 *   ✓ Üretim parametre input'ları (fason rate / 6 üretim kalemi)
 *   ✓ Site fiyatı (live config, alış/satış çift fiyat)
 *   ✓ Fason/üretim simülasyonu (operatör referans)
 *   ✓ Anlık fiyat (büyük), birim fiyat
 *   ✓ Stat kartları (tabaka, m², rulo, fire)
 *   ✓ Maliyet detayı breakdown
 *   ✓ Tolerans bandı (overrun bilgisi)
 *   ✓ Reset + varsayılana dön
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

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  STICKER_TIERS,
  type StickerTier,
  type CutType,
  type ProductionMode,
  quoteSticker,
  findTier,
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
import { addToCart, type CartItem } from "@/lib/pricing-cart";
import { CartPanel } from "@/components/admin/pricing/CartPanel";
import {
  reconstructGeometryFromCart,
  reconstructCostFromCart,
} from "@/lib/cart-pdf-helpers";
import { StatsModal } from "@/components/admin/pricing/StatsModal";
import { recordStat } from "@/lib/pricing-stats";
import { calculatePrice } from "@/lib/pricing-calc";
import { livePriceToCostResult } from "@/lib/pricing-live-snapshot";
import {
  resolveM2Cost,
  resolveM2Sell,
} from "@/lib/pricing-dual-price";
import {
  FALLBACK_STICKER_CONFIG,
  type ProfileConfig,
} from "@/lib/pricing-config-types";

// ============================================================
// Defaults — v0.4: overhead 45 (SaaS recovery), customerType
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

  // State
  const [mode, setMode] = useState<ProductionMode>(DEFAULTS.mode);
  const [cut, setCut] = useState<CutType>(DEFAULTS.cut);
  const [width, setWidth] = useState<number>(DEFAULTS.width);
  const [height, setHeight] = useState<number>(DEFAULTS.height);
  const [qty, setQty] = useState<number>(DEFAULTS.qty);

  // Fason
  const [fasonRate, setFasonRate] = useState<number>(DEFAULTS.fasonRate);

  // Üretim
  const [paper, setPaper] = useState<number>(DEFAULTS.paper);
  const [ink, setInk] = useState<number>(DEFAULTS.ink);
  const [coating, setCoating] = useState<number>(DEFAULTS.coating);
  const [labor, setLabor] = useState<number>(DEFAULTS.labor);
  const [overhead, setOverhead] = useState<number>(DEFAULTS.overhead);
  const [depreciation, setDepreciation] = useState<number>(DEFAULTS.depreciation);

  // Site fiyat önizleme (live config malzeme/finiş)
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
        /* fallback config kalır */
      } finally {
        if (!cancelled) setLiveConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveConfig]);

  // Hesap — geometri + fason simülasyonu (site fiyatından bağımsız)
  const result = quoteSticker({
    width,
    height,
    cut,
    qty,
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
    operation: { setup: 0, packaging: 0, cargo: 0, feePct: 0 },
    margin: { marginPct: 0, vatPct: 0, minMarkupFraction: 0 },
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
  const siteVatPct = liveStickerConfig.vat.pct;

  const fasonPartnerCost =
    result.ok && mode === "fason"
      ? result.geometry.totalM2 * fasonRate
      : null;

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

  function handleAddToCart() {
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
    const r = addToCart({
      product: "sticker",
      width,
      height,
      requestedQty: qty,
      producedQty: result.geometry.fit.producedQty,
      preGroupSubtotal: siteCost.subtotal,
      vatPct: siteVatPct,
      tierMultiplier: siteCost.tierMultiplier,
      preGroupTotal: siteCost.total,
      mode,
      cut,
      layoutMode: result.geometry.fit.mode,
      rollsNeeded: result.geometry.roll.rollsNeeded,
      totalM2: result.geometry.totalM2,
      baseCost: siteCost.baseCost,
      intendedProfit: siteCost.intendedProfit,
      actualProfit: siteCost.actualProfit,
      vatAmount: siteCost.vatAmount,
      total: siteCost.total,
      unitPrice: siteCost.unitPrice,
    });
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    toast.success(`${r.item.name} sepete eklendi`);
  }

  function handleCartPDF(items: CartItem[]) {
    // Her item için ayrı PDF üret (toplu olarak — her biri kendi lot'uyla)
    items.forEach((item, idx) => {
      // Item product'a göre lot prefix
      const lot = nextLot(item.product === "sticker" ? "A" : "B");
      // Synthetic geometry+cost reconstruction
      // Bu birleşik PDF değil — her item ayrı PDF iner
      // İleride combined PDF için ayrı helper yazılabilir
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
      }, idx * 200); // çoklu indirme browser handle etsin
    });
    setNextLotPreview(peekNextLot("A"));
    toast.success(`${items.length} adet PDF iş emri üretiliyor`);
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
    setFasonRate(DEFAULTS.fasonRate);
    setPaper(DEFAULTS.paper);
    setInk(DEFAULTS.ink);
    setCoating(DEFAULTS.coating);
    setLabor(DEFAULTS.labor);
    setOverhead(DEFAULTS.overhead);
    setDepreciation(DEFAULTS.depreciation);
    setPreviewMaterialId(DEFAULT_PREVIEW_MATERIAL);
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
              🏷 Sticker Fiyat Hesapla
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
              📊 İstatistik
            </Button>
            <Button variant="ghost" size="sm" onClick={copyJSON}>
              <Icon.Sparkle size={14} /> JSON kopyala
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Sıfırla
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddToCart}
              disabled={!result.ok || !liveSitePrice?.ok}
            >
              🛒 Sepete Ekle
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={!result.ok || !liveSitePrice?.ok}
            >
              📄 İş Emri PDF
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
          {/* LEFT — Input */}
          <div className="space-y-4">
            {/* Mode + Cut */}
            <Card padding="p-5">
              <h2 className="text-[15px] font-semibold mb-4">Sipariş</h2>

              {/* Mode toggle */}
              <Field label="Üretim Modu" hint="tedarik senaryosu">
                <SegmentToggle
                  options={[
                    { value: "fason", label: "Fason", sub: "Dış Tedarik" },
                    {
                      value: "uretim",
                      label: "Üretim",
                      sub: "Kendi Makina",
                    },
                  ]}
                  value={mode}
                  onChange={(v) => setMode(v as ProductionMode)}
                />
              </Field>

              {/* Cut type */}
              <Field label="Kesim Tipi" hint="fire & dizgi farkı">
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

              {/* Dimensions */}
              <Field label="Sticker Boyutu" hint="milimetre">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <NumInput
                    value={width}
                    onChange={setWidth}
                    suffix="mm · GEN."
                    min={5}
                    max={400}
                  />
                  <span className="text-gri-500 font-medium">×</span>
                  <NumInput
                    value={height}
                    onChange={setHeight}
                    suffix="mm · YÜK."
                    min={5}
                    max={650}
                  />
                </div>
              </Field>

              {/* Tier buttons */}
              <Field label="Adet Kademesi" hint="tasarım başına">
                <TierGrid value={qty} onChange={setQty} />
              </Field>
            </Card>

            {/* Üretim — Fason */}
            {mode === "fason" && (
              <Card padding="p-5">
                <SectionTitle accent="mercan">① Üretim · Fason</SectionTitle>
                <Field label="Fason Birim Maliyet" hint="m² başına">
                  <NumInput
                    value={fasonRate}
                    onChange={setFasonRate}
                    suffix="₺ / m²"
                    step={5}
                  />
                </Field>
              </Card>
            )}

            {/* Üretim — Kendi Makina */}
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
                    <NumInput
                      value={coating}
                      onChange={setCoating}
                      suffix="₺/m²"
                    />
                  </Field>
                  <Field label="İşçilik">
                    <NumInput value={labor} onChange={setLabor} suffix="₺/m²" />
                  </Field>
                  <Field label="Genel Gider">
                    <NumInput
                      value={overhead}
                      onChange={setOverhead}
                      suffix="₺/m²"
                    />
                  </Field>
                  <Field label="Amortisman">
                    <NumInput
                      value={depreciation}
                      onChange={setDepreciation}
                      suffix="₺/m²"
                    />
                  </Field>
                </div>
              </Card>
            )}

            {/* Site fiyatı — live config */}
            <Card padding="p-5">
              <SectionTitle accent="turuncu">② Site Fiyatı (Live Config)</SectionTitle>
              <p className="text-[12px] text-gri-600 mb-4">
                Operasyon, komisyon ve KDV live config&apos;ten gelir — Fiyatlar
                sekmesinden düzenlenir.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4 text-[13px] tabular-nums">
                <div className="rounded-lg bg-gri-50 px-3 py-2 ring-1 ring-gri-200">
                  <div className="text-[10px] uppercase text-gri-500 font-semibold">
                    Setup
                  </div>
                  {fmt(liveStickerConfig.operation.setup)} ₺
                </div>
                <div className="rounded-lg bg-gri-50 px-3 py-2 ring-1 ring-gri-200">
                  <div className="text-[10px] uppercase text-gri-500 font-semibold">
                    Paketleme/adet
                  </div>
                  {liveStickerConfig.operation.packaging_per_unit.toFixed(3)} ₺
                </div>
                <div className="rounded-lg bg-gri-50 px-3 py-2 ring-1 ring-gri-200">
                  <div className="text-[10px] uppercase text-gri-500 font-semibold">
                    Komisyon
                  </div>
                  {liveStickerConfig.operation.fee_pct}%
                </div>
                <div className="rounded-lg bg-gri-50 px-3 py-2 ring-1 ring-gri-200">
                  <div className="text-[10px] uppercase text-gri-500 font-semibold">
                    KDV
                  </div>
                  {liveStickerConfig.vat.pct}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Malzeme" hint="site fiyat önizleme">
                  <select
                    value={previewMaterialId}
                    onChange={(e) => setPreviewMaterialId(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[14px] font-medium focus:outline-none focus:ring-pim-mercan focus:bg-white"
                  >
                    {liveStickerConfig.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Finiş" hint="site fiyat önizleme">
                  <select
                    value={previewFinishId}
                    onChange={(e) => setPreviewFinishId(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[14px] font-medium focus:outline-none focus:ring-pim-mercan focus:bg-white"
                  >
                    {(liveStickerConfig.options.finish?.items ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Müşteri Tipi" hint="bilgi (Block C entegrasyon)">
                  <select
                    value={customerType}
                    onChange={(e) =>
                      setCustomerType(e.target.value as CustomerType)
                    }
                    className="w-full h-11 px-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[14px] font-medium focus:outline-none focus:ring-pim-mercan focus:bg-white"
                  >
                    <option value="standart">Standart</option>
                    <option value="duzenli">Düzenli</option>
                    <option value="sadik">Sadık</option>
                    <option value="sozlesmeli">Sözleşmeli</option>
                  </select>
                </Field>
              </div>
            </Card>
          </div>

          {/* RIGHT — Output */}
          <div className="space-y-4">
            {/* Price hero */}
            <PriceHero
              result={result}
              qty={qty}
              tier={displayTier}
              liveSitePrice={liveSitePrice}
            />

            {result.ok && (
              <LivePricingPanel
                fasonPartnerCost={fasonPartnerCost}
                liveSitePrice={liveSitePrice}
                totalM2={result.geometry.totalM2}
                liveConfigLoaded={liveConfigLoaded}
              />
            )}

            {result.ok ? (
              <>
                {/* Rulo plan SVG (full width) */}
                <RollPlanCard result={result} />

                {/* Tabaka detay + Üretim özeti (2-col) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SheetPreviewCard result={result} />
                  <UretimOzetiCard result={result} />
                </div>

                {/* Cost breakdown */}
                <CostBreakdown result={result} liveSitePrice={liveSitePrice} />
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

        {/* Sepet panel — full width, 2-col grid'in dışında */}
        <div className="mt-6">
          <CartPanel onGeneratePDF={handleCartPDF} />
        </div>
      </div>

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
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

function LivePricingPanel({
  fasonPartnerCost,
  liveSitePrice,
  totalM2,
  liveConfigLoaded,
}: {
  fasonPartnerCost: number | null;
  liveSitePrice: ReturnType<typeof calculatePrice> | null;
  totalM2: number;
  liveConfigLoaded: boolean;
}) {
  const billableM2 =
    liveSitePrice?.ok && liveSitePrice.billable_m2
      ? liveSitePrice.billable_m2
      : totalM2;
  const m2Cost =
    liveSitePrice?.ok && liveSitePrice.material
      ? resolveM2Cost(liveSitePrice.material)
      : null;
  const m2Sell =
    liveSitePrice?.ok && liveSitePrice.material
      ? resolveM2Sell(liveSitePrice.material)
      : null;

  return (
    <Card padding="p-5" className="ring-1 ring-pim-mercan/30 bg-pim-mercan/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-lacivert">
          Site Fiyatı (Live Config)
        </h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gri-500">
          {liveConfigLoaded ? "DB live_config" : "yükleniyor…"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-white ring-1 ring-gri-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gri-500 font-semibold mb-1">
            Maliyet (Alış)
          </div>
          {liveSitePrice?.ok ? (
            <>
              <div className="text-[24px] font-bold tabular-nums text-lacivert">
                {fmt(Math.round(liveSitePrice.cost_total))}{" "}
                <span className="text-[16px] text-gri-500">₺</span>
              </div>
              <div className="text-[12px] text-gri-600 mt-1">
                {billableM2.toFixed(3)} m² × {fmt(m2Cost ?? 0, 2)} ₺/m² (m2_cost_try)
              </div>
              {fasonPartnerCost !== null && (
                <div className="text-[11px] text-gri-500 mt-2 tabular-nums">
                  Fason referans: {fmt(Math.round(fasonPartnerCost))} ₺ (simülasyon)
                </div>
              )}
            </>
          ) : (
            <div className="text-[13px] text-gri-600">
              {liveSitePrice && !liveSitePrice.ok
                ? liveSitePrice.reason
                : "Hesaplanamadı"}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white ring-1 ring-gri-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-gri-500 font-semibold mb-1">
            Müşteri Fiyatı (vinil + parlak)
          </div>
          {liveSitePrice?.ok ? (
            <>
              <div className="text-[24px] font-bold tabular-nums text-lacivert">
                {fmt(Math.round(liveSitePrice.final))}{" "}
                <span className="text-[16px] text-gri-500">₺</span>
              </div>
              <div className="text-[12px] text-gri-600 mt-1">
                {billableM2.toFixed(3)} m² × {fmt(m2Sell ?? 0, 2)} ₺/m² (m2_sell_try) · tier{" "}
                {liveSitePrice.tier.label}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-gri-600">
              {liveSitePrice && !liveSitePrice.ok
                ? liveSitePrice.reason
                : "Hesaplanamadı"}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PriceHero({
  result,
  qty,
  tier,
  liveSitePrice,
}: {
  result: ReturnType<typeof quoteSticker>;
  qty: number;
  tier: StickerTier | { qty: number; multiplier: number; label: string };
  liveSitePrice: ReturnType<typeof calculatePrice> | null;
}) {
  if (!result.ok) {
    return (
      <Card padding="p-7" className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
          Site Fiyatı (KDV Dahil)
        </div>
        <div className="text-[44px] font-bold leading-none tracking-tight">
          —
        </div>
        <div className="mt-2 text-[13px] text-white/70">
          {result.reason}
        </div>
      </Card>
    );
  }

  const { cost, geometry } = result;
  const useLive = liveSitePrice?.ok === true;
  const displayTotal = useLive ? liveSitePrice.final : cost.total;
  const displayUnit = useLive ? liveSitePrice.unit_price : cost.unitPrice;
  const heroTitle = useLive
    ? "Site Fiyatı (KDV Dahil)"
    : "Operatör Maliyet (KDV Dahil)";

  const breakdown = useLive
    ? {
        costBuy: liveSitePrice.cost_total,
        sell: liveSitePrice.with_margin,
        profit: liveSitePrice.with_margin - liveSitePrice.cost_total,
        fee: liveSitePrice.with_fee - liveSitePrice.with_margin,
        vat: liveSitePrice.final - liveSitePrice.with_fee,
      }
    : {
        costBuy: cost.baseCost,
        sell: cost.subtotal - cost.vatAmount,
        profit: 0,
        fee: cost.processingFee,
        vat: cost.vatAmount,
      };
  const profitPct =
    breakdown.costBuy > 0
      ? (breakdown.profit / breakdown.costBuy) * 100
      : 0;

  return (
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
            {heroTitle}
          </div>
          <div className="text-[44px] md:text-[52px] font-bold leading-none tracking-tight tabular-nums">
            {fmt(Math.round(displayTotal))}{" "}
            <span className="text-pim-mercan text-[36px] font-semibold">
              ₺
            </span>
          </div>
          <div className="mt-2 text-[13px] text-white/70">
            {qty.toLocaleString("tr-TR")} adet · {geometry.fit.sheetsNeeded} tabaka · {geometry.totalM2.toFixed(3)} m²
          </div>
        </div>
        <div className="md:text-right">
          <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
            Birim Fiyat / KDV Dahil
          </div>
          <div className="text-[28px] md:text-[32px] font-semibold tracking-tight tabular-nums">
            <span className="text-pim-mercan text-[22px] mr-1">₺</span>
            {fmt(displayUnit, 2)}
          </div>
          <div className="mt-2 text-[13px] text-white/70 md:text-right">
            / adet · Tier {tier.qty} ({tier.label})
          </div>
        </div>
      </div>

      <div className="relative mt-6 pt-5 border-t border-white/15 grid grid-cols-2 md:grid-cols-5 gap-4">
        <VatCell
          label="Maliyet (Alış)"
          value={`${fmt(Math.round(breakdown.costBuy))} ₺`}
        />
        <VatCell
          label="Satış Fiyatı"
          value={`${fmt(Math.round(breakdown.sell))} ₺`}
        />
        <VatCell
          label="Kâr"
          value={`${fmt(Math.round(breakdown.profit))} ₺`}
          subtitle={useLive ? `%${profitPct.toFixed(0)} kâr` : undefined}
        />
        <VatCell
          label="PSP Komisyon"
          value={`${fmt(Math.round(breakdown.fee))} ₺`}
        />
        <VatCell label="KDV" value={`${fmt(Math.round(breakdown.vat))} ₺`} />
      </div>

      {geometry.fit.producedQty > qty && (
        <div className="relative mt-3 px-3 py-2 rounded-lg bg-pim-mercan/10 ring-1 ring-pim-mercan/30 text-[12px] flex justify-between items-center">
          <span>
            📐 <strong className="text-pim-mercan">Üretim:</strong>{" "}
            <strong>{geometry.fit.producedQty}</strong> · {qty} faturalanır ·{" "}
            <strong className="text-yesil">
              +{geometry.fit.producedQty - qty} hediye
            </strong>
          </span>
          <span className="tabular-nums text-white/50">
            aşım %{(geometry.fit.overrun * 100).toFixed(1)}
          </span>
        </div>
      )}
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
            Dinamik en (250-600mm) · 40mm kesim markası · 50mm başlangıç
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
          ⚙ {roll.rollsNeeded === 1 ? "Tek rulo" : `${roll.rollsNeeded} rulo`} ·{" "}
          {roll.rollsNeeded === 1
            ? `${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} tabaka`
            : `son: ${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll}`}{" "}
          · {geometry.totalM2.toFixed(3)} m² · {roll.rollW}mm en
          {roll.rollW < 600 && (
            <span className="text-yesil ml-1">
              ({600 - roll.rollW}mm tasarruf)
            </span>
          )}
        </span>
        <span>
          {fit.cols}×{fit.rows} grid ·{" "}
          {fit.mode === "big" ? "40×65 büyük tabaka" : "23×31 küçük tabaka"}
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

function SheetPreviewCard({
  result,
}: {
  result: ReturnType<typeof quoteSticker>;
}) {
  if (!result.ok) return null;
  const { geometry } = result;
  const { fit } = geometry;

  return (
    <Card padding="p-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-gri-700 font-bold mb-3 flex items-center justify-between">
        <span>{fit.sheetW / 10}×{fit.sheetH / 10} cm Tabaka Görünümü</span>
        <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-krem text-lacivert font-semibold">
          {fit.perSheet} ad/tabaka
        </span>
      </div>
      <div className="bg-gri-50 ring-1 ring-dashed ring-gri-200 rounded-lg p-3 flex items-center justify-center overflow-hidden min-h-[200px]">
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

  return (
    <Card padding="p-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-gri-700 font-bold mb-3 flex items-center justify-between">
        <span>Üretim Özeti</span>
        <span
          className={cn(
            "text-[10px] tabular-nums px-2 py-0.5 rounded-full font-semibold",
            fit.mode === "big"
              ? "bg-pim-mercan text-white"
              : "bg-krem text-lacivert"
          )}
        >
          {fit.mode === "big" ? "büyük tabaka · die-cut" : "tabaka"}
        </span>
      </div>

      {/* 4 stat */}
      <div className="grid grid-cols-2 gap-3">
        <StatCell label="Adet/Tabaka" value={fit.perSheet.toString()} />
        <StatCell label="Toplam Tabaka" value={fit.sheetsNeeded.toString()} />
        <StatCell
          label="Harcanan Alan"
          value={geometry.totalM2.toFixed(3)}
          unit="m²"
          accent
        />
        <StatCell label="Toplam Rulo" value={roll.rollsNeeded.toString()} />
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
        <span className="text-gri-700 tabular-nums text-[11px]">
          {geometry.stickerArea.toFixed(3)} m² sticker / {geometry.totalM2.toFixed(3)} m² rulo
        </span>
      </div>

      {/* Layout details */}
      <div className="mt-3 text-[10.5px] text-gri-500 tabular-nums">
        Tabaka: {fit.sheetW}×{fit.sheetH}mm · Grid: {fit.cols}×{fit.rows} · Gap:{" "}
        {fit.gap}mm
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
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        accent ? "bg-pim-mercan-tint/60" : "bg-gri-50"
      )}
    >
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

function CostBreakdown({
  result,
  liveSitePrice,
}: {
  result: ReturnType<typeof quoteSticker>;
  liveSitePrice: ReturnType<typeof calculatePrice> | null;
}) {
  if (!result.ok) return null;
  const { cost } = result;
  const useLive = liveSitePrice?.ok === true;

  return (
    <Card padding="p-0">
      <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">Maliyet Detayı</h3>
        <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-white ring-1 ring-gri-200 font-semibold">
          {useLive ? "LIVE CONFIG" : "3 KATMAN"}
        </span>
      </div>
      <div className="px-5 divide-y divide-gri-100">
        {useLive ? (
          <>
            {cost.productionItems.map((item, i) => (
              <BreakdownRow key={`prod-${i}`} item={item} />
            ))}
            <BreakdownRow
              item={{
                name: "Fason Simülasyon (referans)",
                formula: "operatör üretim maliyeti",
                amount: cost.productionCost,
              }}
              highlight
            />
            <BreakdownRow
              item={{
                name: "Maliyet (Alış)",
                formula: "m2_cost_try × billable m²",
                amount: liveSitePrice.cost_total,
              }}
            />
            <BreakdownRow
              item={{
                name: "Satış Fiyatı",
                formula: "m2_sell_try × billable m²",
                amount: liveSitePrice.with_margin,
              }}
            />
            <BreakdownRow
              item={{
                name: "Kâr",
                formula: "satış − alış",
                amount: liveSitePrice.with_margin - liveSitePrice.cost_total,
              }}
            />
            <BreakdownRow
              item={{
                name: "İşlem Ücreti",
                formula: "PSP gross-up",
                amount: liveSitePrice.with_fee - liveSitePrice.with_margin,
              }}
            />
            <BreakdownRow
              item={{
                name: "KDV",
                formula: "site config",
                amount: liveSitePrice.final - liveSitePrice.with_fee,
              }}
            />
            <BreakdownRow
              item={{
                name: "Müşteri Satış Fiyatı",
                formula: "KDV dahil",
                amount: liveSitePrice.final,
              }}
              total
            />
          </>
        ) : (
          <>
            {cost.productionItems.map((item, i) => (
              <BreakdownRow key={`prod-${i}`} item={item} />
            ))}
            <BreakdownRow
              item={{
                name: "Üretim Ara Toplam",
                formula: "①",
                amount: cost.productionCost,
              }}
              subtotal
            />
            {cost.operationItems.map((item, i) => (
              <BreakdownRow key={`op-${i}`} item={item} />
            ))}
            {cost.operationCost > 0 && (
              <BreakdownRow
                item={{
                  name: "Operasyon Ara Toplam",
                  formula: "②",
                  amount: cost.operationCost,
                }}
                subtotal
              />
            )}
            <BreakdownRow
              item={{
                name: "Fason Simülasyon Maliyeti",
                formula: "üretim only",
                amount: cost.baseCost,
              }}
              highlight
            />
            <BreakdownRow
              item={{
                name: "İşlem Ücreti",
                formula: "ödeme komisyonu",
                amount: cost.processingFee,
              }}
            />
            {cost.tierAdjustment !== 0 && (
              <BreakdownRow
                item={{
                  name: cost.tierMultiplier > 1 ? "Tier Zam" : "Tier İndirim",
                  formula: `× ${cost.tierMultiplier.toFixed(2)}`,
                  amount: cost.tierAdjustment,
                }}
                negative={cost.tierAdjustment < 0}
              />
            )}
            <BreakdownRow
              item={{
                name: "Ara Toplam (KDV Hariç)",
                formula: "subtotal",
                amount: cost.subtotal,
              }}
              subtotal
            />
            <BreakdownRow
              item={{
                name: "KDV",
                formula: "subtotal × kdv%",
                amount: cost.vatAmount,
              }}
            />
            <BreakdownRow
              item={{
                name: "Operatör Toplam",
                formula: "KDV dahil",
                amount: cost.total,
              }}
              total
            />
          </>
        )}
      </div>
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
