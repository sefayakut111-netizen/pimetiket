/**
 * Pim Etiket — /etiket konfigüratör sayfası (E.1.2)
 *
 * design-prototype/v1-jsx/etiket.jsx → Next.js + Tailwind 4 + TS port.
 *
 * 5 step form:
 *   1. Malzeme (4 seçenek, swatch'lı SelectableCard)
 *   2. Kaplama (4 seçenek)
 *   3. Özelleştirme (4 seçenek; "yaldız" → 8 renk picker açılır)
 *   4. Sarım yönü (1-4 dışa, 5-8 içe — WindingIcon SVG)
 *   5. Adet ve ölçü (QtySlider 1k-50k + 2 mm input)
 *
 * Sol tarafta canlı 3D-ish PreviewCanvas (rulo + sample label).
 * Sağ tarafta config + PriceCard (variant="quiet").
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import {
  FormSection,
  SelectableCard,
  QtySlider,
  PriceCard,
  Pill,
} from "@/components/ui";
import { deliveryEstimate } from "@/lib/pricing";
import { useToast } from "@/components/ui";
import {
  quoteCustomerEtiket,
  computeEtiketTierSavings,
  type EtiketMaterialId,
  type EtiketCoatingId,
  type EtiketCustomId,
} from "@/lib/etiket-customer-pricing";

// ============================================================
// Configuration data
// ============================================================

const MATERIALS = [
  { id: "kraft", name: "Kraft", desc: "Doğal, dokunsal", swatch: "#C9A47A" },
  {
    id: "beyaz",
    name: "Beyaz semi-glos",
    desc: "Klasik, parlak",
    swatch: "#F8F8F4",
  },
  {
    id: "ultra",
    name: "Ultra clear",
    desc: "Şeffaf cam etkisi",
    swatch: "linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 100%)",
  },
  {
    id: "metalik",
    name: "Metalik",
    desc: "Folyo gümüş",
    swatch:
      "linear-gradient(135deg, #C0C7CD 0%, #EFF2F6 60%, #B2BAC2 100%)",
  },
] as const;

type MaterialId = (typeof MATERIALS)[number]["id"];

const COATINGS = [
  { id: "mat", name: "Mat selefon", desc: "Yansımasız, premium" },
  { id: "parlak", name: "Parlak selefon", desc: "Canlı, temiz" },
  { id: "soft", name: "Soft touch", desc: "Velvet his" },
  { id: "yok", name: "Kaplama yok", desc: "Kâğıt dokusu kalsın" },
] as const;

type CoatingId = (typeof COATINGS)[number]["id"];

const CUSTOMS = [
  { id: "yok", name: "Eklenti yok", desc: "Sade ve hızlı" },
  { id: "emboss", name: "Kabartma (emboss)", desc: "Logo / metin kabartması" },
  { id: "yaldiz", name: "Sıcak yaldız", desc: "Folyo baskı, premium parıltı" },
  { id: "spotuv", name: "Spot UV", desc: "Parlak nokta vurgu" },
] as const;

type CustomId = (typeof CUSTOMS)[number]["id"];

const YALDIZLAR = [
  { id: "altin", c: "linear-gradient(135deg,#FFE08A 0%, #C99A3D 100%)" },
  { id: "gulkurusu", c: "linear-gradient(135deg,#FFD3CB 0%, #C97862 100%)" },
  { id: "gumus", c: "linear-gradient(135deg,#E5E9EE 0%, #9BA4AD 100%)" },
  { id: "bakir", c: "linear-gradient(135deg,#F0B17A 0%, #A65A2C 100%)" },
  { id: "siyahkrom", c: "linear-gradient(135deg,#4A4F55 0%, #11141A 100%)" },
  { id: "yesil", c: "linear-gradient(135deg,#D6F0D0 0%, #2F6B2F 100%)" },
  { id: "lacivert", c: "linear-gradient(135deg,#7B92C6 0%, #1F2A4D 100%)" },
  { id: "holo", c: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)" },
] as const;

type YaldizId = (typeof YALDIZLAR)[number]["id"];

// ============================================================
// Pricing — v0.4: shared pricing-engine wrapper
// (KDV mevzuat uyumlu, PSP fee gross-up'lı, tier erosion düzgün hesap)
// Önceki hardcoded MAT_PRICE / COAT_PRICE / CUSTOM_PRICE / tierDiscount
// kaldırıldı — quoteCustomerEtiket() admin'deki shared lib ile aynı motor
// ============================================================

function upsellFor(qty: number): { msg: string; to: number } | null {
  if (qty < 2000) return { msg: "+1000 adet ekle, %4 daha tasarruf", to: 2000 };
  if (qty < 5000) return { msg: "5000'e çık, %6 daha tasarruf", to: 5000 };
  if (qty < 10000) return { msg: "10000'e çık, %6 daha tasarruf", to: 10000 };
  if (qty < 20000) return { msg: "20000'e çık, %7 daha tasarruf", to: 20000 };
  return null;
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

export default function EtiketPage() {
  const toast = useToast();
  const [material, setMaterial] = useState<EtiketMaterialId>("kraft");
  const [coating, setCoating] = useState<EtiketCoatingId>("mat");
  const [custom, setCustom] = useState<EtiketCustomId>("yok");
  const [yaldiz, setYaldiz] = useState<YaldizId>("altin");
  const [winding, setWinding] = useState<number>(1);
  const [qty, setQty] = useState<number>(2000);
  const [width, setWidth] = useState<number>(60);
  const [height, setHeight] = useState<number>(80);

  // Engine ile canlı quote
  const quote = quoteCustomerEtiket({
    width,
    height,
    qty,
    material,
    coating,
    customization: custom,
  });

  const total = quote.ok ? quote.total : 0;
  const unit = quote.ok ? quote.unitPrice : 0;
  const rollsNeeded = quote.ok ? quote.rollsNeeded : 0;

  // Tier savings (1000 base ile karşılaştır)
  const tierSavings = quote.ok
    ? computeEtiketTierSavings({ width, height, material, coating, customization: custom }, 1000, qty)
    : 0;

  const teslim = deliveryEstimate({ kind: "etiket", qty });
  const upsell = upsellFor(qty);

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] animate-fade-up">
      {/* Breadcrumb */}
      <div className="border-b border-gri-200 bg-white">
        <div className="mx-auto max-w-[1280px] px-8 py-4 flex items-center gap-2 text-[14px]">
          <Link
            href="/"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            Anasayfa
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">Etiket konfigüre et</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-8 py-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-start">
          {/* LEFT — sticky preview */}
          <div className="lg:sticky lg:top-20">
            <PreviewCanvas
              material={material}
              coating={coating}
              custom={custom}
              yaldiz={yaldiz}
              width={width}
              height={height}
            />
            <div className="flex justify-between items-center mt-4 px-2">
              <div className="text-[13px] text-gri-700">
                Seçimlerin canlı önizlemesi
              </div>
              <div className="flex gap-2" role="group" aria-label="Önizleme görünümü">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-pressed="true"
                  title="3D görünüm aktif (yakında değiştirilebilir)"
                  className="text-sm px-3 h-9 rounded-full ring-1 ring-pim-mercan bg-pim-mercan-tint text-pim-mercan font-semibold cursor-not-allowed"
                >
                  3D
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-pressed="false"
                  title="Düz görünüm yakında"
                  className="text-sm px-3 h-9 rounded-full ring-1 ring-gri-200 text-gri-500 cursor-not-allowed opacity-60"
                >
                  Düz
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
                Etiketini konfigüre et
              </h1>
              <p className="mt-2 text-base text-gri-700">
                Seçimlerin sol taraftaki rulonun üstünde anında görünür.
              </p>
            </div>

            {/* Step 1 — Malzeme */}
            <FormSection
              number={1}
              title="Malzeme"
              hint="Etiketin dokusunu ve hissini belirler."
            >
              <div className="grid grid-cols-2 gap-2.5">
                {MATERIALS.map((m) => (
                  <SelectableCard
                    key={m.id}
                    selected={material === m.id}
                    onClick={() => setMaterial(m.id)}
                  >
                    <div
                      className="w-full h-14 rounded-lg mb-2.5 ring-1 ring-black/[0.06]"
                      style={{ background: m.swatch }}
                    />
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">{m.name}</div>
                        <div className="text-[13px] text-gri-700 mt-0.5">
                          {m.desc}
                        </div>
                      </div>
                      <Icon.Info size={14} className="text-gri-500 shrink-0 mt-0.5" />
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step 2 — Kaplama */}
            <FormSection
              number={2}
              title="Kaplama"
              hint="Yüzey parlaklığı ve dokunsal his."
            >
              <div className="grid grid-cols-2 gap-2.5">
                {COATINGS.map((c) => (
                  <SelectableCard
                    key={c.id}
                    selected={coating === c.id}
                    onClick={() => setCoating(c.id)}
                    padding={12}
                  >
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-[13px] text-gri-700 mt-0.5">
                      {c.desc}
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step 3 — Özelleştirme */}
            <FormSection
              number={3}
              title="Özelleştirme"
              hint="Premium dokunuş — her adetin değil."
            >
              <div className="grid grid-cols-2 gap-2.5">
                {CUSTOMS.map((c) => (
                  <SelectableCard
                    key={c.id}
                    selected={custom === c.id}
                    onClick={() => setCustom(c.id)}
                    padding={12}
                  >
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-[13px] text-gri-700 mt-0.5">
                      {c.desc}
                    </div>
                  </SelectableCard>
                ))}
              </div>

              {custom === "yaldiz" && (
                <div className="mt-3 p-3.5 rounded-xl bg-gri-50 ring-1 ring-gri-200">
                  <div className="text-[13px] font-semibold mb-2.5">
                    Yaldız rengi
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {YALDIZLAR.map((y) => (
                      <button
                        key={y.id}
                        type="button"
                        onClick={() => setYaldiz(y.id)}
                        aria-label={`Yaldız: ${y.id}`}
                        aria-pressed={yaldiz === y.id}
                        className="w-full aspect-square rounded-lg relative transition-shadow"
                        style={{
                          background: y.c,
                          boxShadow:
                            yaldiz === y.id
                              ? "0 0 0 3px var(--color-pim-mercan), 0 0 0 5px white"
                              : "inset 0 0 0 1px rgba(31,41,55,0.1)",
                        }}
                      >
                        {yaldiz === y.id && (
                          <span
                            aria-hidden
                            className="absolute inset-0 grid place-items-center text-white"
                            style={{
                              filter:
                                "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
                            }}
                          >
                            <Icon.Check size={14} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </FormSection>

            {/* Step 4 — Sarım yönü */}
            <FormSection
              number={4}
              title="Sarım yönü"
              hint="Otomatik etiketleme makinesi varsa önemli. R harfi etiketin baskı yönünü temsil eder."
            >
              {/* DIŞA SARIM */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="flex items-center gap-2.5 mb-2.5 w-full">
                  <span className="text-[11.5px] font-bold tracking-[0.1em] text-lacivert">
                    DIŞA SARIM
                  </span>
                  <span aria-hidden className="flex-1 h-px bg-gri-200" />
                </legend>
                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {[1, 2, 3, 4].map((n) => (
                    <SelectableCard
                      key={n}
                      selected={winding === n}
                      onClick={() => setWinding(n)}
                      padding={10}
                      style={{ textAlign: "center", paddingTop: 12 }}
                      aria-label={`Dışa sarım yön ${n}`}
                    >
                      <WindingIcon n={n} />
                      <div
                        className="text-[11.5px] font-bold tracking-[0.1em] mt-2"
                        style={{
                          color:
                            winding === n
                              ? "var(--color-pim-mercan)"
                              : "var(--color-gri-700)",
                        }}
                      >
                        SARIM {n}
                      </div>
                    </SelectableCard>
                  ))}
                </div>
              </fieldset>

              {/* İÇE SARIM */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="flex items-center gap-2.5 mb-2.5 w-full">
                  <span className="text-[11.5px] font-bold tracking-[0.1em] text-lacivert">
                    İÇE SARIM
                  </span>
                  <span aria-hidden className="flex-1 h-px bg-gri-200" />
                </legend>
                <div className="grid grid-cols-4 gap-2.5">
                  {[5, 6, 7, 8].map((n) => (
                    <SelectableCard
                      key={n}
                      selected={winding === n}
                      onClick={() => setWinding(n)}
                      padding={10}
                      style={{ textAlign: "center", paddingTop: 12 }}
                      aria-label={`İçe sarım yön ${n}`}
                    >
                      <WindingIcon n={n} />
                      <div
                        className="text-[11.5px] font-bold tracking-[0.1em] mt-2"
                        style={{
                          color:
                            winding === n
                              ? "var(--color-pim-mercan)"
                              : "var(--color-gri-700)",
                        }}
                      >
                        SARIM {n}
                      </div>
                    </SelectableCard>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-start gap-2 mt-3.5 px-3 py-2.5 rounded-lg bg-gri-50 text-[13px] text-gri-700">
                <Icon.Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  Emin değilsen{" "}
                  <strong className="text-lacivert">Sarım 1</strong>&rsquo;i
                  seç — en yaygın kullanılan yön. Pim sana yardım edebilir.
                </span>
              </div>
            </FormSection>

            {/* Step 5 — Adet ve ölçü */}
            <FormSection
              number={5}
              title="Adet ve ölçü"
              hint="Slider'ı kaydırdıkça fiyat anında değişir."
            >
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-[13px] font-semibold">Adet</span>
                  <span className="text-[22px] font-bold">
                    {fmt(qty)}{" "}
                    <span className="text-[13px] font-normal text-gri-700">
                      adet
                    </span>
                  </span>
                </div>
                <QtySlider
                  value={qty}
                  min={1000}
                  max={50000}
                  step={1000}
                  onChange={setQty}
                />
                <div className="flex justify-between mt-1.5">
                  {[1000, 5000, 10000, 20000, 50000].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQty(t)}
                      className="text-[13px] text-gri-500 hover:text-pim-mercan p-0 font-medium"
                    >
                      {`${t / 1000}K`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Genişlik (mm)
                  </span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) || 0)}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Yükseklik (mm)
                  </span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value) || 0)}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow"
                  />
                </label>
              </div>
            </FormSection>

            {/* Price card */}
            <PriceCard
              variant="quiet"
              topLabel="TOPLAM"
              total={total}
              unitPrice={
                <>
                  Birim fiyat{" "}
                  <strong className="text-lacivert">
                    {fmtUnit(unit)} TL/adet
                  </strong>{" "}
                  · KDV dahil
                  {rollsNeeded > 0 && (
                    <>
                      {" "}
                      <span className="text-gri-500">
                        · {rollsNeeded} rulo
                      </span>
                    </>
                  )}
                </>
              }
              savingsLabel={
                tierSavings > 0 ? `%${tierSavings} adet indirimi` : null
              }
              upsell={
                upsell
                  ? { msg: upsell.msg, onClick: () => setQty(upsell.to) }
                  : null
              }
              deliveryDate={teslim}
              ctaLabel="Sepete ekle"
              onCta={() =>
                toast.success(
                  "Sepete eklendi (mock — gerçek sepet F+I adımında)"
                )
              }
              footnote="Cüzdandan ödeyince +%2 indirim · 3 gün içinde dosya yükleyebilirsin · KDV dahil"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// WindingIcon — sarım yönü 8 varyantı
// ============================================================

function WindingIcon({ n }: { n: number }) {
  const rotMap: Record<number, number> = {
    1: 0,
    2: 180,
    3: 90,
    4: -90,
    5: 0,
    6: 180,
    7: 90,
    8: -90,
  };
  const isInner = n >= 5;
  const rot = rotMap[n];

  const stripX = 28;
  const stripW = 44;
  const labelH = 22;
  const stripTop = 30;
  const cells = 4;

  const rollCx = 50;
  const rollCy = 22;
  const rollRx = 32;
  const rollRy = 8;

  return (
    <svg
      width="80"
      height="120"
      viewBox="0 0 100 140"
      className="mx-auto block"
      aria-hidden
    >
      <defs>
        <linearGradient id={`roll-grad-${n}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E7E5DD" />
        </linearGradient>
      </defs>

      {isInner && (
        <rect
          x={stripX}
          y={rollCy}
          width={stripW}
          height={stripTop + cells * labelH - rollCy + 4}
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="1.4"
        />
      )}

      <g>
        <ellipse
          cx={rollCx}
          cy={rollCy - 7}
          rx={rollRx}
          ry={rollRy}
          fill={`url(#roll-grad-${n})`}
          stroke="#1F2937"
          strokeWidth="1.4"
        />
        <rect
          x={rollCx - rollRx}
          y={rollCy - 7}
          width={rollRx * 2}
          height="9"
          fill={`url(#roll-grad-${n})`}
        />
        <line
          x1={rollCx - rollRx}
          y1={rollCy - 7}
          x2={rollCx - rollRx}
          y2={rollCy + 2}
          stroke="#1F2937"
          strokeWidth="1.4"
        />
        <line
          x1={rollCx + rollRx}
          y1={rollCy - 7}
          x2={rollCx + rollRx}
          y2={rollCy + 2}
          stroke="#1F2937"
          strokeWidth="1.4"
        />
        <ellipse
          cx={rollCx}
          cy={rollCy + 2}
          rx={rollRx}
          ry={rollRy}
          fill={`url(#roll-grad-${n})`}
          stroke="#1F2937"
          strokeWidth="1.4"
        />
        <ellipse cx={rollCx} cy={rollCy + 2} rx="8" ry="2" fill="#1F2937" opacity="0.6" />
      </g>

      {!isInner && (
        <g>
          <path
            d={`M ${stripX} ${rollCy + 2} Q ${stripX} ${stripTop - 4} ${stripX} ${stripTop} L ${stripX + stripW} ${stripTop} Q ${stripX + stripW} ${stripTop - 4} ${stripX + stripW} ${rollCy + 2}`}
            fill="#FFFFFF"
            stroke="#1F2937"
            strokeWidth="1.4"
          />
          <rect
            x={stripX}
            y={stripTop}
            width={stripW}
            height={cells * labelH}
            fill="#FFFFFF"
            stroke="#1F2937"
            strokeWidth="1.4"
          />
        </g>
      )}

      {[1, 2, 3].map((i) => (
        <line
          key={i}
          x1={stripX}
          y1={stripTop + i * labelH}
          x2={stripX + stripW}
          y2={stripTop + i * labelH}
          stroke="#1F2937"
          strokeWidth="0.8"
          opacity="0.4"
        />
      ))}

      {[0, 1, 2, 3].map((i) => {
        const cx = stripX + stripW / 2;
        const cy = stripTop + i * labelH + labelH / 2;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
            <text
              x="0"
              y="6"
              textAnchor="middle"
              fontFamily="Nunito, sans-serif"
              fontWeight="800"
              fontSize="17"
              fill="#1F2937"
            >
              R
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// PreviewCanvas — 3D-ish rulo + canlı sample label
// ============================================================

interface PreviewCanvasProps {
  material: MaterialId;
  coating: CoatingId;
  custom: CustomId;
  yaldiz: YaldizId;
  width: number;
  height: number;
}

const MAT_BG: Record<MaterialId, string> = {
  kraft: "linear-gradient(180deg, #D9B889 0%, #C9A472 100%)",
  beyaz: "linear-gradient(180deg, #FCFCF8 0%, #F0EFE8 100%)",
  ultra:
    "linear-gradient(180deg, rgba(220,240,250,0.6) 0%, rgba(255,255,255,0.4) 100%)",
  metalik:
    "linear-gradient(180deg, #E5E9EE 0%, #B7BFC9 50%, #DDE2E8 100%)",
};

const SHEEN: Record<CoatingId, number> = {
  mat: 0.04,
  parlak: 0.32,
  soft: 0.06,
  yok: 0.16,
};

const YALDIZ_GRAD: Record<YaldizId, string> = {
  altin: "linear-gradient(135deg,#FFE08A 0%, #C99A3D 100%)",
  gulkurusu: "linear-gradient(135deg,#FFD3CB 0%, #C97862 100%)",
  gumus: "linear-gradient(135deg,#E5E9EE 0%, #9BA4AD 100%)",
  bakir: "linear-gradient(135deg,#F0B17A 0%, #A65A2C 100%)",
  siyahkrom: "linear-gradient(135deg,#4A4F55 0%, #11141A 100%)",
  yesil: "linear-gradient(135deg,#D6F0D0 0%, #2F6B2F 100%)",
  lacivert: "linear-gradient(135deg,#7B92C6 0%, #1F2A4D 100%)",
  holo:
    "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
};

function PreviewCanvas({
  material,
  coating,
  custom,
  yaldiz,
  width,
  height,
}: PreviewCanvasProps) {
  const matBg = MAT_BG[material];
  const sheen = SHEEN[coating];
  const yaldizGrad = YALDIZ_GRAD[yaldiz];

  const labelBg =
    material === "ultra"
      ? "rgba(255,255,255,0.5)"
      : material === "metalik"
        ? "linear-gradient(135deg,#E5E9EE,#FFFFFF,#C7CFD8)"
        : material === "kraft"
          ? "#E8C99B"
          : "white";

  const fontSize = Math.min(width, height) * 0.22;

  return (
    <div
      className="relative rounded-2xl p-12 min-h-[540px] overflow-hidden shadow-1 ring-1 ring-gri-200"
      style={{
        background: "linear-gradient(180deg, var(--color-krem) 0%, #EFE3CB 100%)",
      }}
    >
      {/* Radial highlight */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 20%, rgba(255,255,255,0.6) 0%, transparent 70%)",
        }}
      />

      {/* The rulo */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative"
          style={{
            width: 360,
            height: 200,
            transformStyle: "preserve-3d",
            transform: "rotateX(12deg)",
          }}
        >
          {/* Body */}
          <div
            className="absolute inset-0"
            style={{
              background: matBg,
              borderRadius: "180px / 100px",
              boxShadow:
                "0 30px 60px rgba(31,41,55,0.18), 0 6px 12px rgba(31,41,55,0.1)",
            }}
          />
          {/* Sheen overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(80% 40% at 50% 0%, rgba(255,255,255,${sheen + 0.3}) 0%, transparent 60%)`,
              borderRadius: "180px / 100px",
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(255,255,255,${sheen}) 0%, transparent 30%, transparent 70%, rgba(31,41,55,0.18) 100%)`,
              borderRadius: "180px / 100px",
            }}
          />
          {/* Core hole */}
          <div className="absolute left-0 right-0 top-[50px] h-20 flex justify-between">
            <div
              className="w-[60px] h-[80px] -ml-2.5"
              style={{
                background:
                  "radial-gradient(ellipse, #1F2937 0%, #4B5563 100%)",
                borderRadius: "50%",
              }}
            />
            <div
              className="w-[60px] h-[80px] -mr-2.5"
              style={{
                background:
                  "radial-gradient(ellipse, #1F2937 0%, #4B5563 100%)",
                borderRadius: "50%",
              }}
            />
          </div>

          {/* Sample label */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center overflow-hidden"
            style={{
              width: width * 1.4,
              height: height * 1.4,
              background: labelBg,
              borderRadius: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              border:
                material === "ultra"
                  ? "1px dashed rgba(31,41,55,0.4)"
                  : "none",
            }}
          >
            <div className="text-center px-1">
              <div
                style={{
                  fontWeight: 800,
                  fontSize,
                  background:
                    custom === "yaldiz" ? yaldizGrad : "transparent",
                  color:
                    custom === "yaldiz"
                      ? "transparent"
                      : "#1F2937",
                  WebkitBackgroundClip:
                    custom === "yaldiz" ? "text" : "initial",
                  backgroundClip: custom === "yaldiz" ? "text" : "initial",
                  letterSpacing: "0.05em",
                  textShadow:
                    custom === "emboss"
                      ? "0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(0,0,0,0.15)"
                      : "none",
                  filter: custom === "spotuv" ? "contrast(1.2)" : "none",
                }}
              >
                OLEA
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "#FF6B5B",
                  fontWeight: 600,
                  marginTop: 2,
                  letterSpacing: "0.1em",
                }}
              >
                DOĞAL SABUN
              </div>
              <div
                style={{
                  height: 1,
                  background: "rgba(31,41,55,0.2)",
                  margin: "6px 12px",
                }}
              />
              <div style={{ fontSize: 7, color: "#4B5563" }}>100ml</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dimension overlay */}
      <div className="absolute bottom-6 left-6 px-3 py-2 bg-white rounded-lg shadow-1 flex items-center gap-3">
        <div className="text-sm">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            ÖLÇÜ
          </div>
          <div className="font-semibold">
            {width} × {height} mm
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-6 left-6 px-3 py-1.5 bg-white rounded-full shadow-1 flex items-center gap-1.5 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-yesil" />
        Canlı önizleme
      </div>

      {/* Pim chat trigger */}
      <div className="absolute bottom-6 right-6">
        <div className="bg-white rounded-2xl p-3 shadow-2 flex gap-2.5 items-center max-w-[220px]">
          <PimMini pose="think" size={36} />
          <div className="text-[13px] font-medium">
            <strong>Pim:</strong> Kozmetik için ultra clear de güzel olur,
            denedin mi?
          </div>
        </div>
      </div>
    </div>
  );
}
