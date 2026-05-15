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
  MultiDesignDropZone,
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
import { ProductInfoSection } from "@/components/ProductInfoSection";

// ============================================================
// Configuration data
// ============================================================

/**
 * Malzeme + Kaplama listesi — `modes` array form factor uyumluluğunu
 * gösterir. Sefa kuralı (15 May): tabaka etikette Ultra Clear + Metalik
 * + Soft Touch yok. Kuşe yeni eklendi (hem rulo hem tabaka).
 */
/**
 * Sefa kuralları (15 May v2):
 *   - Kuşe Etiket varsayılan + ilk sıra
 *   - "Beyaz semi-glos" → "Opak PP Etiket" (yeni isim)
 *   - "Kraft" → "Kraft Etiket", "Kuşe" → "Kuşe Etiket"
 */
const MATERIALS = [
  {
    id: "kuse",
    name: "Kuşe Etiket",
    desc: "Mat kaplamalı baskı kağıdı",
    swatch: "#FAFAF4",
    modes: ["rulo", "tabaka"] as const,
  },
  {
    id: "kraft",
    name: "Kraft Etiket",
    desc: "Doğal, dokunsal",
    swatch: "#C9A47A",
    modes: ["rulo", "tabaka"] as const,
  },
  {
    id: "beyaz",
    name: "Opak PP Etiket",
    desc: "Klasik, dayanıklı, parlak",
    swatch: "#F8F8F4",
    modes: ["rulo", "tabaka"] as const,
  },
  {
    id: "ultra",
    name: "Ultra clear",
    desc: "Şeffaf cam etkisi",
    swatch: "linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 100%)",
    modes: ["rulo"] as const,
  },
  {
    id: "metalik",
    name: "Metalik",
    desc: "Folyo gümüş",
    swatch:
      "linear-gradient(135deg, #C0C7CD 0%, #EFF2F6 60%, #B2BAC2 100%)",
    modes: ["rulo"] as const,
  },
] as const;

type MaterialId = (typeof MATERIALS)[number]["id"];

/** Sefa kuralı (15 May): "Kaplama yok" varsayılan + ilk sıra. */
const COATINGS = [
  { id: "yok", name: "Kaplama yok", desc: "Kâğıt dokusu kalsın", modes: ["rulo", "tabaka"] as const },
  { id: "mat", name: "Mat selefon", desc: "Yansımasız, premium", modes: ["rulo", "tabaka"] as const },
  { id: "parlak", name: "Parlak selefon", desc: "Canlı, temiz", modes: ["rulo", "tabaka"] as const },
  { id: "soft", name: "Soft touch", desc: "Velvet his", modes: ["rulo"] as const },
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

/** Tabaka etiket adet sınırları — Sefa kuralları (15 May):
 *  Min 250, max 10.000, step YOK (serbest girilir, 1'lik step).
 *  Presetler: 250, 500, 1K, 2.5K, 5K (popüler), 10K.
 */
const ETIKET_TABAKA_MIN_QTY = 250;
const ETIKET_TABAKA_MAX_QTY = 10000;
const ETIKET_TABAKA_QTY_STEP = 1; // step yok — serbest sürükle/yaz
const ETIKET_TABAKA_PRESETS = [250, 500, 1000, 2500, 5000, 10000] as const;
const ETIKET_TABAKA_POPULAR_PRESET = 1000;

/** Qty'i step'e snap'le (500'ün katı), min/max'a clamp et */
function snapEtiketQty(n: number): number {
  if (!Number.isFinite(n)) return ETIKET_MIN_QTY;
  const stepped = Math.round(n / ETIKET_QTY_STEP) * ETIKET_QTY_STEP;
  return Math.min(ETIKET_MAX_QTY, Math.max(ETIKET_MIN_QTY, stepped));
}

/** Tabaka için clamp — step yok, serbest tam sayı (Sefa kuralı 15 May).
 *  Sadece min/max range'e clamp ediyor, round yapmıyor. */
function snapTabakaQty(n: number): number {
  if (!Number.isFinite(n)) return ETIKET_TABAKA_MIN_QTY;
  const rounded = Math.round(n);
  return Math.min(
    ETIKET_TABAKA_MAX_QTY,
    Math.max(ETIKET_TABAKA_MIN_QTY, rounded)
  );
}

function upsellFor(qty: number): { msg: string; to: number } | null {
  if (qty < 2000) return { msg: "+1000 adet ekle, %4 daha tasarruf", to: 2000 };
  if (qty < 5000) return { msg: "5000'e çık, %6 daha tasarruf", to: 5000 };
  if (qty < 10000) return { msg: "10000'e çık, %6 daha tasarruf", to: 10000 };
  if (qty < 20000) return { msg: "20000'e çık, %7 daha tasarruf", to: 20000 };
  return null;
}

/**
 * Tasarım sayısı iskonto tier'ı (Sefa kuralı 15 May v3).
 *
 * Çoklu tasarım = aynı sipariş içinde çeşitlilik. Adet artarken birim
 * setup maliyeti dağılır → bulk indirim.
 *
 *   1 tasarım     →  %0 (normal)
 *   2-3 tasarım   →  %2
 *   4-5 tasarım   →  %4
 *   6-10 tasarım  →  %6
 *   11-25 tasarım →  %8
 *   26-50 tasarım →  %10 ⭐
 *
 * Sefa bu değerleri sonradan revize edebilir.
 */
function designCountDiscountPct(n: number): number {
  if (n >= 26) return 10;
  if (n >= 11) return 8;
  if (n >= 6) return 6;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 0;
}

/**
 * Form factor — etiket türü iki ayrı üretim akışı.
 *
 * - rulo:    Otomatik makinelere takılan rulodaki etiketler (1000+ adet,
 *            sarım yönü gerekli, klasik fason akışı).
 * - tabaka:  Düz tabaka üzerinde basılan etiketler (manuel uygulama,
 *            sarım yönü YOK, küçük tirajlara daha uygun).
 *
 * Sefa kararı (15 May): kullanıcı en başta seçer, sistem ona göre
 * dallanır. Tabaka seçimi → Sarım adımı gizlenir (5 adıma düşer).
 */
type FormFactor = "rulo" | "tabaka";

const FORM_FACTORS: { id: FormFactor; label: string; desc: string }[] = [
  {
    id: "rulo",
    label: "Rulo etiket",
    desc: "Makine takılabilir, özelleştirme seçenekleri",
  },
  {
    id: "tabaka",
    label: "Tabaka etiket",
    desc: "Düz tabaka, elle uygula",
  },
];

/** Progress stepper için adım etiketleri.
 *  IntersectionObserver "step-1"..."step-N" id'lerini izler.
 *  Form factor'a göre dinamik.
 *
 *  Sefa kuralları (15 May v3):
 *
 *  Rulo (8 adım):
 *   1 Malzeme → 2 Kaplama → 3 Özellik → 4 Sarım yönü →
 *   5 Sarım detayı → 6 Boyut → 7 Tasarım → 8 Adet
 *
 *  Tabaka (5 adım):
 *   1 Malzeme → 2 Kaplama → 3 Boyut → 4 Tasarım → 5 Adet
 *
 *  DOM id'leri (`step-N`) sıralı 1-8 — tabaka modunda Özellik/Sarım
 *  atlanır. UI step numarası (FormSection.number) formFactor'a göre
 *  hesaplanır (uiStepNumber helper).
 */
const STEP_LABELS_FULL: readonly string[] = [
  "Malzeme",
  "Kaplama",
  "Özellik",
  "Sarım yönü",
  "Sarım detayı",
  "Boyut",
  "Tasarım",
  "Adet",
];
const STEP_LABELS_TABAKA: readonly string[] = [
  "Malzeme",
  "Kaplama",
  "Boyut",
  "Tasarım",
  "Adet",
];

/** Form factor'a göre aktif DOM step id'leri. */
const STEP_IDS_FULL: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];
const STEP_IDS_TABAKA: readonly number[] = [1, 2, 6, 7, 8];

