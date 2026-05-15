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
import { useCallback, useEffect, useRef, useState } from "react";
// Pim mascot import edilmiyor — UX audit (15 May): inline avatar kart
// kaldırıldı, Pim sadece PimChat floating button'da tek tutarlı persona.
import { Icon } from "@/components/Icon";
import {
  SchemaJsonLd,
  productSchema,
  breadcrumbSchema,
} from "@/components/SchemaJsonLd";
import {
  FormSection,
  SelectableCard,
  PriceCard,
  Pill,
  QtySlider,
  DesignDropZone,
  type DesignTempState,
} from "@/components/ui";
import { deliveryEstimate } from "@/lib/pricing";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import {
  quoteCustomerEtiket,
  computeEtiketTierSavings,
  CUSTOMER_ETIKET_TIERS,
  ETIKET_MIN_QTY,
  ETIKET_MAX_QTY,
  ETIKET_QTY_STEP,
  type EtiketMaterialId,
  type EtiketCoatingId,
  type EtiketCustomId,
} from "@/lib/etiket-customer-pricing";
import { addToCustomerCart } from "@/lib/customer-cart";
import { ProductReviews } from "@/components/reviews/ProductReviews";

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
  { id: "yok", name: "Özelleştirme yok", desc: "Sade baskı (emboss/yaldız/spot UV yok)" },
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

/** Etiket preset chip'leri */
const ETIKET_PRESETS = CUSTOMER_ETIKET_TIERS; // [1K, 2K, 5K, 10K, 20K, 50K]
const ETIKET_POPULAR_PRESET = 5000;

/** Qty'i step'e snap'le (500'ün katı), min/max'a clamp et */
function snapEtiketQty(n: number): number {
  if (!Number.isFinite(n)) return ETIKET_MIN_QTY;
  const stepped = Math.round(n / ETIKET_QTY_STEP) * ETIKET_QTY_STEP;
  return Math.min(ETIKET_MAX_QTY, Math.max(ETIKET_MIN_QTY, stepped));
}

