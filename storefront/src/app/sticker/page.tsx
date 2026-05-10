/**
 * Pim Etiket — /sticker konfigüratör (E.1.3)
 *
 * design-prototype/v1-jsx/sticker.jsx → Next.js + Tailwind 4 + TS port.
 *
 * 5 step:
 *   1. Şekil (4: yuvarlak/kare/yumuşak köşe/kontur kesim)
 *   2. Malzeme (4: vinil/transparan/holografik/kraft)
 *   3. Yüzey (3: parlak/mat/simli)
 *   4. Boyut (4 preset: 50/75/100/150 mm)
 *   5. Adet (6 tier card: 50/100/250/500/1000/2500)
 *
 * Sol sticky StickerPreview canvas (rotate -6, holo gradient + finish overlay).
 * Sağ config + PriceCard variant="bold" (lacivert gradient, mercan accent).
 * Hero başlığında Pim excited 120px.
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pim, PimMini } from "@/components/Pim";
import { PimAsset } from "@/components/PimAsset";
import {
  SchemaJsonLd,
  productSchema,
  breadcrumbSchema,
} from "@/components/SchemaJsonLd";
import { Icon } from "@/components/Icon";
import {
  FormSection,
  SelectableCard,
  PriceCard,
  QtySlider,
  useToast,
  DesignDropZone,
  type DesignTempState,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { deliveryEstimate } from "@/lib/pricing";
import {
  quoteCustomerSticker,
  computeTierSavings,
  CUSTOMER_STICKER_TIERS,
  STICKER_MIN_DIM,
  STICKER_MAX_W,
  STICKER_MAX_H,
  STICKER_MIN_QTY,
  STICKER_MAX_QTY,
  STICKER_QTY_STEP,
  type StickerMaterial,
  type StickerFinish,
} from "@/lib/sticker-customer-pricing";
import { addToCustomerCart } from "@/lib/customer-cart";

// ============================================================
// Configuration data
// ============================================================

// Sıra: Kare → Yuvarlak → Özel oran → Kontur kesim
// Tabaka modunda Kontur kesim GÖSTERİLMEZ (tabakada özel kontur yok).
const SHAPES = [
  { id: "square", name: "Kare", desc: "Köşeli kenar" },
  { id: "circle", name: "Yuvarlak", desc: "Daire / oval" },
  { id: "ozel", name: "Özel oran", desc: "Dikdörtgen / bumper" },
  { id: "die", name: "Kontur kesim", desc: "Pim baykuş silueti gibi" },
] as const;

type ShapeId = (typeof SHAPES)[number]["id"];

const MATERIALS = [
  { id: "vinil", name: "Vinil", desc: "Su ve UV dayanımı", swatch: "#FFFFFF" },
  {
    id: "transparan",
    name: "Transparan",
    desc: "Şeffaf zemin",
    swatch: "linear-gradient(135deg,#E0F2FE,#FFFFFF)",
  },
  {
    id: "holo",
    name: "Holografik",
    desc: "Yansımalı, festival",
    swatch:
      "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
  },
  {
    id: "simli",
    name: "Simli",
    desc: "Parıltı taneli zemin",
    swatch:
      "radial-gradient(circle at 30% 30%, #FFE8B7 1.5px, transparent 2.5px), radial-gradient(circle at 70% 60%, #FFB7E5 1.5px, transparent 2.5px), radial-gradient(circle at 50% 80%, #B7E8FF 1px, transparent 2px), linear-gradient(135deg,#F5EBD9,#FFFFFF)",
  },
] as const;

const FINISHES = [
  { id: "parlak", name: "Parlak", desc: "Canlı renkler" },
  { id: "mat", name: "Mat", desc: "Yansımasız" },
  { id: "yok", name: "Kaplamasız", desc: "Yalın yüzey" },
] as const;

/** Sticker preset chip'leri — serbest qty seçim yanında one-click presets */
const STICKER_PRESETS = CUSTOMER_STICKER_TIERS; // [25, 50, 100, 250, 500, 1000]
/** En çok seçilen preset — "Popüler" rozeti gösterilir */
const STICKER_POPULAR_PRESET = 250;

/** Qty'i step'e snap'le (25'in katı), min/max'a clamp et */
function snapStickerQty(n: number): number {
  if (!Number.isFinite(n)) return STICKER_MIN_QTY;
  const stepped = Math.round(n / STICKER_QTY_STEP) * STICKER_QTY_STEP;
  return Math.min(STICKER_MAX_QTY, Math.max(STICKER_MIN_QTY, stepped));
}

// ============================================================
// Pricing — v0.4: shared pricing-engine wrapper kullanıyor
// (KDV mevzuat uyumlu, PSP fee gross-up'lı, tier erosion düzgün hesap)
// ============================================================
//
// Önceki hardcoded `tierBase()` formülü (v0.3) kaldırıldı.
// Yeni: quoteCustomerSticker() — admin'deki shared lib ile aynı motor.

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

