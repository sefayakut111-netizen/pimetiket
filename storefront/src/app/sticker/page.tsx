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
import { useState } from "react";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { FormSection, SelectableCard, PriceCard, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { deliveryEstimate } from "@/lib/pricing";

// ============================================================
// Configuration data
// ============================================================

const SHAPES = [
  { id: "circle", name: "Yuvarlak" },
  { id: "square", name: "Kare" },
  { id: "rounded", name: "Yumuşak köşe" },
  { id: "die", name: "Kontur kesim" },
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
    desc: "Festival için",
    swatch:
      "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
  },
  { id: "kraft", name: "Kraft", desc: "Doğal, mat", swatch: "#C9A47A" },
] as const;

type MaterialId = (typeof MATERIALS)[number]["id"];

const FINISHES = [
  { id: "parlak", name: "Parlak", desc: "Canlı renkler" },
  { id: "mat", name: "Mat", desc: "Yansımasız" },
  { id: "glitter", name: "Simli", desc: "Parıltı katmanı" },
] as const;

type FinishId = (typeof FINISHES)[number]["id"];

const TIERS = [50, 100, 250, 500, 1000, 2500] as const;
const SIZES = [50, 75, 100, 150] as const;

// ============================================================
// Pricing
// ============================================================

const MAT_MULT: Record<MaterialId, number> = {
  vinil: 1,
  transparan: 1.1,
  holo: 1.4,
  kraft: 0.95,
};
const FIN_MULT: Record<FinishId, number> = {
  parlak: 1,
  mat: 1.05,
  glitter: 1.25,
};

