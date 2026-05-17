/**
 * Pim Etiket — /admin/fiyat-hesapla-tabaka
 *
 * Sefa 17 May v6: Tabaka etiket için manuel fiyat hesabı.
 *
 * Rulo etiketten farklılaşma:
 *   - Rolls yerine SHEETS (tabaka sayısı)
 *   - Standart tabaka 23×31 cm (zarf 24×32 cm)
 *   - Kullanılabilir alan 19×27 cm (4 cm marj)
 *   - Min 250, max 10000 adet
 *   - Tier 250/500/1K/2.5K/5K/10K
 *   - Materials: kraft / kuşe / beyaz (3 tane, ultra+metalik YOK)
 *   - Coatings: yok / mat / parlak (soft touch YOK)
 *   - Özelleştirme YOK (tabakada emboss/yaldız/spot UV yapılmıyor)
 *
 * Hesap: pricing-calc.ts calculatePrice() ile (etiket_tabaka scope).
 * Config: FALLBACK_ETIKET_TABAKA_CONFIG (Sefa override edebilir, lokal).
 */

"use client";

import { useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ProfileTabs } from "@/components/admin/pricing/ProfileTabs";
import {
  FALLBACK_ETIKET_TABAKA_CONFIG,
  type ProfileConfig,
} from "@/lib/pricing-config-types";
import { calculatePrice } from "@/lib/pricing-calc";

// ============================================================
// Constants — tabaka geometry
// ============================================================

/** Standart küçük tabaka 23×31 cm (Sefa kuralı 15 May v5) */
const SHEET_W_MM = 230;
const SHEET_H_MM = 310;
const SHEET_MARGIN_MM = 20;

/** Kullanılabilir baskı alanı (her kenardan 2 cm marj) */
const USABLE_W_MM = SHEET_W_MM - 2 * SHEET_MARGIN_MM; // 190
const USABLE_H_MM = SHEET_H_MM - 2 * SHEET_MARGIN_MM; // 270

/** Adet başına boşluk (her sticker arası, mm) */
const GAP_MM = 6;

// ============================================================
// Helpers
// ============================================================

