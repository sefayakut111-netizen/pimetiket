/**
 * Pim Etiket — /admin/fiyat-hesapla
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
 *   ✓ Operasyon parametre input'ları
 *   ✓ Kar marjı + KDV
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

import { useState, useEffect } from "react";
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

// ============================================================
// Defaults — v0.4: overhead 15→45 (SaaS recovery), minMarkup, customerType
// ============================================================

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

export default function FiyatHesaplaPage() {
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

  // Operasyon
  const [setup, setSetup] = useState<number>(DEFAULTS.setup);
  const [packaging, setPackaging] = useState<number>(DEFAULTS.packaging);
  const [cargo, setCargo] = useState<number>(DEFAULTS.cargo);
  const [feePct, setFeePct] = useState<number>(DEFAULTS.feePct);

  // Kar + KDV
  const [marginPct, setMarginPct] = useState<number>(DEFAULTS.marginPct);
  const [vatPct, setVatPct] = useState<number>(DEFAULTS.vatPct);

  // v0.4: Min markup floor + customer type
  const [minMarkupFraction, setMinMarkupFraction] = useState<number>(
    DEFAULTS.minMarkupFraction
  );
  const [customerType, setCustomerType] = useState<CustomerType>(
    DEFAULTS.customerType
  );

  // Aktif profil ID
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>();

  // Lot rozeti — bir sonraki lot numarası
  const [nextLotPreview, setNextLotPreview] = useState<string>("A000001");
  const [statsOpen, setStatsOpen] = useState(false);
  useEffect(() => {
    setNextLotPreview(peekNextLot("A"));
  }, []);

  function handleGeneratePDF() {
    if (!result.ok) {
      toast.error("Önce geçerli bir hesaplama yap");
      return;
    }
    const lot = nextLot("A"); // atomic increment
    setNextLotPreview(peekNextLot("A")); // refresh badge

    generateWorkOrderPDF({
      lot,
      geometry: result.geometry,
      cost: result.cost,
      requestedQty: qty,
      cut,
      mode,
    });

    // İstatistik kaydı
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
      baseCost: result.cost.baseCost,
      intendedProfit: result.cost.intendedProfit,
      actualProfit: result.cost.actualProfit,
      vatAmount: result.cost.vatAmount,
      total: result.cost.total,
      unitPrice: result.cost.unitPrice,
      tierMultiplier: result.cost.tierMultiplier,
    });

    toast.success(`İş emri ${lot} üretildi (PDF indirildi)`);
  }

  function handleAddToCart() {
    if (!result.ok) {
      toast.error("Önce geçerli bir hesaplama yap");
      return;
    }
    const r = addToCart({
      product: "sticker",
      width,
      height,
      requestedQty: qty,
      producedQty: result.geometry.fit.producedQty,
      preGroupSubtotal: result.cost.subtotal,
      vatPct,
      tierMultiplier: result.cost.tierMultiplier,
      preGroupTotal: result.cost.total,
      mode,
      cut,
      layoutMode: result.geometry.fit.mode,
      rollsNeeded: result.geometry.roll.rollsNeeded,
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

  // Hesap
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
    operation: { setup, packaging, cargo, feePct },
    margin: { marginPct, vatPct, minMarkupFraction },
  });

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
    cargo,
    feePct,
    marginPct,
    vatPct,
    minMarkupFraction,
    customerType,
  };

  function loadProfile(p: PricingProfile) {
    const i = p.input;
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
    setCargo(i.cargo);
    setFeePct(i.feePct);
    setMarginPct(i.marginPct);
    setVatPct(i.vatPct);
    setMinMarkupFraction(i.minMarkupFraction);
    setCustomerType(i.customerType);
    setActiveProfileId(p.id);
    toast.success(`"${p.name}" profili yüklendi`);
  }

  const tier = findTier(qty);

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
    setSetup(DEFAULTS.setup);
    setPackaging(DEFAULTS.packaging);
    setCargo(DEFAULTS.cargo);
    setFeePct(DEFAULTS.feePct);
    setMarginPct(DEFAULTS.marginPct);
    setVatPct(DEFAULTS.vatPct);
    setMinMarkupFraction(DEFAULTS.minMarkupFraction);
    setCustomerType(DEFAULTS.customerType);
    setActiveProfileId(undefined);
    toast.success("Varsayılan değerlere dönüldü");
  }

  function copyJSON() {
    const payload = { input: currentInput, result };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast.success("JSON kopyalandı"))
      .catch(() => toast.error("Kopyalama başarısız"));
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-56px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
          <div>
            <Eyebrow>Operatör</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Fiyat Hesapla
            </h1>
            <p className="mt-2 text-base text-gri-700">
              Manuel hesap + parametre tuning. Pricing-engine v0.4.
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
                    suffix="TL / m²"
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
                    <NumInput value={paper} onChange={setPaper} suffix="TL/m²" />
                  </Field>
                  <Field label="Mürekkep">
                    <NumInput value={ink} onChange={setInk} suffix="TL/m²" />
                  </Field>
                  <Field label="Kaplama">
                    <NumInput
                      value={coating}
                      onChange={setCoating}
                      suffix="TL/m²"
                    />
                  </Field>
                  <Field label="İşçilik">
                    <NumInput value={labor} onChange={setLabor} suffix="TL/m²" />
                  </Field>
                  <Field label="Genel Gider">
                    <NumInput
                      value={overhead}
                      onChange={setOverhead}
                      suffix="TL/m²"
                    />
                  </Field>
                  <Field label="Amortisman">
                    <NumInput
                      value={depreciation}
                      onChange={setDepreciation}
                      suffix="TL/m²"
                    />
                  </Field>
                </div>
              </Card>
            )}

            {/* Operasyon */}
            <Card padding="p-5">
              <SectionTitle accent="turuncu">② Operasyon</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hazırlık" hint="tek seferlik">
                  <NumInput
                    value={setup}
                    onChange={setSetup}
                    suffix="TL"
                    step={10}
                  />
                </Field>
                <Field label="Paketleme" hint="zarf">
                  <NumInput
                    value={packaging}
                    onChange={setPackaging}
                    suffix="TL/zarf"
                    step={5}
                  />
                </Field>
                <Field label="Kargo" hint="yurtiçi">
                  <NumInput
                    value={cargo}
                    onChange={setCargo}
                    suffix="TL"
                    step={10}
                  />
                </Field>
                <Field label="İşlem Ücreti" hint="ödeme komisyonu">
                  <NumInput
                    value={feePct}
                    onChange={setFeePct}
                    suffix="%"
                    step={0.5}
                  />
                </Field>
              </div>
            </Card>

            {/* Kar + KDV */}
            <Card padding="p-5">
              <SectionTitle accent="yesil">③ Kar &amp; Vergi</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kar Marjı (markup)" hint="cost-plus">
                  <NumInput
                    value={marginPct}
                    onChange={setMarginPct}
                    suffix="%"
                    step={5}
                  />
                </Field>
                <Field label="KDV">
                  <NumInput
                    value={vatPct}
                    onChange={setVatPct}
                    suffix="%"
                    step={1}
                  />
                </Field>
                <Field label="Min Markup Floor" hint="zarar koruma">
                  <NumInput
                    value={minMarkupFraction * 100}
                    onChange={(v) => setMinMarkupFraction(v / 100)}
                    suffix="%"
                    step={5}
                  />
                </Field>
                <Field label="Müşteri Tipi" hint="bilgi (Block C entegrasyon)">
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as CustomerType)}
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
            <PriceHero result={result} qty={qty} tier={tier} />

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
                <CostBreakdown result={result} />
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
    </main>
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