function tierBase(
  q: number,
  material: MaterialId,
  finish: FinishId,
  size: number
) {
  const u =
    q <= 50
      ? 7.0
      : q <= 100
        ? 5.5
        : q <= 250
          ? 4.2
          : q <= 500
            ? 3.5
            : q <= 1000
              ? 2.9
              : 2.4;
  const sizeMult = (size / 75) ** 1.4;
  return u * MAT_MULT[material] * FIN_MULT[finish] * sizeMult;
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

export default function StickerPage() {
  const toast = useToast();
  const [shape, setShape] = useState<ShapeId>("circle");
  const [material, setMaterial] = useState<MaterialId>("vinil");
  const [finish, setFinish] = useState<FinishId>("parlak");
  const [tier, setTier] = useState<number>(250);
  const [size, setSize] = useState<number>(75);

  const baseUnit = tierBase(50, material, finish, size);
  const currentUnit = tierBase(tier, material, finish, size);
  const total = currentUnit * tier;
  const savings = Math.round((1 - currentUnit / baseUnit) * 100);

  return (
    <main
      className="animate-fade-up min-h-[calc(100vh-64px)]"
      style={{
        background:
          "linear-gradient(180deg, #FFF6F2 0%, #FFFFFF 30%, #FFFFFF 100%)",
      }}
    >
      {/* Breadcrumb */}
      <div className="border-b border-gri-200 bg-white/80">
        <div className="mx-auto max-w-[1280px] px-8 py-4 flex items-center gap-2 text-[14px]">
          <Link
            href="/"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            Anasayfa
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">Sticker konfigüre et</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-8 py-8 pb-20">
        {/* Page hero */}
        <div className="flex items-end gap-4 mb-7">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-turuncu text-white text-[12.5px] font-semibold mb-2.5">
              <Icon.Sparkle size={12} /> 25 adetten başlar
            </span>
            <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
              Sticker&rsquo;ını konfigüre et
            </h1>
            <p className="mt-2 text-base text-gri-700 max-w-[480px] leading-relaxed">
              Kampanya, hediye, kişisel — sticker küçük adette de tadından
              yenmiyor.
            </p>
          </div>
          <Pim pose="excited" size={120} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 items-start">
          {/* LEFT — sticky preview */}
          <div className="lg:sticky lg:top-20">
            <StickerPreview
              shape={shape}
              material={material}
              finish={finish}
              size={size}
            />
            <div className="text-[13px] text-gri-700 text-center mt-3">
              Anlık önizleme — her seçim canlı
            </div>
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-4">
            <FormSection title="Şekil">
              <div className="grid grid-cols-4 gap-2.5">
                {SHAPES.map((s) => (
                  <SelectableCard
                    key={s.id}
                    selected={shape === s.id}
                    onClick={() => setShape(s.id)}
                    style={{ textAlign: "center" }}
                  >
                    <ShapeIcon id={s.id} active={shape === s.id} />
                    <div className="text-[11.5px] font-bold tracking-[0.04em] text-gri-700 mt-2">
                      {s.name}
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title="Malzeme">
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

            <FormSection title="Yüzey">
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

            <FormSection title="Boyut">
              <div className="grid grid-cols-4 gap-3">
                {SIZES.map((s) => (
                  <SelectableCard
                    key={s}
                    selected={size === s}
                    onClick={() => setSize(s)}
                    style={{ textAlign: "center" }}
                  >
                    <div
                      className="mx-auto mb-2"
                      style={{
                        width: Math.min(s * 0.4, 60),
                        height: Math.min(s * 0.4, 60),
                        borderRadius: shape === "circle" ? "50%" : 8,
                        background: "var(--color-pim-mercan-tint)",
                        border: "1.5px dashed var(--color-pim-mercan-soft)",
                      }}
                    />
                    <div className="text-[13px] font-semibold">{s} mm</div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection title="Adet — kademen, fiyatın">
              <div className="grid grid-cols-3 gap-3">
                {TIERS.map((q) => {
                  const u = tierBase(q, material, finish, size);
                  const t = u * q;
                  const sav = Math.round((1 - u / baseUnit) * 100);
                  const popular = q === 250;
                  const selected = tier === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setTier(q)}
                      aria-pressed={selected}
                      className={cn(
                        "relative px-4 py-5 rounded-[14px] text-left cursor-pointer",
                        "transition-[transform,box-shadow,background] duration-200",
                        selected
                          ? "bg-krem ring-2 ring-pim-mercan -translate-y-0.5 shadow-mercan-lg"
                          : "bg-white ring-2 ring-gri-200 hover:ring-pim-mercan-soft"
                      )}
                    >
                      {popular && !selected && (
                        <span className="absolute -top-2.5 left-4 inline-flex items-center h-[22px] px-2.5 rounded-full bg-lacivert text-white text-[11px] font-semibold">
                          Popüler
                        </span>
                      )}
                      {selected && (
                        <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 h-[22px] px-2.5 rounded-full bg-pim-mercan text-white text-[11px] font-semibold">
                          <Icon.Check size={10} /> Seçildi
                        </span>
                      )}
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                        ADET
                      </div>
                      <div className="text-[28px] font-bold leading-none">
                        {q}
                      </div>
                      <div className="text-[22px] font-bold mt-3.5 text-lacivert">
                        {fmt(t)} TL
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5">
                        {fmtUnit(u)} TL/adet
                      </div>
                      {sav > 0 && (
                        <div className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[11px] font-semibold mt-2.5">
                          %{sav} tasarruf 🎯
                        </div>
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
              unitPrice={`${tier} adet × ${fmtUnit(currentUnit)} TL · KDV dahil`}
              savingsLabel={savings > 0 ? `%${savings} adet indirimi` : null}
              deliveryDate={deliveryEstimate({ kind: "sticker", qty: tier })}
              ctaLabel="Sepete ekle"
              onCta={() =>
                toast.success(
                  "Sepete eklendi (mock — gerçek sepet F+I adımında)"
                )
              }
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

function ShapeIcon({ id, active }: { id: ShapeId; active: boolean }) {
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
  if (id === "rounded")
    return (
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="mx-auto"
        aria-hidden
      >
        <rect x="4" y="4" width="28" height="28" rx="8" fill={fill} stroke={stroke} strokeWidth="2" />
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

// ============================================================
// StickerPreview
// ============================================================

interface PreviewProps {
  shape: ShapeId;
  material: MaterialId;
  finish: FinishId;
  size: number;
}

function StickerPreview({ shape, material, finish, size }: PreviewProps) {
  const matBg: Record<MaterialId, string> = {
    vinil: "white",
    transparan: "rgba(255,255,255,0.5)",
    holo:
      "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 35%, #FFE8B7 65%, #B7FFD9 100%)",
    kraft: "#D9B889",
  };

  const finishOverlay: Record<FinishId, string> = {
    parlak:
      "radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,0.7) 0%, transparent 60%)",
    mat: "transparent",
    glitter: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1.5px)",
  };

  const radius =
    shape === "circle" ? "50%" : shape === "rounded" ? 24 : shape === "die" ? 0 : 4;
  const dieClip =
    shape === "die"
      ? "polygon(20% 0, 80% 5%, 100% 30%, 95% 75%, 70% 100%, 25% 95%, 0 65%, 5% 25%)"
      : "none";

  const px = size * 2.4;

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
        <div
          className="relative grid place-items-center p-1"
          style={{
            width: px,
            height: px,
            background: matBg[material],
            borderRadius: radius,
            clipPath: dieClip,
            boxShadow:
              "0 16px 40px rgba(31,41,55,0.18), 0 4px 8px rgba(31,41,55,0.1)",
          }}
        >
          <div
            className="grid place-items-center"
            style={{
              width: "94%",
              height: "94%",
              borderRadius:
                shape === "circle"
                  ? "50%"
                  : shape === "rounded"
                    ? 20
                    : 0,
              background:
                material === "transparan"
                  ? "transparent"
                  : material === "holo"
                    ? "rgba(255,255,255,0.2)"
                    : "transparent",
              border:
                material === "transparan"
                  ? "2px dashed rgba(31,41,55,0.3)"
                  : "none",
            }}
          >
            <div className="text-center">
              <div
                style={{
                  fontSize: px * 0.16,
                  fontWeight: 800,
                  color: "#FF6B5B",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                PİM
              </div>
              <div
                style={{
                  fontSize: px * 0.07,
                  fontWeight: 700,
                  color: "#1F2937",
                  marginTop: 8,
                  letterSpacing: "0.15em",
                }}
              >
                2026
              </div>
            </div>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: finishOverlay[finish],
              backgroundSize: finish === "glitter" ? "8px 8px" : "auto",
              borderRadius: radius,
              clipPath: dieClip,
              mixBlendMode: "screen",
              opacity: finish === "mat" ? 0 : 1,
            }}
          />
        </div>
      </div>

      {/* Size badge */}
      <div className="absolute bottom-5 left-5 px-3 py-2 bg-white rounded-lg shadow-1">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
          BOYUT
        </div>
        <div className="font-semibold text-sm">
          {size} × {size} mm
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