const fmt = (n: number, dec = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

interface SheetGeometry {
  cols: number;
  rows: number;
  per_sheet: number;
  sheets_needed: number;
  total_m2: number;
  waste_pct: number;
}

/**
 * Tabaka geometry hesabı — kaç sticker bir tabakaya sığar?
 *
 * Sefa kuralı 15 May v5: 5 mm step'e snap (yukarı). Min 5 mm.
 */
function calculateSheetGeometry(
  width_mm: number,
  height_mm: number,
  qty: number
): SheetGeometry {
  const w = Math.max(5, Math.ceil(width_mm / 5) * 5);
  const h = Math.max(5, Math.ceil(height_mm / 5) * 5);

  // Klasik orientation: width yatay, height dikey
  const cols_w = Math.floor((USABLE_W_MM + GAP_MM) / (w + GAP_MM));
  const rows_h = Math.floor((USABLE_H_MM + GAP_MM) / (h + GAP_MM));
  const per_a = Math.max(0, cols_w * rows_h);

  // 90° rotated: width dikey, height yatay
  const cols_h = Math.floor((USABLE_W_MM + GAP_MM) / (h + GAP_MM));
  const rows_w = Math.floor((USABLE_H_MM + GAP_MM) / (w + GAP_MM));
  const per_b = Math.max(0, cols_h * rows_w);

  // En çok sığan orientation seç
  const per_sheet = Math.max(per_a, per_b, 1);
  const cols = per_a >= per_b ? cols_w : cols_h;
  const rows = per_a >= per_b ? rows_h : rows_w;

  const sheets_needed = Math.ceil(qty / per_sheet);
  const total_area_mm2 = sheets_needed * SHEET_W_MM * SHEET_H_MM;
  const total_m2 = total_area_mm2 / 1_000_000;
  const used_mm2 = qty * w * h;
  const waste_pct = ((total_area_mm2 - used_mm2) / total_area_mm2) * 100;

  return {
    cols,
    rows,
    per_sheet,
    sheets_needed,
    total_m2,
    waste_pct,
  };
}

// ============================================================
// Defaults
// ============================================================

const DEFAULTS = {
  width: 60,
  height: 40,
  qty: 1000,
  material_id: "kraft",
  coating_id: "yok",
};

// ============================================================
// Page
// ============================================================

export default function FiyatHesaplaTabakaPage() {
  const toast = useToast();

  // Config (FALLBACK'tan, Sefa lokal override yapabilir)
  const [config, setConfig] = useState<ProfileConfig>(
    JSON.parse(JSON.stringify(FALLBACK_ETIKET_TABAKA_CONFIG))
  );

  // Form state
  const [width, setWidth] = useState(DEFAULTS.width);
  const [height, setHeight] = useState(DEFAULTS.height);
  const [qty, setQty] = useState(DEFAULTS.qty);
  const [materialId, setMaterialId] = useState(DEFAULTS.material_id);
  const [coatingId, setCoatingId] = useState(DEFAULTS.coating_id);

  // Hesap (her render'da)
  const geometry = useMemo(
    () => calculateSheetGeometry(width, height, qty),
    [width, height, qty]
  );

  const priceResult = useMemo(() => {
    return calculatePrice(
      {
        width_mm: width,
        height_mm: height,
        qty,
        material_id: materialId,
        selected_options: { coating: coatingId },
        // Tabaka mode: geometriden gelen tabaka sayısı
        sheets_needed: geometry.sheets_needed,
      },
      config
    );
  }, [width, height, qty, materialId, coatingId, config, geometry.sheets_needed]);

  // Config override (margin/operation/vat değiştirmek için)
  const updateMargin = (pct: number) => {
    setConfig({ ...config, margin: { pct } });
  };
  const updateVat = (pct: number) => {
    setConfig({ ...config, vat: { pct } });
  };
  const updateOpField = (key: keyof ProfileConfig["operation"], value: number) => {
    setConfig({ ...config, operation: { ...config.operation, [key]: value } });
  };

  const reset = () => {
    setConfig(JSON.parse(JSON.stringify(FALLBACK_ETIKET_TABAKA_CONFIG)));
    setWidth(DEFAULTS.width);
    setHeight(DEFAULTS.height);
    setQty(DEFAULTS.qty);
    setMaterialId(DEFAULTS.material_id);
    setCoatingId(DEFAULTS.coating_id);
    toast.success("Varsayılan değerlere döndü");
  };

  // Tier preset chip'leri
  const QTY_PRESETS = [250, 500, 1000, 2500, 5000, 10000] as const;

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-56px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <ProfileTabs active="tabaka" />

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
          <div>
            <Eyebrow>Operatör · Hesaplama aracı</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              📄 Tabaka Etiket Fiyat Hesapla
            </h1>
            <p className="mt-2 text-base text-gri-700">
              Kraft / Kuşe / Beyaz · 23×31 cm tabaka (zarf 24×32) ·
              özelleştirme yok · min 250 adet.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <span>↺</span> Sıfırla
          </Button>
        </div>

        {/* Bilgi notu */}
        <Card padding="p-3" className="mb-5 !bg-krem ring-black/[0.04]">
          <div className="flex items-center gap-3 text-[12.5px] text-gri-700 leading-relaxed">
            <span className="text-[18px]">💡</span>
            <div>
              <strong>Parametre yönetimi:</strong> Bu sayfa lokal hesap aracı —
              değişiklikler kalıcı değil. Müşteri tarafına yansıyan kalıcı
              fiyat ayarı için{" "}
              <a
                href="/admin/fiyatlar"
                className="text-pim-mercan font-semibold hover:underline"
              >
                /admin/fiyatlar → 📄 Tabaka Etiket
              </a>{" "}
              sayfasına git.
            </div>
          </div>
        </Card>

        {/* Main grid: form (sol) + result (sağ) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
          {/* SOL — FORM */}
          <div className="space-y-4">
            {/* Boyut + Adet */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
                📐 <span>Boyut + Adet</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <Field label="Genişlik (mm)">
                  <input
                    type="number"
                    value={width}
                    step={1}
                    min={5}
                    max={USABLE_W_MM}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="Yükseklik (mm)">
                  <input
                    type="number"
                    value={height}
                    step={1}
                    min={5}
                    max={USABLE_H_MM}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="Adet">
                  <input
                    type="number"
                    value={qty}
                    step={50}
                    min={250}
                    max={10000}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
              </div>

              {/* Tier presets */}
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700 mb-2">
                  Tier Preset
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {QTY_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQty(p)}
                      className={cn(
                        "px-3 h-9 rounded-full text-[12.5px] font-semibold transition-colors tabular-nums",
                        qty === p
                          ? "bg-saman-koyu text-white"
                          : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                      )}
                    >
                      {fmt(p)}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Malzeme + Kaplama */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
                🎨 <span>Malzeme + Kaplama</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Malzeme">
                  <select
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
                  >
                    {config.materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.sheet_cost_try ?? m.m2_cost_try} TL/tabaka
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Kaplama">
                  <select
                    value={coatingId}
                    onChange={(e) => setCoatingId(e.target.value)}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan"
                  >
                    {config.options.coating?.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} (+{it.pct_add}%)
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>

            {/* Operation + Margin (override) */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
                ⚙ <span>Operasyon + Marj (lokal override)</span>
              </h2>
              <p className="text-[11.5px] text-gri-700 mb-3 leading-relaxed">
                Bu değerler sadece bu hesap için geçerli. Müşteri tarafına
                kalıcı yansıtmak için <strong>/admin/fiyatlar</strong>'ı kullan.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Setup (TL)">
                  <input
                    type="number"
                    value={config.operation.setup}
                    step={5}
                    onChange={(e) =>
                      updateOpField("setup", Number(e.target.value))
                    }
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="Paketleme/adet">
                  <input
                    type="number"
                    value={config.operation.packaging_per_unit}
                    step={0.005}
                    onChange={(e) =>
                      updateOpField(
                        "packaging_per_unit",
                        Number(e.target.value)
                      )
                    }
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="Kargo (TL)">
                  <input
                    type="number"
                    value={config.operation.cargo}
                    step={5}
                    onChange={(e) =>
                      updateOpField("cargo", Number(e.target.value))
                    }
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="Komisyon (%)">
                  <input
                    type="number"
                    value={config.operation.fee_pct}
                    step={0.1}
                    onChange={(e) =>
                      updateOpField("fee_pct", Number(e.target.value))
                    }
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Kâr marjı (%)">
                  <input
                    type="number"
                    value={config.margin.pct}
                    step={1}
                    onChange={(e) => updateMargin(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
                <Field label="KDV (%)">
                  <input
                    type="number"
                    value={config.vat.pct}
                    step={1}
                    onChange={(e) => updateVat(Number(e.target.value))}
                    className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                  />
                </Field>
              </div>
            </Card>

            {/* Geometry detayı */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[15px] mb-3 flex items-center gap-2">
                📐 <span>Tabaka dizgi planı</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Stat label="Tabaka boyu" value={`${SHEET_W_MM}×${SHEET_H_MM}mm`} />
                <Stat
                  label="Kullanılabilir alan"
                  value={`${USABLE_W_MM}×${USABLE_H_MM}mm`}
                />
                <Stat
                  label="Tabakaya sığan"
                  value={`${geometry.per_sheet} adet`}
                  highlight
                />
                <Stat
                  label="Toplam tabaka"
                  value={`${geometry.sheets_needed}`}
                  highlight
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Dizgi (kolon × satır)"
                  value={`${geometry.cols} × ${geometry.rows}`}
                />
                <Stat
                  label="Fire oranı"
                  value={`%${fmt(geometry.waste_pct, 1)}`}
                  warn={geometry.waste_pct > 30}
                />
              </div>
            </Card>
          </div>

          {/* SAĞ — RESULT */}
          <div className="space-y-4 lg:sticky lg:top-4 h-fit">
            {/* Result card */}
            {priceResult.ok ? (
              <Card padding="p-5" className="!bg-saman/10 ring-saman/30">
                <div className="text-[10.5px] uppercase tracking-[0.04em] font-bold text-saman-koyu mb-2">
                  Müşteri görür
                </div>
                <div className="text-[36px] font-bold tabular-nums text-saman-koyu leading-none">
                  {fmt(priceResult.final, 0)} TL
                </div>
                <div className="text-[13px] text-gri-700 mt-1">
                  Birim:{" "}
                  <strong className="font-mono">
                    {priceResult.unit_price.toFixed(2)} TL/adet
                  </strong>
                </div>
                <div className="mt-4 pt-4 border-t border-saman/20 space-y-1.5 text-[12px] font-mono">
                  <Row
                    label={`Base (tabaka × ${geometry.sheets_needed} adet)`}
                    value={fmt(priceResult.base, 2)}
                  />
                  <Row
                    label={`× Tier (${priceResult.tier.label})`}
                    value={fmt(priceResult.tiered, 2)}
                  />
                  <Row
                    label={`+ Options ${priceResult.options_pct_total}%`}
                    value={fmt(priceResult.with_options, 2)}
                  />
                  <Row
                    label="+ Operasyon"
                    value={`+${fmt(priceResult.operation_cost, 2)}`}
                  />
                  <Row
                    label={`+ Margin %${config.margin.pct}`}
                    value={fmt(priceResult.with_margin, 2)}
                  />
                  <Row
                    label="+ Fee gross-up"
                    value={fmt(priceResult.with_fee, 2)}
                  />
                  <Row
                    label={`+ KDV %${config.vat.pct}`}
                    value={fmt(priceResult.final, 2)}
                  />
                </div>
              </Card>
            ) : (
              <Card padding="p-5" className="!bg-kirmizi/5 ring-kirmizi/20">
                <div className="text-[14px] font-semibold text-kirmizi mb-1">
                  ⚠ Hesap hatası
                </div>
                <div className="text-[12px] text-gri-700">
                  {priceResult.reason}
                  {priceResult.hint && (
                    <>
                      <br />
                      {priceResult.hint}
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Sheet visual preview (basit) */}
            {priceResult.ok && (
              <Card padding="p-4">
                <h3 className="font-semibold text-[13px] mb-3">
                  Tabaka önizleme (1 tabaka)
                </h3>
                <SheetPreview
                  cols={geometry.cols}
                  rows={geometry.rows}
                  per_sheet={geometry.per_sheet}
                />
                <div className="text-[11px] text-gri-700 mt-3 leading-relaxed">
                  1 tabakaya <strong>{geometry.per_sheet} adet</strong> sığar
                  ·<br />
                  Toplam <strong>{geometry.sheets_needed} tabaka</strong> gerek
                  ·<br />
                  Toplam alan{" "}
                  <strong>
                    {geometry.total_m2.toFixed(2)} m² (zarfsız)
                  </strong>
                </div>
              </Card>
            )}

            {/* Pim help */}
            <Card padding="p-4" className="!bg-pim-mercan-tint">
              <div className="flex gap-3 items-start">
                <Pim pose="think" size={48} bob={false} />
                <div>
                  <div className="text-[12.5px] font-bold text-pim-mercan mb-1">
                    Tabaka mı, rulo mu?
                  </div>
                  <div className="text-[11.5px] text-gri-700 leading-relaxed">
                    Tabaka = küçük adet (250-10K), el dizgisi, özelleştirme
                    yok, daha ucuz. Rulo = büyük adet (1K-50K), makine, emboss
                    /yaldız mümkün.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
        {label}
      </div>
      <div
        className={cn(
          "text-[16px] font-bold tabular-nums mt-0.5",
          highlight && "text-saman-koyu",
          warn && "text-kirmizi",
          !highlight && !warn && "text-lacivert"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gri-700">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Basit SVG tabaka önizlemesi — kolon × satır grid.
 */
function SheetPreview({
  cols,
  rows,
  per_sheet,
}: {
  cols: number;
  rows: number;
  per_sheet: number;
}) {
  const SCALE = 1;
  const W = SHEET_W_MM * SCALE;
  const H = SHEET_H_MM * SCALE;
  const margin = SHEET_MARGIN_MM * SCALE;
  const gap = GAP_MM * SCALE;
  const usableW = W - 2 * margin;
  const usableH = H - 2 * margin;
  const cellW = (usableW - (cols - 1) * gap) / Math.max(1, cols);
  const cellH = (usableH - (rows - 1) * gap) / Math.max(1, rows);

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={margin + c * (cellW + gap)}
          y={margin + r * (cellH + gap)}
          width={cellW}
          height={cellH}
          fill="#FFC9C2"
          stroke="#FF6B5B"
          strokeWidth={1}
          rx={2}
        />
      );
    }
  }

  return (
    <div className="relative w-full max-w-[280px] mx-auto aspect-[230/310] bg-white ring-1 ring-gri-200 rounded-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        {/* Margin guide (light) */}
        <rect
          x={margin}
          y={margin}
          width={usableW}
          height={usableH}
          fill="none"
          stroke="#D6D3D1"
          strokeWidth={0.5}
          strokeDasharray="3 2"
        />
        {cells}
      </svg>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-mono text-gri-500 bg-white/80 px-1.5 rounded">
        {SHEET_W_MM}×{SHEET_H_MM}mm · {per_sheet} adet
      </div>
    </div>
  );
}