function upsellFor(qty: number): { msg: string; to: number } | null {
  if (qty < 2000) return { msg: "+1000 adet ekle, %4 daha tasarruf", to: 2000 };
  if (qty < 5000) return { msg: "5000'e çık, %6 daha tasarruf", to: 5000 };
  if (qty < 10000) return { msg: "10000'e çık, %6 daha tasarruf", to: 10000 };
  if (qty < 20000) return { msg: "20000'e çık, %7 daha tasarruf", to: 20000 };
  return null;
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
/**
 * Birim fiyat formatlama — smart precision.
 *
 * Audit 15 May (Sefa raporu): "2,32 TL/adet × 2.000 = 4.640 TL ama
 * gösterilen 4.631 TL → 9 TL diskrepans". Kök: birim fiyat aslında
 * 2,3155 ama toFixed(2) ile 2,32'ye yuvarlanıyor → müşteri matematiği
 * tutturamıyor → güven kaybı.
 *
 * Çözüm: 2 ondalık matematik tutturuyorsa 2 göster (örn 2,50 exact),
 * yoksa 4 ondalık göster (örn 2,3155). Müşteri kalkulatöre vurunca
 * unit × qty = total tam tutar.
 */
const fmtUnit = (n: number) => {
  const twoDecimal = Math.round(n * 100) / 100;
  if (Math.abs(twoDecimal - n) < 0.0005) {
    return n.toFixed(2).replace(".", ",");
  }
  return n.toFixed(4).replace(".", ",");
};

// ============================================================
// Page
// ============================================================

export default function EtiketPage() {
  const toast = useToast();
  const { t } = useT();
  const [material, setMaterial] = useState<EtiketMaterialId>("kraft");
  const [coating, setCoating] = useState<EtiketCoatingId>("mat");
  const [custom, setCustom] = useState<EtiketCustomId>("yok");
  const [yaldiz, setYaldiz] = useState<YaldizId>("altin");
  const [winding, setWinding] = useState<number>(1);
  const [qty, setQty] = useState<number>(2000);
  const [width, setWidth] = useState<number>(60);
  const [height, setHeight] = useState<number>(80);
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
        toast.info("Tasarımın hazır — malzeme/adet seç, sepete ekle");
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Tier savings — 1K (min) baseline ile karşılaştır
  const tierSavings = quote.ok
    ? computeEtiketTierSavings({ width, height, material, coating, customization: custom }, ETIKET_MIN_QTY, qty)
    : 0;

  const teslim = deliveryEstimate({ kind: "etiket", qty });
  const upsell = upsellFor(qty);

  // Sticky CTA bar — UX audit (15 May): PriceCard sayfa sonunda, mobile'da
  // form uzun olduğu için kullanıcı CTA'ya scroll etmek zorunda. Intersection
  // observer ile PriceCard görünür durumda mı tespit et; görünmüyorsa
  // ekran altında küçük yapışkan bar göster (mobile-only).
  const priceCardRef = useRef<HTMLDivElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const el = priceCardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Sepete ekle — hem PriceCard hem sticky bar tetikler. Stale-closure'a
  // karşı useCallback + dep array. quote/qty/material vb. her güncellemede
  // yeni handler oluşur.
  const handleAddToCart = useCallback(async () => {
    if (!quote.ok) {
      toast.error(quote.reason ?? "Geçersiz seçim");
      return;
    }
    const matName =
      MATERIALS.find((m) => m.id === material)?.name ?? material;
    const coatName =
      COATINGS.find((c) => c.id === coating)?.name ?? coating;
    const custName =
      CUSTOMS.find((c) => c.id === custom)?.name ?? custom;
    const customSuffix = custom === "yaldiz" ? ` (${yaldiz})` : "";
    const result = await addToCustomerCart({
      product: "etiket",
      title: `Etiket · ${matName} + ${coatName}`,
      config: `${width}×${height}mm · ${qty.toLocaleString("tr-TR")} adet · ${custName}${customSuffix} · Sarım ${winding}`,
      width,
      height,
      qty,
      unit: parseFloat(unit.toFixed(2)),
      total: Math.round(total),
      materialId: material,
      coatingId: coating,
      customizationId: custom,
      winding,
      designTempId: design?.tempId,
      designPreviewUrl: design?.previewUrl,
      designFileName: design?.fileName,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setDesign(null);
    toast.success(
      design
        ? "Sepete eklendi 🛒 — tasarımın bağlandı"
        : "Sepete eklendi 🛒 — sepete gitmek için üst menü"
    );
  }, [
    quote,
    toast,
    material,
    coating,
    custom,
    yaldiz,
    width,
    height,
    qty,
    unit,
    total,
    winding,
    design,
  ]);

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] animate-fade-up">
      <SchemaJsonLd
        data={[
          productSchema({
            name: "Rulodan etiket — özel baskı",
            description:
              "Kozmetik, gıda, içecek, parfüm etiketleri. Vinil/kuşe/transparent. AI dosya kontrolü ile 8-12 iş günü teslim. 1.000 adetten başlar.",
            category: "Etiket / Label",
            priceFrom: 850,
          }),
          breadcrumbSchema([
            { label: "Anasayfa", url: "/" },
            { label: "Etiket", url: "/etiket" },
          ]),
        ]}
      />
      {/* Breadcrumb */}
      <div className="border-b border-gri-200 bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-3 md:py-4 flex items-center gap-2 text-[13px] md:text-[14px]">
          <Link
            href="/"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert transition-colors"
          >
            {t.nav.home}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold truncate">
            {t.nav.etiket} {t.config.breadcrumb}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-start">
          {/* LEFT — sticky preview */}
          <div className="lg:sticky lg:top-20">
            <PreviewCanvas
              material={material}
              coating={coating}
              custom={custom}
              yaldiz={yaldiz}
              width={width}
              height={height}
              designUrl={design?.previewUrl ?? null}
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
            {/* Design upload zone */}
            <div className="mt-4">
              <DesignDropZone value={design} onChange={setDesign} />
            </div>
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-[24px] md:text-[40px] font-semibold tracking-tight leading-tight">
                {t.etiket.pageTitle}
              </h1>
              <p className="mt-2 text-[14px] md:text-base text-gri-700">
                {t.etiket.pageSubtitle}
              </p>
            </div>

            {/* Step 1 — Malzeme */}
            <FormSection
              number={1}
              title={t.config.materialTitle}
              hint=""
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
              <a
                href="/malzemeler#etiket-malzemeleri"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2.5 text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                Malzeme detayları
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </a>
            </FormSection>

            {/* Step 2 — Kaplama */}
            <FormSection
              number={2}
              title={t.config.coatingTitle}
              hint=""
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
              title={t.config.customizationTitle}
              hint=""
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
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
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
              title={t.etiket.windingTitle}
              hint={t.etiket.windingHint}
            >
              {/* DIŞA SARIM */}
              <fieldset className="border-0 p-0 m-0">
                <legend className="flex items-center gap-2.5 mb-2.5 w-full">
                  <span className="text-[11.5px] font-bold tracking-[0.1em] text-lacivert">
                    {t.etiket.windingOuter}
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
                    {t.etiket.windingInner}
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

            {/* Step 5 — Boyut */}
            <FormSection
              number={5}
              title={t.config.sizeTitle}
              hint={t.etiket.sizeHint}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    Genişlik (mm)
                  </span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) =>
                      setWidth(Math.max(5, Number(e.target.value) || 5))
                    }
                    min={5}
                    max={520}
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
                    onChange={(e) =>
                      setHeight(Math.max(5, Number(e.target.value) || 5))
                    }
                    min={5}
                    max={1470}
                    step={1}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow tabular-nums"
                  />
                </label>
              </div>

              {/* Hızlı boyut chip'leri */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-[11.5px] text-gri-500 self-center mr-1">
                  {t.config.quickSize}
                </span>
                {[
                  { w: 30, h: 40, label: "30×40" },
                  { w: 40, h: 40, label: "40×40" },
                  { w: 60, h: 80, label: "60×80" },
                  { w: 70, h: 100, label: "70×100" },
                  { w: 100, h: 50, label: "100×50" },
                ].map((preset) => {
                  const active =
                    width === preset.w && height === preset.h;
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
            </FormSection>

            {/* Step 6 — Adet (serbest input + preset chip'ler) */}
            <FormSection
              number={6}
              title={t.config.qtyTitle}
              hint={t.etiket.qtyHint}
            >
              {/* Slider — ana giriş yöntemi */}
              <div className="px-1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[28px] font-bold text-lacivert tabular-nums leading-none">
                    {qty.toLocaleString("tr-TR")}
                    <span className="text-[14px] font-medium text-gri-700 ml-1">
                      adet
                    </span>
                  </span>
                  <div className="text-right tabular-nums">
                    <div className="text-[18px] font-bold text-pim-mercan leading-none">
                      {fmt(total)} TL
                    </div>
                    <div className="text-[12px] text-gri-500 mt-0.5">
                      {fmtUnit(unit)} TL/adet
                    </div>
                  </div>
                </div>
                <QtySlider
                  value={qty}
                  min={ETIKET_MIN_QTY}
                  max={ETIKET_MAX_QTY}
                  step={ETIKET_QTY_STEP}
                  onChange={(v) => setQty(snapEtiketQty(v))}
                  ariaLabel="Etiket adedi (slider)"
                />
                <div className="flex justify-between text-[10.5px] text-gri-500 mt-1.5 tabular-nums">
                  <span>{(ETIKET_MIN_QTY / 1000).toFixed(0)}K</span>
                  <span>{(ETIKET_MAX_QTY / 1000).toFixed(0)}K</span>
                </div>
                {tierSavings > 0 && (
                  <div className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold mt-2">
                    %{tierSavings} tasarruf 🎯 — bir önceki tier'dan ucuz
                  </div>
                )}
              </div>

              {/* İnce ayar: stepper + serbest input */}
              <div className="flex items-center gap-3 flex-wrap mt-4">
                <span className="text-[11.5px] text-gri-500">İnce ayar:</span>
                <div className="inline-flex items-stretch rounded-full ring-1 ring-gri-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty((v) => snapEtiketQty(v - ETIKET_QTY_STEP))}
                    disabled={qty <= ETIKET_MIN_QTY}
                    aria-label={`${ETIKET_QTY_STEP} adet azalt`}
                    className="w-11 h-11 md:w-9 md:h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(snapEtiketQty(Number(e.target.value)))}
                    min={ETIKET_MIN_QTY}
                    max={ETIKET_MAX_QTY}
                    step={ETIKET_QTY_STEP}
                    aria-label="Etiket adedi"
                    className="w-24 h-9 text-center text-[14px] font-semibold text-lacivert tabular-nums border-x border-gri-200 focus:outline-none focus:bg-pim-mercan-tint/30"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((v) => snapEtiketQty(v + ETIKET_QTY_STEP))}
                    disabled={qty >= ETIKET_MAX_QTY}
                    aria-label={`${ETIKET_QTY_STEP} adet artır`}
                    className="w-11 h-11 md:w-9 md:h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                {ETIKET_PRESETS.map((q) => {
                  const active = qty === q;
                  const popular = q === ETIKET_POPULAR_PRESET;
                  const label = q >= 1000 ? `${q / 1000}K` : `${q}`;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQty(q)}
                      aria-pressed={active}
                      className={cn(
                        "relative px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors tabular-nums",
                        active
                          ? "bg-pim-mercan text-white"
                          : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
                      )}
                    >
                      {label}
                      {popular && !active && (
                        <span className="ml-1 text-pim-mercan">⭐</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* Price card — Intersection observer için ref'li wrapper */}
            <div ref={priceCardRef}>
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
                ctaLabel={t.config.addToCart}
                onCta={handleAddToCart}
                footnote="Tasarımını yükle, sepete ekle · KDV dahil · 5-7 iş günü teslim"
              />
            </div>
          </div>
        </div>
      </div>
      <ProductReviews productType="etiket" limit={6} />

      {/* Sticky checkout bar — mobile-only. PriceCard görünür durumda
          değilse açılır. Sefa: scroll'da CTA hep elinin altında olsun. */}
      <div
        className={cn(
          "lg:hidden fixed bottom-0 inset-x-0 z-40",
          "bg-white border-t border-gri-200 shadow-2",
          "px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          "flex items-center gap-3",
          "transition-transform duration-300 ease-out",
          showStickyBar ? "translate-y-0" : "translate-y-full"
        )}
        aria-hidden={!showStickyBar}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-bold text-pim-mercan tabular-nums leading-none">
            {fmt(total)} TL
          </div>
          <div className="text-[11px] text-gri-700 mt-0.5 truncate">
            {qty.toLocaleString("tr-TR")} adet · {width}×{height}mm · KDV dahil
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!quote.ok}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5",
            "bg-pim-mercan text-white font-bold text-[14px]",
            "px-5 h-11 rounded-full shadow-1",
            "active:scale-[0.98] transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Sepete ekle
          <Icon.ArrowR size={14} />
        </button>
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

      {/* UX audit (15 May): Tek "R" harfi yön anlatımı zayıftı. "ABC"
          kelimesi okunabilir yön gösterir — kullanıcı stripte "ABC" tam
          metnini görür, rotasyona göre yönü kavrar (düz/ters/sola/sağa). */}
      {[0, 1, 2, 3].map((i) => {
        const cx = stripX + stripW / 2;
        const cy = stripTop + i * labelH + labelH / 2;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontFamily="Nunito, sans-serif"
              fontWeight="800"
              fontSize="13"
              fill="#1F2937"
              letterSpacing="0.5"
            >
              ABC
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
  /** Müşterinin yüklediği tasarım dosyası — preview için signed URL */
  designUrl?: string | null;
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
  designUrl,
}: PreviewCanvasProps) {
  const matBg = MAT_BG[material];
  const sheen = SHEEN[coating];
  const yaldizGrad = YALDIZ_GRAD[yaldiz];

  // Sefa kuralı (11 May): malzeme özelliği belirginleşsin.
  //   - ultra clear + tasarım yüklü → checker pattern (şeffaf zemini
  //     görsel olarak ifade eden Figma/Photoshop standardı)
  //   - metalik → metalik gradient (mevcut)
  //   - kraft → kraft kahverengi (mevcut)
  //   - beyaz → düz beyaz (mevcut)
  const ultraCheckerBg =
    "linear-gradient(45deg, #dfe5ea 25%, transparent 25%), linear-gradient(-45deg, #dfe5ea 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dfe5ea 75%), linear-gradient(-45deg, transparent 75%, #dfe5ea 75%), white";
  const labelBg =
    material === "ultra"
      ? designUrl
        ? ultraCheckerBg
        : "rgba(255,255,255,0.5)"
      : material === "metalik"
        ? "linear-gradient(135deg,#E5E9EE,#FFFFFF,#C7CFD8)"
        : material === "kraft"
          ? "#E8C99B"
          : "white";
  const labelBgSize =
    material === "ultra" && designUrl
      ? "10px 10px, 10px 10px, 10px 10px, 10px 10px, auto"
      : "auto";
  const labelBgPos =
    material === "ultra" && designUrl
      ? "0 0, 0 5px, 5px -5px, -5px 0px, 0 0"
      : "0 0";

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
              backgroundSize: labelBgSize,
              backgroundPosition: labelBgPos,
              borderRadius: 6,
              boxShadow:
                material === "metalik"
                  ? "0 2px 8px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.6)"
                  : "0 2px 6px rgba(0,0,0,0.12)",
              border:
                material === "ultra"
                  ? "1.5px dashed rgba(31,41,55,0.35)"
                  : "none",
              overflow: "hidden",
            }}
          >
            {designUrl ? (
              // Müşterinin yüklediği tasarım — etiket üzerinde göster
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={designUrl}
                alt="Senin tasarımın — etiket önizleme"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
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
            )}
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

      {/* Inline ipucu kartı — Pim mascot floating chat'te (PimChat.tsx);
          burada sadece context-aware öneri metni göster. UX audit (15 May)
          sonrası: Pim'in iki yerde aynı anda görünmesi persona dağıtıyordu. */}
      <div className="absolute bottom-6 right-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 shadow-2 flex gap-2 items-start max-w-[240px] ring-1 ring-gri-200/60">
          <span aria-hidden className="text-base leading-none mt-0.5">💡</span>
          <div className="text-[12.5px] leading-relaxed text-gri-700">
            <strong className="text-lacivert">İpucu:</strong> Kozmetik
            etiketleri için Ultra Clear de premium bir cam etkisi verir.
          </div>
        </div>
      </div>
    </div>
  );
}