export default function StickerPage() {
  const toast = useToast();
  const { t } = useT();
  // 1. ADIM: Kesim tipi (Sefa kuralı — şekilden ÖNCE)
  const [cutMode, setCutMode] = useState<"tabaka" | "diecut">("diecut");
  // 2. ADIM: Şekil
  const [shape, setShape] = useState<ShapeId>("square");
  const [softCorners, setSoftCorners] = useState<boolean>(false);
  const [material, setMaterial] = useState<StickerMaterial>("vinil");
  const [finish, setFinish] = useState<StickerFinish>("parlak");
  // Müşteri serbest qty seçer — 25'er artış, 25-1000 aralık.
  // findTier en yakın STICKER_TIERS multiplier'ını otomatik uygular.
  const [tier, setTier] = useState<number>(250);
  const [width, setWidth] = useState<number>(75);
  const [height, setHeight] = useState<number>(75);
  // Pre-purchase tasarım — sepete eklemeden önce yüklenip mockup'ta görünür
  const [design, setDesign] = useState<DesignTempState | null>(null);

  // /tasarımlarım'dan "Yeniden bastır" tıklandıysa sessionStorage'dan al
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reprint") !== "1") return;
    try {
      const raw = sessionStorage.getItem("pim_reprint_design");
      if (raw) {
        const parsed = JSON.parse(raw) as DesignTempState;
        setDesign(parsed);
        sessionStorage.removeItem("pim_reprint_design");
        toast.info("Tasarımın hazır — boyut/adet seç, sepete ekle");
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tabaka modunda kontur kesim seçili kalmasın — kareye düş
  if (cutMode === "tabaka" && shape === "die") {
    setShape("square");
  }

  // Tabaka modunda kontur kesim gizli
  const visibleShapes =
    cutMode === "tabaka"
      ? SHAPES.filter((s) => s.id !== "die")
      : SHAPES;

  // Engine ile canlı quote
  const quote = quoteCustomerSticker({
    width,
    height,
    material,
    finish,
    qty: tier,
    cut: cutMode,
  });

  const total = quote.ok ? quote.total : 0;
  const currentUnit = quote.ok ? quote.unitPrice : 0;
  const overrunCount = quote.ok ? quote.overrunCount : 0;
  // Tasarruf hesabı: en küçük tier (25) baseline alınır
  const savings = computeTierSavings(
    { width, height, material, finish },
    STICKER_MIN_QTY,
    tier
  );
  const sizeError = !quote.ok ? quote.reason : null;

  return (
    <main
      className="animate-fade-up min-h-[calc(100vh-64px)]"
      style={{
        background:
          "linear-gradient(180deg, #FFF6F2 0%, #FFFFFF 30%, #FFFFFF 100%)",
      }}
    >
      <SchemaJsonLd
        data={[
          productSchema({
            name: "Sticker — özel baskı",
            description:
              "Die-cut veya tabaka. Vinil/transparan/holo/simli. Laptop, defter, kampanya için. AI dosya kontrolü ile 5-7 iş günü teslim. 25 adetten başlar.",
            category: "Sticker",
            priceFrom: 113,
          }),
          breadcrumbSchema([
            { label: "Anasayfa", url: "/" },
            { label: "Sticker", url: "/sticker" },
          ]),
        ]}
      />
      {/* Breadcrumb */}
      <div className="border-b border-gri-200 bg-white/80">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-3 md:py-4 flex items-center gap-2 text-[13px] md:text-[14px]">
          <Link
            href="/"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            {t.nav.home}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold truncate">
            {t.nav.sticker} {t.config.breadcrumb}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        {/* Page hero */}
        <div className="flex items-end gap-4 mb-6 md:mb-7">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-turuncu text-white text-[12.5px] font-semibold mb-2.5">
              <Icon.Sparkle size={12} /> {t.sticker.pillStart}
            </span>
            <h1 className="text-[24px] md:text-[40px] font-semibold tracking-tight leading-tight">
              {t.sticker.pageTitle}
            </h1>
            <p className="mt-2 text-[14px] md:text-base text-gri-700 max-w-[480px] leading-relaxed">
              {t.sticker.pageSubtitle}
            </p>
          </div>
          <div className="hidden md:block">
            <Pim pose="excited" size={120} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
          {/* LEFT — sticky preview */}
          <div className="lg:sticky lg:top-20">
            <StickerPreview
              shape={shape}
              softCorners={softCorners}
              material={material}
              finish={finish}
              width={width}
              height={height}
              designUrl={design?.previewUrl ?? null}
            />
            <div className="text-[13px] text-gri-700 text-center mt-3">
              {design
                ? "✓ Senin tasarımın önizlemede"
                : "Anlık önizleme — her seçim canlı"}
            </div>
            {/* Design upload zone */}
            <div className="mt-4">
              <DesignDropZone value={design} onChange={setDesign} />
            </div>
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-4">
            {/* 1. ADIM: Kesim Tipi (Tabaka / Die Cut) — şekilden önce */}
            <FormSection
              title={t.sticker.cutTypeTitle}
              hint={t.sticker.cutTypeHint}
            >
              <div className="grid grid-cols-2 gap-3">
                <CutModeCard
                  kind="tabaka"
                  selected={cutMode === "tabaka"}
                  onClick={() => setCutMode("tabaka")}
                />
                <CutModeCard
                  kind="diecut"
                  selected={cutMode === "diecut"}
                  onClick={() => setCutMode("diecut")}
                />
              </div>
            </FormSection>

            <FormSection
              title={t.sticker.shapeTitle}
              hint={
                cutMode === "tabaka"
                  ? t.sticker.shapeHintTabaka
                  : t.sticker.shapeHintDieCut
              }
            >
              <div
                className={cn(
                  "grid gap-2.5",
                  cutMode === "tabaka" ? "grid-cols-3" : "grid-cols-4"
                )}
              >
                {visibleShapes.map((s) => (
                  <SelectableCard
                    key={s.id}
                    selected={shape === s.id}
                    onClick={() => setShape(s.id)}
                    style={{ textAlign: "center" }}
                    padding={12}
                  >
                    <ShapeIcon
                      id={s.id}
                      active={shape === s.id}
                      inSheet={cutMode === "tabaka"}
                    />
                    <div className="text-[11.5px] font-bold tracking-[0.04em] text-gri-700 mt-2 leading-tight">
                      {s.name}
                    </div>
                  </SelectableCard>
                ))}
              </div>
              {shape === "ozel" && (
                <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-pim-mercan-tint/40 ring-1 ring-pim-mercan-soft text-[12.5px] text-lacivert leading-relaxed">
                  <strong className="text-pim-mercan-koyu">Özel oran:</strong>{" "}
                  Standart kare/yuvarlak yerine kendi oranını seç (60×80,
                  100×40, 25×255 mm). Köşe seçeneğiyle{" "}
                  <strong>bumper sticker / pill</strong> formuna ulaş.
                </div>
              )}

              {/* Köşe seçeneği — kare ve özel için alt-toggle */}
              {(shape === "square" || shape === "ozel") && (
                <div className="mt-3">
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-gri-700 mb-2">
                    Köşe Seçeneği
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <CornerStyleCard
                      kind="sharp"
                      selected={!softCorners}
                      onClick={() => setSoftCorners(false)}
                    />
                    <CornerStyleCard
                      kind="soft"
                      selected={softCorners}
                      onClick={() => setSoftCorners(true)}
                    />
                  </div>
                </div>
              )}

              {/* Şekil örnekleri — sadece kontur kesim için (özel oran düz dikdörtgen) */}
              {shape === "die" && (
                <div className="mt-3 px-3.5 py-3 rounded-lg bg-krem-soft ring-1 ring-krem-deep">
                  <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-gri-700 mb-2">
                    Kontur kesim ile mümkün olanlar
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <ShapeExampleIcon kind="heart" />
                    <ShapeExampleIcon kind="star" />
                    <ShapeExampleIcon kind="wave" />
                    <ShapeExampleIcon kind="leaf" />
                    <ShapeExampleIcon kind="speech" />
                    <span className="text-[11.5px] text-gri-700 ml-1">
                      ve dahası — kalp, yıldız, dalga, yaprak, balon …
                    </span>
                  </div>
                </div>
              )}
            </FormSection>

            <FormSection title={t.config.materialTitle}>
              <div className="grid grid-cols-2 gap-2.5">
                {MATERIALS.map((m) => (
                  <SelectableCard
                    key={m.id}
                    selected={material === m.id}
                    onClick={() => setMaterial(m.id)}
                    padding={12}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-lg flex-shrink-0 ring-1 ring-black/[0.06]"
                      style={{ background: m.swatch }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{m.name}</div>
                      <div className="text-[13px] text-gri-700">{m.desc}</div>
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title={t.config.finishTitle}>
              <div className="grid grid-cols-3 gap-2.5">
                {FINISHES.map((f) => (
                  <SelectableCard
                    key={f.id}
                    selected={finish === f.id}
                    onClick={() => setFinish(f.id)}
                    padding={12}
                  >
                    <div className="font-semibold text-sm">{f.name}</div>
                    <div className="text-[13px] text-gri-700 mt-0.5">
                      {f.desc}
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title={t.config.sizeTitle} hint={`min ${STICKER_MIN_DIM}×${STICKER_MIN_DIM} mm · max ${STICKER_MAX_W}×${STICKER_MAX_H} mm (40×65 cm)`}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    Genişlik (mm)
                  </span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Math.max(STICKER_MIN_DIM, Math.min(STICKER_MAX_W, Number(e.target.value) || STICKER_MIN_DIM)))}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_W}
                    step={1}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow tabular-nums"
                  />
                </label>
                <span className="text-gri-500 font-medium pb-3.5 text-lg">×</span>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    Yükseklik (mm)
                  </span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Math.max(STICKER_MIN_DIM, Math.min(STICKER_MAX_H, Number(e.target.value) || STICKER_MIN_DIM)))}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_H}
                    step={1}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow tabular-nums"
                  />
                </label>
              </div>

              {/* Hızlı boyut chip'leri */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-[11.5px] text-gri-500 self-center mr-1">{t.config.quickSize}</span>
                {[
                  { w: 50, h: 50, label: "50×50" },
                  { w: 75, h: 75, label: "75×75" },
                  { w: 100, h: 100, label: "100×100" },
                  { w: 60, h: 80, label: "60×80" },
                  { w: 100, h: 50, label: "100×50" },
                ].map((preset) => {
                  const active = width === preset.w && height === preset.h;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setWidth(preset.w);
                        setHeight(preset.h);
                      }}
                      className={cn(
                        "px-3 h-8 rounded-full text-[12px] font-semibold transition-colors",
                        active
                          ? "bg-pim-mercan text-white"
                          : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {sizeError && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-kirmizi/10 text-kirmizi text-[12.5px] font-semibold">
                  ⚠️ {sizeError}
                </div>
              )}
            </FormSection>

            <FormSection
              title={t.config.qtyTitle}
              hint={`${STICKER_MIN_QTY} → ${STICKER_MAX_QTY} (step ${STICKER_QTY_STEP})`}
            >
              {/* Slider — Sefa onayladı, ana giriş yöntemi */}
              <div className="px-1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[28px] font-bold text-lacivert tabular-nums leading-none">
                    {tier.toLocaleString("tr-TR")}
                    <span className="text-[14px] font-medium text-gri-700 ml-1">
                      adet
                    </span>
                  </span>
                  <div className="text-right tabular-nums">
                    <div className="text-[18px] font-bold text-pim-mercan leading-none">
                      {fmt(total)} TL
                    </div>
                    <div className="text-[12px] text-gri-500 mt-0.5">
                      {fmtUnit(currentUnit)} TL/adet
                    </div>
                  </div>
                </div>
                <QtySlider
                  value={tier}
                  min={STICKER_MIN_QTY}
                  max={STICKER_MAX_QTY}
                  step={STICKER_QTY_STEP}
                  onChange={(v) => setTier(snapStickerQty(v))}
                  ariaLabel="Sticker adedi (slider)"
                />
                <div className="flex justify-between text-[10.5px] text-gri-500 mt-1.5 tabular-nums">
                  <span>{STICKER_MIN_QTY}</span>
                  <span>{STICKER_MAX_QTY}</span>
                </div>
                {savings > 0 && (
                  <div className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold mt-2">
                    %{savings} tasarruf 🎯 — bir önceki tier'dan ucuz
                  </div>
                )}
              </div>

              {/* İnce ayar: stepper + serbest input — slider'la aynı state */}
              <div className="flex items-center gap-3 flex-wrap mt-4">
                <span className="text-[11.5px] text-gri-500">İnce ayar:</span>
                <div className="inline-flex items-stretch rounded-full ring-1 ring-gri-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTier((v) => snapStickerQty(v - STICKER_QTY_STEP))}
                    disabled={tier <= STICKER_MIN_QTY}
                    aria-label={`${STICKER_QTY_STEP} adet azalt`}
                    className="w-9 h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={tier}
                    onChange={(e) => setTier(snapStickerQty(Number(e.target.value)))}
                    min={STICKER_MIN_QTY}
                    max={STICKER_MAX_QTY}
                    step={STICKER_QTY_STEP}
                    aria-label="Sticker adedi"
                    className="w-20 h-9 text-center text-[14px] font-semibold text-lacivert tabular-nums border-x border-gri-200 focus:outline-none focus:bg-pim-mercan-tint/30"
                  />
                  <button
                    type="button"
                    onClick={() => setTier((v) => snapStickerQty(v + STICKER_QTY_STEP))}
                    disabled={tier >= STICKER_MAX_QTY}
                    aria-label={`${STICKER_QTY_STEP} adet artır`}
                    className="w-9 h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Preset chip'leri — popüler nokta atışı */}
              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <span className="text-[11.5px] text-gri-500 mr-1">
                  {t.config.suggested}
                </span>
                {STICKER_PRESETS.map((q) => {
                  const active = tier === q;
                  const popular = q === STICKER_POPULAR_PRESET;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setTier(q)}
                      aria-pressed={active}
                      className={cn(
                        "relative px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors tabular-nums",
                        active
                          ? "bg-pim-mercan text-white"
                          : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
                      )}
                    >
                      {q}
                      {popular && !active && (
                        <span className="ml-1 text-pim-mercan">⭐</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <PriceCard
              variant="bold"
              topLabel="SEÇİMİN"
              total={total}
              unitPrice={
                <>
                  {tier} adet × {fmtUnit(currentUnit)} TL · KDV dahil
                  {overrunCount > 0 && (
                    <>
                      {" "}
                      <span className="text-yesil">
                        · +{overrunCount} hediye
                      </span>
                    </>
                  )}
                </>
              }
              savingsLabel={savings > 0 ? `%${savings} adet indirimi` : null}
              footnote="KDV dahil fiyat · Şeffaf, sürpriz ücret yok"
              deliveryDate={deliveryEstimate({ kind: "sticker", qty: tier })}
              ctaLabel={t.config.addToCart}
              onCta={async () => {
                if (!quote.ok) {
                  toast.error(quote.reason ?? "Geçersiz seçim");
                  return;
                }
                const matName =
                  MATERIALS.find((m) => m.id === material)?.name ?? material;
                const finName =
                  FINISHES.find((f) => f.id === finish)?.name ?? finish;
                const shapeName =
                  SHAPES.find((s) => s.id === shape)?.name ?? shape;
                const cutLabel = cutMode === "tabaka" ? "Tabaka" : "Die-cut";
                const cornerLabel =
                  shape === "square" || shape === "ozel"
                    ? softCorners
                      ? " · Yumuşatılmış köşe"
                      : " · Düz köşe"
                    : "";
                const result = await addToCustomerCart({
                  product: "sticker",
                  title: `Sticker · ${matName} + ${finName}`,
                  config: `${shapeName} · ${width}×${height}mm · ${cutLabel}${cornerLabel}`,
                  width,
                  height,
                  qty: tier,
                  unit: parseFloat(currentUnit.toFixed(2)),
                  total: Math.round(total),
                  shape,
                  cut: cutMode,
                  softCorners,
                  material,
                  finish,
                  hediyeAdet: overrunCount,
                  designTempId: design?.tempId,
                  designPreviewUrl: design?.previewUrl,
                  designFileName: design?.fileName,
                });
                if (!result.ok) {
                  toast.error(result.reason);
                  return;
                }
                // Tasarım state'ini sıfırla — yeni eklemede temiz başla
                setDesign(null);
                toast.success(
                  design
                    ? "Sepete eklendi 🛒 — tasarımın bağlandı"
                    : "Sepete eklendi 🛒 — sepete gitmek için üst menü"
                );
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// ShapeIcon
// ============================================================

function ShapeIcon({
  id,
  active,
  inSheet = false,
}: {
  id: ShapeId;
  active: boolean;
  inSheet?: boolean;
}) {
  if (inSheet) {
    return <ShapeSheetIcon id={id} active={active} />;
  }

  const stroke = active
    ? "var(--color-pim-mercan)"
    : "var(--color-lacivert)";
  const fill = active
    ? "var(--color-pim-mercan-tint)"
    : "rgba(31,41,55,0.13)";

  if (id === "circle")
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="mx-auto"
        aria-hidden
      >
        <circle cx="18" cy="18" r="14" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  if (id === "square")
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="mx-auto"
        aria-hidden
      >
        <rect x="4" y="4" width="28" height="28" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  if (id === "ozel")
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="mx-auto"
        aria-hidden
      >
        {/* Bumper / dikdörtgen oran ikon */}
        <rect
          x="2"
          y="11"
          width="32"
          height="14"
          rx="6"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
        />
      </svg>
    );
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      className="mx-auto"
      aria-hidden
    >
      <path
        d="M18 4 Q26 4 28 12 Q34 14 32 22 Q34 30 24 30 Q18 34 12 30 Q4 30 6 22 Q2 14 8 12 Q10 4 18 4 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

// ShapeSheetIcon — tabaka modunda kağıt + mini grid (Sticker Mule pattern)
function ShapeSheetIcon({ id, active }: { id: ShapeId; active: boolean }) {
  const stroke = active
    ? "var(--color-pim-mercan)"
    : "var(--color-lacivert)";
  const fill = active
    ? "var(--color-pim-mercan-tint)"
    : "rgba(31,41,55,0.10)";
  const innerStroke = active
    ? "var(--color-pim-mercan-koyu)"
    : "var(--color-gri-700)";

  return (
    <svg
      width="44"
      height="48"
      viewBox="0 0 44 48"
      className="mx-auto"
      aria-hidden
    >
      {/* Arka katman kağıtlar — depth (stack of papers) */}
      <rect
        x="6"
        y="4"
        width="34"
        height="42"
        rx="2"
        fill="white"
        stroke={stroke}
        strokeWidth="0.7"
        opacity="0.4"
      />
      <rect
        x="3"
        y="2"
        width="34"
        height="42"
        rx="2"
        fill="white"
        stroke={stroke}
        strokeWidth="0.7"
        opacity="0.7"
      />
      {/* Ön kağıt */}
      <rect
        x="0"
        y="0"
        width="34"
        height="42"
        rx="2"
        fill="white"
        stroke={stroke}
        strokeWidth="1.2"
      />

      {/* İçerik grid — id'ye göre */}
      {id === "square" && (
        <g>
          {/* 3 col × 4 row mini kareler */}
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={3 + col * 9.5}
                y={3 + row * 9.5}
                width="7.5"
                height="7.5"
                fill={fill}
                stroke={innerStroke}
                strokeWidth="0.8"
              />
            ))
          )}
        </g>
      )}
      {id === "circle" && (
        <g>
          {/* 3 col × 3 row mini daireler */}
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={6 + col * 11}
                cy={7 + row * 12.5}
                r="4.5"
                fill={fill}
                stroke={innerStroke}
                strokeWidth="0.8"
              />
            ))
          )}
        </g>
      )}
      {id === "ozel" && (
        <g>
          {/* 1 col × 5 row bumper / dikdörtgen */}
          {[0, 1, 2, 3, 4].map((row) => (
            <rect
              key={row}
              x="2.5"
              y={3 + row * 7.5}
              width="29"
              height="5.5"
              rx="2.5"
              fill={fill}
              stroke={innerStroke}
              strokeWidth="0.8"
            />
          ))}
        </g>
      )}
      {id === "die" && (
        <g>
          {/* 2 col × 3 row asimetrik kontur (Pim baykuş tasarımcı görselle uyum için)
             — tabaka modunda die zaten gizli ama defansif fallback */}
          {[0, 1, 2].map((row) =>
            [0, 1].map((col) => (
              <path
                key={`${row}-${col}`}
                transform={`translate(${4 + col * 14}, ${3 + row * 13})`}
                d="M5 0 Q9 0 10 4 Q12 5 11 8 Q12 11 8 11 Q5 13 3 11 Q0 11 1 8 Q-1 5 1 4 Q3 0 5 0 Z"
                fill={fill}
                stroke={innerStroke}
                strokeWidth="0.7"
              />
            ))
          )}
        </g>
      )}
    </svg>
  );
}

// ============================================================
// CutModeCard — Tabaka vs Die Cut seçimi (1. adım)
// ============================================================

function CutModeCard({
  kind,
  selected,
  onClick,
}: {
  kind: "tabaka" | "diecut";
  selected: boolean;
  onClick: () => void;
}) {
  const stroke = selected
    ? "var(--color-pim-mercan)"
    : "var(--color-lacivert)";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "p-4 rounded-xl ring-[1.5px] text-left transition-all relative",
        selected
          ? "ring-pim-mercan bg-pim-mercan-tint/40 shadow-1 -translate-y-0.5"
          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
      )}
    >
      <div className="flex items-start gap-3">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden className="shrink-0">
          {kind === "tabaka" ? (
            // 4 sticker tabaka içinde — yarım kesim
            <g>
              <rect
                x="3"
                y="3"
                width="50"
                height="50"
                rx="3"
                fill="white"
                stroke={stroke}
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              {/* 4 sticker grid'i */}
              {[
                [10, 10],
                [30, 10],
                [10, 30],
                [30, 30],
              ].map(([x, y]) => (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width="16"
                  height="16"
                  rx="2"
                  fill={selected ? "var(--color-pim-mercan-tint)" : "rgba(31,41,55,0.08)"}
                  stroke={stroke}
                  strokeWidth="1.6"
                />
              ))}
            </g>
          ) : (
            // Tek tek sticker, ayrılmış
            <g>
              {[
                [4, 4, "rgba(31,41,55,0.06)"],
                [22, 12, "rgba(31,41,55,0.06)"],
                [10, 26, "rgba(31,41,55,0.06)"],
                [30, 32, "rgba(31,41,55,0.06)"],
              ].map(([x, y, c], i) => (
                <rect
                  key={i}
                  x={x as number}
                  y={y as number}
                  width="20"
                  height="20"
                  rx="4"
                  fill={selected ? "var(--color-pim-mercan-tint)" : (c as string)}
                  stroke={stroke}
                  strokeWidth="1.6"
                />
              ))}
            </g>
          )}
        </svg>
        <div className="min-w-0">
          <div className="font-bold text-[14px] mb-0.5">
            {kind === "tabaka" ? "Tabaka" : "Die Cut"}
          </div>
          <div className="text-[11.5px] text-gri-700 leading-snug">
            {kind === "tabaka"
              ? "Yarım kesim — sticker'lar bir sayfada, müşteri ayırarak çıkarır."
              : "Tam kesim — her sticker tek tek hazır."}
          </div>
          <div className="text-[10.5px] text-gri-500 mt-1.5 tabular-nums">
            {kind === "tabaka" ? "6 mm gap · ekonomik" : "50 mm gap · profesyonel"}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// CornerStyleCard — Kare/Özel için Düz vs Yumuşatılmış köşe ikonu
// Dikdörtgen göstermez, sadece köşenin yakın çekimini.
// ============================================================

type CornerKind = "sharp" | "soft";

function CornerStyleCard({
  kind,
  selected,
  onClick,
}: {
  kind: CornerKind;
  selected: boolean;
  onClick: () => void;
}) {
  const stroke = selected
    ? "var(--color-pim-mercan)"
    : "var(--color-lacivert)";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "p-3 rounded-lg ring-[1.5px] text-left transition-all",
        selected
          ? "ring-pim-mercan bg-pim-mercan-tint/40"
          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Sadece köşe — L şeklinde 90° dönüş; düz vs yumuşatılmış */}
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
          {kind === "sharp" ? (
            // Keskin 90° köşe
            <path
              d="M 4 28 L 4 4 L 28 4"
              fill="none"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : (
            // Yumuşatılmış köşe (Q ile yarıçaplı)
            <path
              d="M 4 28 L 4 12 Q 4 4 12 4 L 28 4"
              fill="none"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div>
          <div className="font-bold text-[12.5px]">
            {kind === "sharp" ? "Düz köşe" : "Yumuşatılmış köşe"}
          </div>
          <div className="text-[10.5px] text-gri-700 leading-tight">
            {kind === "sharp" ? "Keskin köşe" : "Yuvarlatılmış köşe"}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// ShapeExampleIcon — kontur kesim / özel için ipucu mini ikonlar
// ============================================================

type ExampleKind = "heart" | "star" | "wave" | "leaf" | "speech";

function ShapeExampleIcon({ kind }: { kind: ExampleKind }) {
  const fill = "var(--color-pim-mercan-tint)";
  const stroke = "var(--color-pim-mercan)";
  const labels: Record<ExampleKind, string> = {
    heart: "Kalp",
    star: "Yıldız",
    wave: "Dalga",
    leaf: "Yaprak",
    speech: "Balon",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        {kind === "heart" && (
          <path
            d="M14 24 C14 24 4 17 4 11 C4 7 7 4 10.5 4 C12.5 4 14 5.5 14 7 C14 5.5 15.5 4 17.5 4 C21 4 24 7 24 11 C24 17 14 24 14 24 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
        {kind === "star" && (
          <path
            d="M14 2 L17.2 10.4 L26 11 L19 16.8 L21.2 25 L14 20.4 L6.8 25 L9 16.8 L2 11 L10.8 10.4 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
        {kind === "wave" && (
          <path
            d="M2 10 Q7 4 12 10 T22 10 T26 12 L26 22 Q22 26 18 22 T10 22 T2 22 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
        {kind === "leaf" && (
          <path
            d="M4 24 C4 12 12 4 24 4 C24 16 16 24 4 24 Z M4 24 L24 4"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
        {kind === "speech" && (
          <path
            d="M4 6 L24 6 Q26 6 26 8 L26 18 Q26 20 24 20 L14 20 L8 25 L9 20 L4 20 Q2 20 2 18 L2 8 Q2 6 4 6 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="text-[9.5px] font-semibold text-gri-700 uppercase tracking-[0.04em]">
        {labels[kind]}
      </span>
    </div>
  );
}

// ============================================================
// StickerPreview
// ============================================================

interface PreviewProps {
  shape: ShapeId;
  softCorners: boolean;
  material: StickerMaterial;
  finish: StickerFinish;
  width: number;
  height: number;
  /** Müşterinin yüklediği tasarım dosyası — preview için signed URL */
  designUrl?: string | null;
}

function StickerPreview({
  shape,
  softCorners,
  material,
  finish,
  width,
  height,
  designUrl,
}: PreviewProps) {
  // Maks 360px hedef, en uzun kenara göre ölçekle
  const maxDim = Math.max(width, height);
  const scale = Math.min(360 / maxDim, 2.4);
  const widthPx = width * scale;
  const heightPx = height * scale;
  const minDim = Math.min(width, height);
  const matBg: Record<StickerMaterial, string> = {
    vinil: "white",
    transparan: "rgba(255,255,255,0.5)",
    holo:
      "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 35%, #FFE8B7 65%, #B7FFD9 100%)",
    simli:
      // Glitter base — beyaz zemin + parıltı taneleri (multi-radial)
      "radial-gradient(circle at 20% 30%, #FFE8B7 1.5px, transparent 2.5px), radial-gradient(circle at 50% 50%, #FFB7E5 1.5px, transparent 2.5px), radial-gradient(circle at 80% 70%, #B7E8FF 1.5px, transparent 2.5px), radial-gradient(circle at 30% 80%, #FFD3CB 1px, transparent 2px), white",
  };

  const finishOverlay: Record<StickerFinish, string> = {
    parlak:
      "radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,0.7) 0%, transparent 60%)",
    mat: "transparent",
    yok: "transparent",
  };

  const radius =
    shape === "circle"
      ? "50%"
      : shape === "square"
        ? softCorners
          ? 16 // soft kare
          : 4
        : shape === "ozel"
          ? softCorners
            ? 36 // bumper sticker (pill-leaning)
            : 12 // dikdörtgen, hafif yumuşak
          : 0; // die — radius kullanılmıyor, Pim silüet render

  const customClip = "none";

  return (
    <div
      className="relative rounded-2xl p-8 min-h-[540px] overflow-hidden shadow-1"
      style={{
        background: "linear-gradient(135deg, #FFF1EE 0%, #FFD9D2 100%)",
      }}
    >
      {/* dot pattern */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(31,41,55,0.06) 1px, transparent 1.5px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Live indicator */}
      <span className="absolute top-5 left-5 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-white shadow-1 text-[12.5px] font-semibold">
        <span className="w-2 h-2 rounded-full bg-yesil" />
        Canlı
      </span>

      {/* Sticker */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{ transform: "translate(-50%, -50%) rotate(-6deg)" }}
      >
        {shape === "die" ? (
          // Kontur kesim: tasarım varsa onu göster (kontur müşteri tasarımına
          // göre kesilecek), yoksa Pim silüet placeholder
          <div
            className="relative grid place-items-center"
            style={{
              filter:
                "drop-shadow(0 0 4px white) drop-shadow(0 0 4px white) drop-shadow(0 8px 24px rgba(31,41,55,0.25)) drop-shadow(0 4px 8px rgba(31,41,55,0.12))",
            }}
          >
            {designUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={designUrl}
                alt="Senin tasarımın — kontur kesim önizleme"
                style={{
                  maxWidth: Math.min(minDim * scale * 1.2, 360),
                  maxHeight: Math.min(minDim * scale * 1.2, 360),
                  objectFit: "contain",
                }}
              />
            ) : (
              <PimAsset
                variant="detailed"
                size={Math.min(minDim * scale * 1.2, 360)}
                bob={false}
                ariaLabel="Pim baykuş — kontur kesim sticker örneği"
              />
            )}
            {(material === "holo" || material === "simli") && (
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: matBg[material],
                  mixBlendMode: "color",
                  opacity: 0.6,
                }}
              />
            )}
          </div>
        ) : (
          <div
            className="relative grid place-items-center p-1"
            style={{
              width: widthPx,
              height: heightPx,
              background: matBg[material],
              borderRadius: radius,
              clipPath: customClip,
              boxShadow:
                "0 16px 40px rgba(31,41,55,0.18), 0 4px 8px rgba(31,41,55,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: "94%",
                height: "94%",
                borderRadius: shape === "circle" ? "50%" : radius,
                background:
                  material === "transparan" && !designUrl
                    ? "transparent"
                    : material === "holo" && !designUrl
                      ? "rgba(255,255,255,0.2)"
                      : "transparent",
                border:
                  material === "transparan" && !designUrl
                    ? "2px dashed rgba(31,41,55,0.3)"
                    : "none",
                overflow: "hidden",
              }}
            >
              {designUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={designUrl}
                  alt="Senin tasarımın — önizleme"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <PimAsset
                  variant="detailed"
                  size={Math.min(minDim * scale * 0.7, 220)}
                  bob={false}
                  ariaLabel="Pim baykuş — sticker örneği"
                />
              )}
            </div>
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: finishOverlay[finish],
                borderRadius: radius,
                clipPath: customClip,
                mixBlendMode: "screen",
                opacity: finish === "mat" || finish === "yok" ? 0 : 1,
              }}
            />
          </div>
        )}
      </div>

      {/* Size badge */}
      <div className="absolute bottom-5 left-5 px-3 py-2 bg-white rounded-lg shadow-1">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
          BOYUT
        </div>
        <div className="font-semibold text-sm">
          {width} × {height} mm
        </div>
      </div>

      {/* Pim chat bubble */}
      <div className="absolute bottom-5 right-5">
        <div className="bg-white rounded-2xl p-2.5 shadow-2 flex gap-2 items-center max-w-[200px]">
          <PimMini pose="happy" size={32} />
          <div className="text-[12px] font-medium leading-snug">
            <strong>Pim:</strong> Holografik festivale gider 🎉
          </div>
        </div>
      </div>
    </div>
  );
}