function PriceHero({
  result,
  qty,
  tier,
}: {
  result: ReturnType<typeof quoteSticker>;
  qty: number;
  tier: StickerTier;
}) {
  if (!result.ok) {
    return (
      <Card padding="p-7" className="!bg-gradient-to-br !from-lacivert !to-lacivert-koyu !text-white">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-semibold">
          Müşteri Satış Fiyatı (KDV Dahil)
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
            Müşteri Satış Fiyatı (KDV Dahil)
          </div>
          <div className="text-[44px] md:text-[52px] font-bold leading-none tracking-tight tabular-nums">
            {fmt(Math.round(cost.total))}{" "}
            <span className="text-pim-mercan text-[36px] font-semibold">
              TL
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
            {fmt(cost.unitPrice, 2)}
          </div>
          <div className="mt-2 text-[13px] text-white/70 md:text-right">
            / adet · Tier {tier.qty} ({tier.label})
          </div>
        </div>
      </div>

      {/* VAT line — v0.4: actual profit eklendi */}
      <div className="relative mt-6 pt-5 border-t border-white/15 grid grid-cols-2 md:grid-cols-4 gap-4">
        <VatCell label="Maliyet" value={`${fmt(cost.baseCost)} TL`} />
        <VatCell
          label="Net Kar (Sefa)"
          value={`${fmt(cost.actualProfit)} TL`}
          subtitle={`%${cost.actualMarkupPct.toFixed(0)} markup`}
          warning={cost.actualMarkupPct < cost.intendedProfit / cost.baseCost * 100 * 0.7}
        />
        <VatCell label="PSP Komisyon" value={`${fmt(cost.processingFee)} TL`} />
        <VatCell label="KDV" value={`${fmt(cost.vatAmount)} TL`} />
      </div>

      {/* Margin warning (v0.4 — Fix #7 min margin guard) */}
      {cost.marginWarning && (
        <div className="relative mt-4 px-3 py-2.5 rounded-lg bg-kirmizi/15 ring-2 ring-kirmizi/50 text-[12.5px] leading-relaxed">
          <div className="font-bold text-kirmizi mb-1">
            ⚠️ DÜŞÜK MARJ UYARISI
          </div>
          <div className="text-white/90 tabular-nums">
            Intended markup <strong>%{cost.marginWarning.intendedMarkupPct}</strong> →{" "}
            actual <strong className="text-kirmizi">%{cost.marginWarning.actualMarkupPct.toFixed(0)}</strong>
            {" "}(<strong>%{cost.marginWarning.erosionPct.toFixed(0)} erosion</strong>).
            Min markup floor: %{cost.marginWarning.floor}. Tier discount kâr ediyor.
          </div>
        </div>
      )}

      {/* Tier erosion info — warning yoksa bilgilendirme */}
      {!cost.marginWarning && Math.abs(cost.tierMultiplier - 1) > 0.001 && (
        <div className="relative mt-3 px-3 py-2 rounded-lg bg-white/10 text-[11.5px] flex justify-between items-center tabular-nums">
          <span className="text-white/70">
            Intended markup: <strong className="text-white">%{((cost.intendedProfit / cost.baseCost) * 100).toFixed(0)}</strong>
            {" "}→ tier {cost.tierMultiplier.toFixed(2)}× sonrası actual: <strong className={cn(
              cost.actualMarkupPct < (cost.intendedProfit / cost.baseCost) * 100 * 0.7 ? "text-pim-mercan" : "text-yesil"
            )}>%{cost.actualMarkupPct.toFixed(0)}</strong>
          </span>
        </div>
      )}

      {/* Tolerance strip */}
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
      <div className="bg-gri-50 ring-1 ring-dashed ring-gri-200 rounded-lg p-4 flex items-center justify-center min-h-[260px]">
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
}: {
  result: ReturnType<typeof quoteSticker>;
}) {
  if (!result.ok) return null;
  const { cost } = result;

  return (
    <Card padding="p-0">
      <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">Maliyet Detayı</h3>
        <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full bg-white ring-1 ring-gri-200 font-semibold">
          3 KATMAN
        </span>
      </div>
      <div className="px-5 divide-y divide-gri-100">
        {/* Üretim */}
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

        {/* Operasyon */}
        {cost.operationItems.map((item, i) => (
          <BreakdownRow key={`op-${i}`} item={item} />
        ))}
        <BreakdownRow
          item={{
            name: "Operasyon Ara Toplam",
            formula: "②",
            amount: cost.operationCost,
          }}
          subtotal
        />

        {/* Total cost */}
        <BreakdownRow
          item={{
            name: "Toplam Maliyet",
            formula: "① + ②",
            amount: cost.baseCost,
          }}
          highlight
        />

        {/* Profit / fee / tier / VAT */}
        <BreakdownRow
          item={{
            name: "Kar Marjı",
            formula: `${cost.baseCost.toFixed(0)} × marj%`,
            amount: cost.profit,
          }}
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
            formula: `subtotal × kdv%`,
            amount: cost.vatAmount,
          }}
        />
        <BreakdownRow
          item={{
            name: "Müşteri Satış Fiyatı",
            formula: "KDV dahil",
            amount: cost.total,
          }}
          total
        />
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
        {fmt(Math.abs(item.amount))} TL
      </div>
    </div>
  );
}