/** Rulo sarım fiziksel parametreleri (Sefa kuralı 15 May v3).
 *  Göbek çapı: rulonun iç çapı (mm). Endüstri standardı:
 *    - 25mm (1"): küçük masaüstü makinelarda
 *    - 40mm: orta ölçek otomatik makineler
 *    - 76mm (3"): endüstri standardı, en yaygın ⭐
 *  Sarım adeti: bir rulodaki etiket adedi. 250-1000 arası standart. */
const CORE_SIZES = [
  { id: 25, label: '25mm', desc: '1" — küçük makineler' },
  { id: 40, label: '40mm', desc: 'Orta ölçek' },
  { id: 76, label: '76mm', desc: '3" — standart' },
] as const;
const ROLL_LABEL_COUNTS = [250, 500, 750, 1000] as const;

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
  // Sefa kuralları (15 May v2):
  //  - Varsayılan: Kuşe Etiket + Kaplama yok (1. sıra)
  //  - Adet: minimum'dan başlasın (rulo→1000, tabaka→250)
  const [formFactor, setFormFactor] = useState<FormFactor>("rulo");
  const [material, setMaterial] = useState<EtiketMaterialId>("kuse");
  const [coating, setCoating] = useState<EtiketCoatingId>("yok");
  // Sefa kuralı (15 May v3): Rulo özelleştirmede birden fazla seçilebilir.
  // "yok" tek seçimdir; başka seçim eklenince "yok" çıkar. Pricing engine
  // şu an tek customization alır → multi seçimde ilki gönderilir + multiplier
  // local hesaplanır (sonraki commit'te engine'e multi support).
  const [customs, setCustoms] = useState<EtiketCustomId[]>(["yok"]);
  const [yaldiz, setYaldiz] = useState<YaldizId>("altin");
  const [winding, setWinding] = useState<number>(1);
  // Sarım detayı — Sefa kuralı (15 May v3): göbek çapı + sarım adeti
  // (rulo modunda). Sadece operasyonel bilgi, fason'a iletilir.
  const [coreSize, setCoreSize] = useState<number>(76); // mm — 3" endüstri standardı
  const [rollLabelCount, setRollLabelCount] = useState<number>(500);
  const [qty, setQty] = useState<number>(ETIKET_MIN_QTY); // 1000 (rulo başlangıç)
  const [width, setWidth] = useState<number>(60);
  const [height, setHeight] = useState<number>(80);
  // Tasarım adedi — kullanıcı kaç farklı tasarım göndereceğini söyler.
  // Max 50 (yüklenen dosya sayısı ile uyumsuzsa uyarı).
  const [designCount, setDesignCount] = useState<number>(1);
  // Pre-purchase tasarım — Sefa kuralı (15 May v2): max 50 dosya yüklenebilir.
  // designs[0] preview/cart için primary tasarım. Diğerleri metadata.
  const [designs, setDesigns] = useState<DesignTempState[]>([]);
  const primaryDesign = designs[0] ?? null;

  // Touched steps — kullanıcı bir adımda seçim yaptıysa o FormSection
  // numarası set'e eklenir (1=Malzeme, 2=Kaplama, 3=Özellik, 4=Sarım,
  // 5=Sarım detayı, 6=Boyut, 7=Tasarım, 8=Adet). Audit (15 May, Sefa):
  // "seçim yaptıkça çalışmıyor". Scroll-based active + touch-based done.
  // Sefa 15 May v4: varsayılan seçim de touched değilse görsel seçili
  // değil. Form factor için ayrı flag: formFactorTouched.
  const [touchedSteps, setTouchedSteps] = useState<Set<number>>(
    () => new Set()
  );
  const [formFactorTouched, setFormFactorTouched] = useState(false);
  const markTouched = useCallback((n: number) => {
    setTouchedSteps((prev) => {
      if (prev.has(n)) return prev;
      const next = new Set(prev);
      next.add(n);
      return next;
    });
  }, []);

  // Adım etiketleri + DOM id mapping — tabaka modunda Özellik/Sarım yok.
  const stepLabels =
    formFactor === "rulo" ? STEP_LABELS_FULL : STEP_LABELS_TABAKA;
  const stepIds =
    formFactor === "rulo" ? STEP_IDS_FULL : STEP_IDS_TABAKA;

  // FormSection için UI numarası: DOM step id'sinden formFactor'a göre
  // sıralı 1-N indeks üretir. Örn rulo'da step-6 → 6, tabaka'da step-6 → 3.
  const uiStepNumber = (domStepId: number): number => {
    const idx = stepIds.indexOf(domStepId);
    return idx === -1 ? 0 : idx + 1;
  };

  // Adet sınırları formFactor'a göre değişir (Sefa kuralı 15 May).
  const minQty =
    formFactor === "rulo" ? ETIKET_MIN_QTY : ETIKET_TABAKA_MIN_QTY;
  const maxQty =
    formFactor === "rulo" ? ETIKET_MAX_QTY : ETIKET_TABAKA_MAX_QTY;
  const qtyStep =
    formFactor === "rulo" ? ETIKET_QTY_STEP : ETIKET_TABAKA_QTY_STEP;
  const snapQty = formFactor === "rulo" ? snapEtiketQty : snapTabakaQty;
  const qtyPresets: readonly number[] =
    formFactor === "rulo" ? ETIKET_PRESETS : ETIKET_TABAKA_PRESETS;
  const popularPreset =
    formFactor === "rulo"
      ? ETIKET_POPULAR_PRESET
      : ETIKET_TABAKA_POPULAR_PRESET;

  // Form factor değişince incompatible seçimleri otomatik defaulte revert.
  // Sefa kuralı (15 May): tabaka modunda Ultra Clear/Metalik/Soft Touch/
  // Özelleştirme/Sarım yok. Bu seçimler tabaka'ya geçilince temizlenir.
  useEffect(() => {
    if (formFactor === "tabaka") {
      // Sarım her zaman 1'e dönsün (görünür değil ama state'i tut)
      if (winding !== 1) setWinding(1);
      // Özelleştirme tabaka'da yok → "yok"a dön
      // Tabaka modunda Özelleştirme yok → customs sıfırla
      if (customs.length !== 1 || customs[0] !== "yok") setCustoms(["yok"]);
      // Material: ultra/metalik tabaka'da yok → kraft'a dön
      if (material === "ultra" || material === "metalik") {
        setMaterial("kraft");
      }
      // Coating: soft tabaka'da yok → mat'a dön
      if (coating === "soft") setCoating("mat");
      // Qty: tabaka modunda her zaman MIN'den başla (Sefa kuralı 15 May v2).
      setQty(ETIKET_TABAKA_MIN_QTY);
    } else if (formFactor === "rulo") {
      // Rulo'ya geri dönerse: her zaman MIN'den başla.
      setQty(ETIKET_MIN_QTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFactor]);

  // /tasarımlarım'dan "Yeniden bastır" tıklandıysa sessionStorage'dan al
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reprint") !== "1") return;
    try {
      const raw = sessionStorage.getItem("pim_reprint_design");
      if (raw) {
        const parsed = JSON.parse(raw) as DesignTempState;
        setDesigns([parsed]);
        sessionStorage.removeItem("pim_reprint_design");
        toast.info("Tasarımın hazır — malzeme/adet seç, sepete ekle");
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multi-customization: ilk seçimi pricing engine'e gönder. Diğerleri
  // şu an pricing'te yansımıyor (engine tek customizationId alıyor).
  // Sonraki commit'te engine multi support eklenecek (multiplier çarpımı).
  const primaryCustom: EtiketCustomId = customs[0] ?? "yok";

  // Engine ile canlı quote
  const quote = quoteCustomerEtiket({
    width,
    height,
    qty,
    material,
    coating,
    customization: primaryCustom,
  });

  const rawTotal = quote.ok ? quote.total : 0;
  const rawUnit = quote.ok ? quote.unitPrice : 0;
  const rollsNeeded = quote.ok ? quote.rollsNeeded : 0;

  // Tasarım sayısı iskonto — Sefa kuralı 15 May v3.
  // designCount >= 2 ise total üzerinde local discount uygulanır.
  // Pricing engine'i değiştirmiyoruz (multi-customization gibi sonra).
  const designDiscountPct = designCountDiscountPct(designCount);
  const designDiscountFactor = 1 - designDiscountPct / 100;
  const total = rawTotal * designDiscountFactor;
  const unit = rawUnit * designDiscountFactor;

  // Tier savings — 1K (min) baseline ile karşılaştır
  const tierSavings = quote.ok
    ? computeEtiketTierSavings({ width, height, material, coating, customization: primaryCustom }, minQty, qty)
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

  // Progress stepper — N adım id'leri izlenir. Hangi section viewport
  // üst orta kısmına en yakınsa "active step" odur. Form factor değişince
  // re-init (tabaka → 5 adım, rulo → 6 adım).
  const [activeStep, setActiveStep] = useState(1);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // Tabaka modu Sarım'ı (step-4) atlar — id zinciri: 1,2,3,5,6
    // Stepper indeksi (1..N) ile DOM id'leri ayrı: id'ler her zaman
    // FormSection'ın orijinal number'ı, stepper UI sıralı 1..N gösterir.
    const sectionIds =
      formFactor === "rulo" ? STEP_IDS_FULL : STEP_IDS_TABAKA;
    const sections = sectionIds.map((n, idx) => {
      const el = document.getElementById(`step-${n}`);
      return el ? { el, stepIndex: idx + 1 } : null;
    }).filter((x): x is { el: HTMLElement; stepIndex: number } => x !== null);
    if (sections.length === 0) return;

    const idToIndex = new Map(sections.map((s) => [s.el.id, s.stepIndex]));

    // rootMargin: top 30% — section üst sınırı viewport %30'a yaklaşınca
    // active sayılır.
    const obs = new IntersectionObserver(
      (entries) => {
        const visibleIndexes = entries
          .filter((e) => e.isIntersecting)
          .map((e) => idToIndex.get(e.target.id))
          .filter((n): n is number => typeof n === "number");
        if (visibleIndexes.length > 0) {
          setActiveStep(Math.min(...visibleIndexes));
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s.el));
    return () => obs.disconnect();
  }, [formFactor]);

  // Stepper noktasına tıklanınca o section'a smooth scroll.
  const scrollToStep = useCallback(
    (stepIndex: number) => {
      const sectionIds =
        formFactor === "rulo" ? STEP_IDS_FULL : STEP_IDS_TABAKA;
      const sectionId = sectionIds[stepIndex - 1];
      if (sectionId == null) return;
      const el = document.getElementById(`step-${sectionId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [formFactor]
  );

  // Sepete ekle — hem PriceCard hem sticky bar tetikler.
  // Sefa kuralı (15 May v2): max 50 tasarım. Şu an cart item modeli tek
  // tasarım bağlar → designs[0] cart'a, designs[1..N] design_metadata
  // alanına serileştirilir (cart genişlemesi sonraki commit'te).
  const handleAddToCart = useCallback(async () => {
    if (!quote.ok) {
      toast.error(quote.reason ?? "Geçersiz seçim");
      return;
    }
    const matName =
      MATERIALS.find((m) => m.id === material)?.name ?? material;
    const coatName =
      COATINGS.find((c) => c.id === coating)?.name ?? coating;
    // Multi-customization: birleşik isim (örn "Spot UV + Yaldız")
    const custNames = customs
      .filter((id) => id !== "yok")
      .map((id) => CUSTOMS.find((c) => c.id === id)?.name ?? id);
    const custName =
      custNames.length === 0
        ? "Özelleştirme yok"
        : custNames.join(" + ");
    const customSuffix = customs.includes("yaldiz") ? ` (${yaldiz})` : "";
    const designCountSuffix =
      designCount > 1 ? ` · ${designCount} tasarım` : "";
    const primary = designs[0];
    const result = await addToCustomerCart({
      product: "etiket",
      title: `Etiket · ${matName} + ${coatName}`,
      config: `${width}×${height}mm · ${qty.toLocaleString("tr-TR")} adet · ${custName}${customSuffix}${formFactor === "rulo" ? ` · Sarım ${winding} · Göbek ${coreSize}mm · ${rollLabelCount} adet/rulo` : ""}${designCountSuffix}`,
      width,
      height,
      qty,
      unit: parseFloat(unit.toFixed(2)),
      total: Math.round(total),
      materialId: material,
      coatingId: coating,
      customizationId: primaryCustom,
      winding,
      designTempId: primary?.tempId,
      designPreviewUrl: primary?.previewUrl,
      designFileName: primary?.fileName,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setDesigns([]);
    toast.success(
      designs.length > 0
        ? `Sepete eklendi 🛒 — ${designs.length} tasarım bağlandı`
        : "Sepete eklendi 🛒 — sepete gitmek için üst menü"
    );
  }, [
    quote,
    toast,
    material,
    coating,
    customs,
    primaryCustom,
    yaldiz,
    width,
    height,
    qty,
    unit,
    total,
    winding,
    coreSize,
    rollLabelCount,
    designs,
    designCount,
    formFactor,
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
      {/* Breadcrumb kaldırıldı (Sefa kuralı 15 May v4): kullanıcı zaten
          aktif nav pillındaki "Etiket" ile yerini biliyor. Sayfa
          başlığı "Etiketini konfigüre et" — birincil yön bildirimi. */}
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_160px] gap-6 lg:gap-7 items-start">
          {/* LEFT — sticky preview */}
          <div className="lg:sticky lg:top-20">
            <PreviewCanvas
              material={material}
              coating={coating}
              custom={primaryCustom}
              yaldiz={yaldiz}
              width={width}
              height={height}
              designUrl={primaryDesign?.previewUrl ?? null}
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
            {/* Design upload zone sol panelden kaldırıldı — Sefa kuralı
                (15 May v2): "Boyut altına tasarım adeti kısmı ekle".
                MultiDesignDropZone Boyut FormSection'ının altında. */}
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-[24px] md:text-[40px] font-semibold tracking-tight leading-tight">
                {t.etiket.pageTitle}
              </h1>
              {/* Subtitle kaldırıldı (Sefa kuralı 15 May v4): "Seçimlerin sol
                  taraftaki rulonun üstünde canlı görünür" mesajı sayfa
                  altına taşındı (ProductInfoSection öncesi info bandı). */}
            </div>

            {/* Form factor toggle — Sefa kararı (15 May): kullanıcı en
                başta rulo mu tabaka mı seçer. Tabaka → Sarım adımı gizli. */}
            <div className="flex flex-col gap-2 -mt-1">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-gri-700">
                Etiket türü
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FORM_FACTORS.map((f) => {
                  // Touched değilse görsel seçili yok (Sefa kuralı 15 May v4)
                  const active = formFactorTouched && formFactor === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFormFactor(f.id);
                        setFormFactorTouched(true);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "text-left rounded-xl px-3.5 py-2.5 ring-1 transition-all",
                        active
                          ? "bg-pim-mercan-tint ring-pim-mercan"
                          : "bg-white ring-gri-200 hover:ring-pim-mercan"
                      )}
                    >
                      <div
                        className={cn(
                          "font-semibold text-[14px]",
                          active ? "text-pim-mercan" : "text-lacivert"
                        )}
                      >
                        {f.label}
                      </div>
                      <div className="text-[12px] text-gri-700 mt-0.5">
                        {f.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile horizontal stepper — sadece mobile/tablet (lg altı).
                Desktop'ta sağdaki dikey rail görünür (VerticalStepProgress).
                Sefa kararı (15 May): "dikey rail daha şık". */}
            <div className="lg:hidden bg-white rounded-xl px-4 py-3 ring-1 ring-gri-200 shadow-1">
              <StepProgress
                steps={stepLabels}
                stepIds={stepIds}
                activeStep={activeStep}
                completedSet={touchedSteps}
                onStepClick={scrollToStep}
              />
            </div>

            {/* Step 1 — Malzeme */}
            <FormSection
              id="step-1"
              number={uiStepNumber(1)}
              title={t.config.materialTitle}
              hint=""
            >
              <div className="grid grid-cols-2 gap-2.5">
                {MATERIALS.filter((m) =>
                  (m.modes as readonly string[]).includes(formFactor)
                ).map((m) => (
                  <SelectableCard
                    key={m.id}
                    selected={touchedSteps.has(1) && material === m.id}
                    onClick={() => {
                      setMaterial(m.id);
                      markTouched(1);
                    }}
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
              id="step-2"
              number={uiStepNumber(2)}
              title={t.config.coatingTitle}
              hint=""
            >
              <div className="grid grid-cols-2 gap-2.5">
                {COATINGS.filter((c) =>
                  (c.modes as readonly string[]).includes(formFactor)
                ).map((c) => (
                  <SelectableCard
                    key={c.id}
                    selected={touchedSteps.has(2) && coating === c.id}
                    onClick={() => {
                      setCoating(c.id);
                      markTouched(2);
                    }}
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

            {/* Step 3 — Özelleştirme (sadece RULO modunda görünür).
                Tabaka etikette emboss/yaldız/spot UV yok — Sefa kuralı.
                Sefa kuralı (15 May v3): Multi-select — birden fazla
                özellik kombine edilebilir (örn Emboss + Spot UV). */}
            {formFactor === "rulo" && (
            <FormSection
              id="step-3"
              number={uiStepNumber(3)}
              title={t.config.customizationTitle}
              hint="Birden fazla seçebilirsin (kombine kullanım)"
            >
              <div className="grid grid-cols-2 gap-2.5">
                {CUSTOMS.map((c) => {
                  // Touched değilse görsel olarak seçili göstermeyiz
                  // (Sefa kuralı: varsayılan seçim olmasın).
                  const isSelected =
                    touchedSteps.has(3) && customs.includes(c.id);
                  return (
                    <SelectableCard
                      key={c.id}
                      selected={isSelected}
                      hideCheckmark
                      onClick={() => {
                        if (c.id === "yok") {
                          // "Yok" tek seçilebilir — diğerlerini temizler
                          setCustoms(["yok"]);
                        } else {
                          // Diğer customization — "yok"u çıkar, toggle et
                          setCustoms((prev) => {
                            const withoutYok = prev.filter((id) => id !== "yok");
                            if (withoutYok.includes(c.id)) {
                              const next = withoutYok.filter((id) => id !== c.id);
                              // Hepsi çıkarıldıysa "yok"a dön
                              return next.length === 0 ? ["yok"] : next;
                            }
                            return [...withoutYok, c.id];
                          });
                        }
                        markTouched(3);
                      }}
                      padding={12}
                    >
                      {/* Sefa fix (15 May v3): tek tik — sol başında küçük
                          checkbox/radio. Sağ üstteki SelectableCard tik
                          rozeti hideCheckmark ile gizli. */}
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={cn(
                            "shrink-0 w-[18px] h-[18px] rounded grid place-items-center mt-px transition-all",
                            isSelected
                              ? "bg-pim-mercan ring-2 ring-pim-mercan"
                              : "ring-[1.5px] ring-gri-300 bg-white"
                          )}
                        >
                          {isSelected && (
                            <Icon.Check size={12} className="text-white" />
                          )}
                        </span>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{c.name}</div>
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            {c.desc}
                          </div>
                        </div>
                      </div>
                    </SelectableCard>
                  );
                })}
              </div>

              {customs.includes("yaldiz") && (
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
            )}

            {/* Step 4 — Sarım yönü (sadece RULO modunda görünür).
                Tabaka etiket: düz tabaka, sarım yok → adım gizli. */}
            {formFactor === "rulo" && (
            <FormSection
              id="step-4"
              number={uiStepNumber(4)}
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
                      selected={touchedSteps.has(4) && winding === n}
                      onClick={() => {
                        setWinding(n);
                        markTouched(4);
                      }}
                      padding={10}
                      style={{ textAlign: "center", paddingTop: 12 }}
                      aria-label={`Dışa sarım yön ${n}`}
                    >
                      <WindingIcon n={n} />
                      <div
                        className="text-[11.5px] font-bold tracking-[0.1em] mt-2"
                        style={{
                          color:
                            touchedSteps.has(4) && winding === n
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
                      selected={touchedSteps.has(4) && winding === n}
                      onClick={() => {
                        setWinding(n);
                        markTouched(4);
                      }}
                      padding={10}
                      style={{ textAlign: "center", paddingTop: 12 }}
                      aria-label={`İçe sarım yön ${n}`}
                    >
                      <WindingIcon n={n} />
                      <div
                        className="text-[11.5px] font-bold tracking-[0.1em] mt-2"
                        style={{
                          color:
                            touchedSteps.has(4) && winding === n
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
            )}

            {/* Step 4.5 — Göbek çapı + Sarım adeti (Sefa 15 May v3).
                Sadece RULO modunda. Sarım yönü kutusunun altında ayrı kutu.
                Operasyonel bilgi — fason'a iletilir, pricing'e doğrudan
                etki etmez (şimdilik). */}
            {formFactor === "rulo" && (
            <FormSection
              id="step-5"
              number={uiStepNumber(5)}
              title="Sarım detayı"
              hint="Göbek çapı ve rulo başına etiket adeti — makine uyumu için."
            >
              {/* Göbek çapı */}
              <div>
                <div className="text-[11.5px] font-bold tracking-[0.06em] text-lacivert mb-2 uppercase">
                  Göbek çapı
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CORE_SIZES.map((c) => {
                    const active = touchedSteps.has(5) && coreSize === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCoreSize(c.id);
                          markTouched(5);
                        }}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl px-3 py-2.5 ring-1 text-center transition-all",
                          active
                            ? "bg-pim-mercan-tint ring-pim-mercan"
                            : "bg-white ring-gri-200 hover:ring-pim-mercan"
                        )}
                      >
                        <div
                          className={cn(
                            "font-semibold text-[14px]",
                            active ? "text-pim-mercan" : "text-lacivert"
                          )}
                        >
                          {c.label}
                          {c.id === 76 && (
                            <span className="ml-1 text-[11px] text-pim-mercan">⭐</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gri-700 mt-0.5">
                          {c.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sarım adeti */}
              <div className="mt-4">
                <div className="text-[11.5px] font-bold tracking-[0.06em] text-lacivert mb-2 uppercase">
                  Bir rulodaki etiket adeti
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ROLL_LABEL_COUNTS.map((q) => {
                    const active = touchedSteps.has(5) && rollLabelCount === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setRollLabelCount(q);
                          markTouched(5);
                        }}
                        aria-pressed={active}
                        className={cn(
                          "rounded-xl px-3 py-2.5 ring-1 text-center transition-all",
                          active
                            ? "bg-pim-mercan-tint ring-pim-mercan"
                            : "bg-white ring-gri-200 hover:ring-pim-mercan"
                        )}
                      >
                        <div
                          className={cn(
                            "font-semibold text-[14px] tabular-nums",
                            active ? "text-pim-mercan" : "text-lacivert"
                          )}
                        >
                          {q}
                          {q === 500 && (
                            <span className="ml-1 text-[11px] text-pim-mercan">⭐</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </FormSection>
            )}

            {/* Step 6 — Boyut (UI numarası formFactor'a göre) */}
            <FormSection
              id="step-6"
              number={uiStepNumber(6)}
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
                    onChange={(e) => {
                      setWidth(Math.max(5, Number(e.target.value) || 5));
                      markTouched(5);
                    }}
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
                    onChange={(e) => {
                      setHeight(Math.max(5, Number(e.target.value) || 5));
                      markTouched(5);
                    }}
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
                {/* Sefa kuralı (15 May v2): 10 hızlı boyut, 5x5/6x6/7x7
                    kesin olsun (küçük kare etiket talepleri için). */}
                {[
                  { w: 5, h: 5, label: "5×5" },
                  { w: 6, h: 6, label: "6×6" },
                  { w: 7, h: 7, label: "7×7" },
                  { w: 30, h: 40, label: "30×40" },
                  { w: 40, h: 40, label: "40×40" },
                  { w: 50, h: 30, label: "50×30" },
                  { w: 60, h: 80, label: "60×80" },
                  { w: 70, h: 100, label: "70×100" },
                  { w: 100, h: 50, label: "100×50" },
                  { w: 100, h: 100, label: "100×100" },
                ].map((preset) => {
                  const active =
                    touchedSteps.has(6) &&
                    width === preset.w &&
                    height === preset.h;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setWidth(preset.w);
                        setHeight(preset.h);
                        markTouched(5);
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

            {/* Step 7 — Tasarım dosyaları (Sefa kuralı 15 May v3):
                Boyut altına eklenir, max 50 dosya, her biri 30 MB.
                Stepper'a DAHİL (numaralı). Tasarım adedi input ile
                fiyat tier mantığına bağlanabilir (sonraki commit). */}
            <FormSection
              id="step-7"
              number={uiStepNumber(7)}
              title="Tasarım dosyaları"
              hint="Yüklediğin dosyalar + tasarım adedi (max 50)"
            >
              {/* Tasarım adedi input */}
              <div className="mb-4">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    Kaç farklı tasarım göndereceksin?
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={designCount}
                      onChange={(e) => {
                        const n = Math.min(
                          50,
                          Math.max(1, Number(e.target.value) || 1)
                        );
                        setDesignCount(n);
                        markTouched(7);
                      }}
                      min={1}
                      max={50}
                      step={1}
                      aria-label="Tasarım adedi"
                      className="w-24 h-11 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow tabular-nums text-center"
                    />
                    <span className="text-[13px] text-gri-700">
                      adet farklı tasarım{" "}
                      <span className="text-gri-500">(max 50)</span>
                    </span>
                  </div>
                </label>
                {designs.length > 0 && designs.length !== designCount && (
                  <p className="mt-2 text-[12px] text-sari-koyu">
                    ⓘ {designs.length} dosya yükledin, {designCount} tasarım
                    bekleniyor. Sayı uyumsuz mu? Düzenle.
                  </p>
                )}
                {designDiscountPct > 0 && (
                  <p className="mt-2 text-[12px] text-pim-mercan font-semibold">
                    ✨ {designCount} tasarım için <strong>%{designDiscountPct} iskonto</strong> uygulanıyor — fiyat kartında görünür
                  </p>
                )}
              </div>

              <MultiDesignDropZone
                value={designs}
                onChange={(next) => {
                  setDesigns(next);
                  markTouched(7);
                  // Yüklenen dosya sayısı tasarım adedinden büyükse
                  // designCount'u otomatik artır (kullanıcı dostu)
                  if (next.length > designCount && next.length <= 50) {
                    setDesignCount(next.length);
                  }
                }}
                maxFiles={50}
              />
            </FormSection>

            {/* Step 6 — Adet (serbest input + preset chip'ler).
                Hint formFactor'a göre dinamik (rulo 1000+, tabaka 100+). */}
            <FormSection
              id="step-8"
              number={uiStepNumber(8)}
              title={t.config.qtyTitle}
              hint={
                formFactor === "rulo"
                  ? t.etiket.qtyHint
                  : `${minQty} adetten başla, serbest tam sayı (max ${maxQty.toLocaleString("tr-TR")})`
              }
            >
              {/* Slider — ana giriş yöntemi.
                  Sefa kuralı (15 May v2): fiyat sadece TOPLAM card'da
                  gösterilsin, adet section'da duplicate yok. Sade kalsın. */}
              <div className="px-1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[28px] font-bold text-lacivert tabular-nums leading-none">
                    {qty.toLocaleString("tr-TR")}
                    <span className="text-[14px] font-medium text-gri-700 ml-1">
                      adet
                    </span>
                  </span>
                </div>
                <QtySlider
                  value={qty}
                  min={minQty}
                  max={maxQty}
                  step={qtyStep}
                  onChange={(v) => {
                    setQty(snapQty(v));
                    markTouched(6);
                  }}
                  ariaLabel="Etiket adedi (slider)"
                />
                <div className="flex justify-between text-[10.5px] text-gri-500 mt-1.5 tabular-nums">
                  <span>{minQty.toLocaleString("tr-TR")}</span>
                  <span>{maxQty.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tierSavings > 0 && (
                    <div className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                      %{tierSavings} tasarruf 🎯 — adet indirimi
                    </div>
                  )}
                  {designDiscountPct > 0 && (
                    <div
                      className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11.5px] font-semibold"
                      title={`${designCount} tasarım için ek iskonto`}
                    >
                      %{designDiscountPct} tasarım iskonto ✨ ({designCount} çeşit)
                    </div>
                  )}
                </div>
              </div>

              {/* Adet manuel girişi — Sefa kuralı (15 May v3):
                  "İnce ayar" başlığı kaldırıldı, direkt adet kutusu. */}
              <div className="flex items-center gap-3 flex-wrap mt-4">
                <div className="inline-flex items-stretch rounded-full ring-1 ring-gri-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setQty((v) => snapQty(v - qtyStep));
                      markTouched(6);
                    }}
                    disabled={qty <= minQty}
                    aria-label={`${qtyStep} adet azalt`}
                    className="w-11 h-11 md:w-9 md:h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => {
                      setQty(snapQty(Number(e.target.value)));
                      markTouched(6);
                    }}
                    min={minQty}
                    max={maxQty}
                    step={qtyStep}
                    aria-label="Etiket adedi"
                    className="w-24 h-9 text-center text-[14px] font-semibold text-lacivert tabular-nums border-x border-gri-200 focus:outline-none focus:bg-pim-mercan-tint/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQty((v) => snapQty(v + qtyStep));
                      markTouched(6);
                    }}
                    disabled={qty >= maxQty}
                    aria-label={`${qtyStep} adet artır`}
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
                {qtyPresets.map((q) => {
                  const active = touchedSteps.has(8) && qty === q;
                  const popular = q === popularPreset;
                  // Sefa kuralı (15 May v2): binler nokta ile (10.000 not 10K)
                  const label = q.toLocaleString("tr-TR");
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQty(q);
                        markTouched(6);
                      }}
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

          {/* RAIL — desktop only dikey stepper. Sefa kararı (15 May):
              "sağ kenarda dikey rail daha şık" — Linear/Stripe/Notion
              checkout pattern. Sticky sayfa boyunca sabit. Mobile'da
              gizli (mobile için yatay <StepProgress> üstte var). */}
          <aside
            className="hidden lg:block lg:sticky lg:top-[88px]"
            aria-label="Konfigürasyon adımları (dikey rail)"
          >
            <div className="bg-white rounded-xl px-3 py-3 ring-1 ring-gri-200 shadow-1">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-gri-700 mb-2 px-1">
                Adımlar
              </div>
              <VerticalStepProgress
                steps={stepLabels}
                stepIds={stepIds}
                activeStep={activeStep}
                completedSet={touchedSteps}
                onStepClick={scrollToStep}
              />
            </div>
          </aside>
        </div>
      </div>
      {/* Bilgi bandı — Sefa kuralı (15 May v4): subtitle sağ panelden
          buraya taşındı. Konfigüratör akışını kısaca anlatır. */}
      <div className="bg-krem/40 border-y border-gri-200 py-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 text-center">
          <p className="text-[14px] md:text-[15px] text-gri-700 leading-relaxed max-w-[640px] mx-auto">
            <span className="inline-block w-2 h-2 rounded-full bg-yesil mr-2 align-middle" />
            Seçimlerin sol taraftaki canlı önizlemede anlık görünür —
            beğenmedin mi, geri dön, başka kombinasyon dene.
          </p>
        </div>
      </div>

      {/* Ürün anlatım bölümü (Sefa kuralı 15 May v3) — Stickermule
          tarzı feature kartları + highlight + galeri. Yorumlardan önce. */}
      <ProductInfoSection product="etiket" />
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
// StepProgress — 6 adımlık ilerleme göstergesi
// ============================================================

/**
 * N adımlık konfigüratör ilerleme bandı.
 *
 * Desktop (md+): tıklanabilir nokta+çizgi + altta etiketler.
 * Mobile: kompakt "Adım X / N · [Label]" + ince progress bar.
 *
 * Active = scroll-based (IntersectionObserver). "Tamamlandı" = kullanıcı
 * o adıma dokundu (touch tracking). Nokta/label'a tıklayınca scroll-to.
 *
 * Props:
 *   - steps:        UI label dizisi (örn ["Malzeme","Kaplama",...])
 *   - stepIds:      FormSection orijinal numaraları (touched lookup için)
 *   - activeStep:   Şu an aktif olan UI index (1-N)
 *   - completedSet: Tamamlanan FormSection numaraları (touched)
 *   - onStepClick:  UI index alır, scroll-to tetikler
 */
function StepProgress({
  steps,
  stepIds,
  activeStep,
  completedSet,
  onStepClick,
}: {
  steps: readonly string[];
  stepIds: readonly number[];
  activeStep: number;
  completedSet: Set<number>;
  onStepClick: (stepIndex: number) => void;
}) {
  const total = steps.length;
  const progressPct = (Math.max(1, activeStep) / total) * 100;
  const activeLabel = steps[activeStep - 1] ?? steps[0];

  return (
    <div>
      {/* Mobile: compact bar + text */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-pim-mercan">
            Adım {activeStep} / {total}
          </span>
          <span className="text-[12.5px] font-semibold text-lacivert">
            {activeLabel}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gri-200 overflow-hidden">
          <div
            className="h-full bg-pim-mercan rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/* Desktop: dot row + tıklanabilir label */}
      <div
        className="hidden md:block"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={activeStep}
        aria-label={`Konfigürasyon adımı ${activeStep} / ${total}: ${activeLabel}`}
      >
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => {
            const stepNum = i + 1;
            const sectionId = stepIds[i];
            const isActive = stepNum === activeStep;
            const isDone =
              completedSet.has(sectionId) && !isActive;
            return (
              <div key={stepNum} className="flex items-center gap-1.5 flex-1">
                {/* Numara — tıklanabilir, scroll-to tetikler */}
                <button
                  type="button"
                  onClick={() => onStepClick(stepNum)}
                  aria-label={`${steps[i]} adımına git`}
                  className={cn(
                    "shrink-0 grid place-items-center rounded-full",
                    "text-[11px] font-bold tabular-nums transition-all duration-200",
                    "hover:scale-110 active:scale-95 cursor-pointer",
                    "focus:outline-none focus:ring-2 focus:ring-pim-mercan focus:ring-offset-2",
                    isActive
                      ? "w-6 h-6 bg-pim-mercan text-white ring-2 ring-pim-mercan-tint"
                      : isDone
                        ? "w-5 h-5 bg-pim-mercan text-white"
                        : "w-5 h-5 bg-gri-200 text-gri-700 hover:bg-gri-300"
                  )}
                >
                  {stepNum}
                </button>
                {/* Connector */}
                {i < total - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "flex-1 h-px transition-colors",
                      isDone || isActive ? "bg-pim-mercan" : "bg-gri-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* Labels — clickable */}
        <div
          className="grid gap-1.5 mt-1.5"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((label, i) => {
            const stepNum = i + 1;
            const sectionId = stepIds[i];
            const isActive = stepNum === activeStep;
            const isDone =
              completedSet.has(sectionId) && !isActive;
            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => onStepClick(stepNum)}
                className={cn(
                  "text-[10.5px] font-semibold tabular-nums truncate text-left",
                  "transition-colors hover:text-pim-mercan cursor-pointer",
                  isActive
                    ? "text-pim-mercan"
                    : isDone
                      ? "text-lacivert"
                      : "text-gri-500"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VerticalStepProgress — dikey rail (desktop only)
// ============================================================

/**
 * Sefa kararı (15 May): Stepper sayfanın sağ kenarında dikey rail
 * olarak da denensin — "daha şık" pattern (Linear / Stripe / Notion
 * checkout sidebar tarzı).
 *
 * Desktop only (lg+). Mobile'da yatay <StepProgress> kullanılır.
 * Sticky position, scroll'da hep sabit.
 *
 * Görsel anatomi:
 *   ●━━━ Malzeme    ← aktif (büyük halka)
 *   │
 *   ●━━━ Kaplama    ← tamamlandı (dolu coral)
 *   │
 *   ○━━━ Özellik    ← henüz (gri boş)
 */
function VerticalStepProgress({
  steps,
  stepIds,
  activeStep,
  completedSet,
  onStepClick,
}: {
  steps: readonly string[];
  stepIds: readonly number[];
  activeStep: number;
  completedSet: Set<number>;
  onStepClick: (stepIndex: number) => void;
}) {
  const total = steps.length;
  return (
    <nav
      role="navigation"
      aria-label="Konfigürasyon adımları"
      className="flex flex-col"
    >
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const sectionId = stepIds[i];
        const isActive = stepNum === activeStep;
        const isDone = completedSet.has(sectionId) && !isActive;
        const isLast = i === total - 1;
        return (
          <button
            key={stepNum}
            type="button"
            onClick={() => onStepClick(stepNum)}
            aria-current={isActive ? "step" : undefined}
            aria-label={`${stepNum}. adım: ${label}${
              isDone ? " (tamamlandı)" : isActive ? " (aktif)" : ""
            }`}
            className={cn(
              "group relative flex items-start gap-3 py-2 pr-3",
              "text-left transition-colors",
              "focus:outline-none focus-visible:bg-pim-mercan-tint/40 rounded-r-lg"
            )}
          >
            {/* Numara + dikey çizgi */}
            <div className="relative flex flex-col items-center shrink-0 pt-0.5">
              <span
                aria-hidden
                className={cn(
                  "rounded-full grid place-items-center shrink-0",
                  "transition-all duration-200 font-bold tabular-nums",
                  "group-hover:scale-110 group-active:scale-95",
                  isActive
                    ? "w-7 h-7 bg-pim-mercan text-white text-[12px] ring-[3px] ring-pim-mercan-tint"
                    : isDone
                      ? "w-6 h-6 bg-pim-mercan text-white"
                      : "w-6 h-6 bg-gri-200 text-gri-700 text-[11px] group-hover:bg-gri-300"
                )}
              >
                {isDone ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 4"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  stepNum
                )}
              </span>
              {/* Dikey connector çizgisi (son adımdan sonra yok) */}
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "w-0.5 grow min-h-[24px] mt-1 transition-colors",
                    isDone || isActive ? "bg-pim-mercan" : "bg-gri-200"
                  )}
                />
              )}
            </div>

            {/* Label */}
            <div className="flex-1 pt-px">
              <div
                className={cn(
                  "text-[12.5px] font-semibold transition-colors leading-tight",
                  isActive
                    ? "text-pim-mercan"
                    : isDone
                      ? "text-lacivert"
                      : "text-gri-500 group-hover:text-pim-mercan"
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  "text-[10.5px] mt-0.5 transition-colors uppercase tracking-[0.04em]",
                  isActive
                    ? "text-pim-mercan/80"
                    : isDone
                      ? "text-yesil"
                      : "text-gri-500"
                )}
              >
                {isActive
                  ? "Şu an"
                  : isDone
                    ? "Tamam"
                    : `Adım ${stepNum}`}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
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
  // Kuşe (yeni 15 May): hafif krem, mat kaplamalı kağıt hissi
  kuse: "linear-gradient(180deg, #FAFAF4 0%, #EDEDE4 100%)",
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

      {/* İpucu kartı kaldırıldı — Sefa kuralı (15 May v4):
          Preview canvas temiz kalsın, Pim mascot sadece sağ alt floating
          chat'te (PimChat.tsx). Kullanıcı isterse oradan soru sorar. */}
    </div>
  );
}
