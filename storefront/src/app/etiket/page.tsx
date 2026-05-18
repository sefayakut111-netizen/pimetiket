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
import { useSequentialSteps } from "@/lib/use-sequential-steps";
import { AddToCartSuccessModal } from "@/components/cart/AddToCartSuccessModal";
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
  MaterialSwatch,
  PopulerBadge,
  InfoTooltip,
  type DesignTempState,
} from "@/components/ui";
import {
  ProductPreviewShell,
  EtiketLivePreview,
  type PreviewView,
} from "@/components/preview";
import {
  MultiDesignUploader,
  type PendingDesign,
} from "@/components/sticker/MultiDesignUploader";
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
import { StepProgress, VerticalStepProgress } from "@/components/Stepper";

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
// Sefa 17 May P1-7: EN locale eklendi (Site denetim raporu i18n leak)
// id sabit kalır; name/desc locale'a göre seçilir runtime'da.
// Sefa 18 May v42: Malzeme açıklamaları + Şeffaf Etiket eklendi.
// note?: opsiyonel uyarı satırı (örn. kraft → "el ile yapıştırmaya
// uygun değildir"). SelectableCard altına ek satır olarak görünür.
const MATERIALS = [
  {
    id: "kuse",
    name: "Kuşe Etiket",
    name_en: "Coated paper label",
    desc: "Pürüzsüz yüzeyli standart kâğıt etiket.",
    desc_en: "Smooth-surface standard paper label.",
    swatch: "#FAFAF4",
    surface: "kuse" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip: "",
  },
  {
    id: "kraft",
    name: "Kraft Etiket",
    name_en: "Kraft label",
    desc: "Doğal görünümlü, dokulu ekolojik kâğıt.",
    desc_en: "Natural-look, textured eco paper.",
    swatch: "#C9A47A",
    surface: "kraft" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip: "",
  },
  {
    id: "beyaz",
    name: "Opak PP Etiket",
    name_en: "Opaque PP label",
    desc: "Yırtılmaz, suya dayanıklı plastik etiket.",
    desc_en: "Tear-proof, water-resistant plastic label.",
    swatch: "#F8F8F4",
    surface: "opakpp" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip:
      "PP (Polipropilen): Suya, neme, yağa dayanıklı plastik etiket. Buzdolabı / soğuk zincir ürünlerinde tercih edilir.",
  },
  {
    id: "seffaf",
    name: "Şeffaf Etiket",
    name_en: "Transparent label",
    desc: "Arka planı gösteren saydam etiket.",
    desc_en: "See-through transparent label.",
    swatch: "linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 50%, #E0F2FE 100%)",
    surface: "transparan" as const,
    modes: ["rulo"] as const,
    tooltip: "",
  },
  {
    id: "ultra",
    name: "Ultra Clear Etiket",
    name_en: "Ultra Clear label",
    desc: "Tamamen şeffaf, görünmez film etiket.",
    desc_en: "Fully transparent, invisible film label.",
    note: "El ile yapıştırmaya uygun değildir.",
    note_en: "Not suitable for hand application.",
    swatch: "linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 100%)",
    surface: "ultraclear" as const,
    modes: ["rulo"] as const,
    tooltip:
      "Ultra Clear: Cam berraklığında tamamen şeffaf film. Sadece basılan tasarım görünür, etiket sınırı belli olmaz. Cam şişe / parfümlerde standart.",
  },
  {
    id: "metalik",
    name: "Metalize Etiket",
    name_en: "Metallic label",
    desc: "Parlak metalik yüzeyli, dikkat çekici.",
    desc_en: "Glossy metallic finish, eye-catching.",
    swatch:
      "linear-gradient(135deg, #C0C7CD 0%, #EFF2F6 60%, #B2BAC2 100%)",
    surface: "metalik" as const,
    modes: ["rulo"] as const,
    tooltip: "",
  },
] as const;

type MaterialId = (typeof MATERIALS)[number]["id"];

/** Sefa kuralı (15 May): "Kaplamasız" varsayılan + ilk sıra.
 *  Sefa 18 May v47: Açıklamalar genişletildi + Title Case (Mat Selefon,
 *  Parlak Selefon, Soft Touch). */
const COATINGS = [
  {
    id: "yok",
    name: "Kaplamasız",
    name_en: "Uncoated",
    desc: "Doğal kâğıt dokusu korunur.",
    desc_en: "Keeps the natural paper texture.",
    surface: "kaplamasiz" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip: "",
  },
  {
    id: "mat",
    name: "Mat Selefon",
    name_en: "Matte Lamination",
    desc: "Yansımasız, mat premium görünüm.",
    desc_en: "No reflection, matte premium look.",
    surface: "matselefon" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip:
      "Selefon: Etiket üzerine yapıştırılan ince koruyucu film. Mat yapısı yansıma yapmaz, premium ürünlerde tercih edilir.",
  },
  {
    id: "parlak",
    name: "Parlak Selefon",
    name_en: "Gloss Lamination",
    desc: "Canlı, parlak ve temiz yüzey.",
    desc_en: "Vivid, glossy and clean surface.",
    surface: "parlakselefon" as const,
    modes: ["rulo", "tabaka"] as const,
    tooltip:
      "Selefon: Etiketin üzerini parlak bir koruyucu film ile kaplar. Renkleri canlandırır, çiziklere karşı dayanım sağlar.",
  },
  {
    id: "soft",
    name: "Soft Touch",
    name_en: "Soft Touch",
    desc: "Premium kadife dokunma hissi.",
    desc_en: "Premium velvet touch feel.",
    surface: "softtouch" as const,
    modes: ["rulo"] as const,
    tooltip:
      "Soft Touch: Kadife / şeftali kabuğu dokusunda mat kaplama. Yüksek kalite hissi verir, kozmetik ve parfüm etiketlerinde tercih edilir.",
  },
] as const;

type CoatingId = (typeof COATINGS)[number]["id"];

// Sefa 18 May v42: Özelleştirme açıklamaları güncellendi (özel katman
// notu — yüzey üzerine ek işlem).
const CUSTOMS = [
  {
    id: "yok",
    name: "Özelleştirme yok",
    name_en: "No customization",
    desc: "",
    desc_en: "",
    surface: "ozyok" as const,
    tooltip: "",
  },
  {
    id: "emboss",
    name: "Kabartma (Emboss Lak)",
    name_en: "Emboss Lacquer",
    desc: "Yüzeyde dokunsal üç boyutlu etki.",
    desc_en: "Tactile 3D effect on the surface.",
    surface: "emboss" as const,
    tooltip:
      "Tasarımın belirli kısımları kabartılır. Logo, başlık veya çerçeve için tercih edilir — dokunulduğunda hissedilir.",
  },
  {
    id: "yaldiz",
    name: "Sıcak Yaldız",
    name_en: "Hot Foil",
    desc: "Isıyla uygulanan parlak metalik detay.",
    desc_en: "Heat-applied glossy metallic detail.",
    surface: "sicakyaldiz" as const,
    tooltip:
      "Altın, gümüş veya bakır rengi metalik folyo, ısıyla baskı yüzeyine yapıştırılır. Lüks ürünlerde standart.",
  },
  {
    id: "spotuv",
    name: "Spot UV",
    name_en: "Spot UV",
    desc: "Belirli alanları parlatan şeffaf katman.",
    desc_en: "Transparent gloss on selected areas.",
    surface: "spotuv" as const,
    tooltip:
      "Spot UV: Belirli alanlara uygulanan parlak şeffaf vernik. Logo veya fotoğrafı diğer alanlardan ayırarak öne çıkarır.",
  },
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

/** Etiket preset chip'leri (Sefa 18 May v58: 5 preset tek satır) */
const ETIKET_PRESETS = CUSTOMER_ETIKET_TIERS; // [1000, 2000, 3000, 5000, 10000]
// Sefa 18 May v58: popüler yıldız rozeti kaldırıldı (-1 = match yok)
const ETIKET_POPULAR_PRESET = -1;

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

// Sefa 17 May P1-7: EN locale eklendi
const FORM_FACTORS: {
  id: FormFactor;
  label: string;
  label_en: string;
  desc: string;
  desc_en: string;
  icon: string;
}[] = [
  {
    id: "rulo",
    label: "Rulo etiket",
    label_en: "Roll label",
    desc: "Makine ile yapıştırmak için idealdir.",
    desc_en: "Ideal for machine application.",
    icon: "/assets/svg/icons/roll-icon.svg",
  },
  {
    id: "tabaka",
    label: "Tabaka etiket",
    label_en: "Sheet label",
    desc: "Düz tabaka, elle uygula",
    desc_en: "Flat sheet, manual application",
    icon: "/assets/svg/icons/sheet-icon.svg",
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
/** Form factor'a göre aktif DOM step id'leri.
 *  NOT: Step label string'leri 16 May denetim sonrası i18n'a taşındı
 *  (component içi STEP_LABELS_*_I18N), t.etiket.step* anahtarlarından
 *  geliyor. */
// Sefa 17 May v40: Etiket türü FormSection olarak eklendi (id=step-0,
// stepper'da ADIM 1). Mevcut step-1..step-8 DOM id'leri korundu, UI
// numaraları otomatik +1 kaydı (uiStepNumber idx + 1 → step-0 için 1).
const STEP_IDS_FULL: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const STEP_IDS_TABAKA: readonly number[] = [0, 1, 2, 6, 7, 8];

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
/** Sefa 18 May v68 (UX uzman 3.7): Birim fiyatlar 2 ondalığa yuvarlandı.
 *  "2,5079 TL" → "2,51 TL" — 4 basamak okunaklılığı bozuyordu, kuruş
 *  hassasiyeti (2 ondalık) Türk müşterisi için yeterli ve standart. */
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

export default function EtiketPage() {
  const toast = useToast();
  const { t, locale } = useT();
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
  // Pre-purchase tasarım — Sefa kuralı (15 May v6):
  // Sticker'daki MultiDesignUploader pattern'i etikette de kullanılıyor.
  // PendingDesign local-only (Supabase upload yok), sipariş sonrası
  // detay sayfasından gerçek upload yapılır.
  // designs[0] mockup preview için primary, diğerleri metadata.
  const [designs, setDesigns] = useState<PendingDesign[]>([]);
  const primaryDesign = designs[0] ?? null;

  // Sefa 18 May v68 (5): 3D / Eskiz toggle state
  const [previewView, setPreviewView] = useState<PreviewView>("3d");

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
  // Sefa 18 May v60: Sepete eklendi pop-up'ı (toast yerine modal)
  const [cartSuccessOpen, setCartSuccessOpen] = useState(false);
  const [cartSuccessSummary, setCartSuccessSummary] = useState<string>("");
  const markTouched = useCallback((n: number) => {
    setTouchedSteps((prev) => {
      if (prev.has(n)) return prev;
      const next = new Set(prev);
      next.add(n);
      return next;
    });
  }, []);

  // Sefa 18 May v65: Form factor değişince TÜM seçimleri sıfırla
  // ('refresh' davranışı — kullanıcı rulo'ya geçti, ayarladı, sonra
  // tabaka'ya döndü → eski rulo seçimleri çakışmasın).
  const handleFormFactorChange = useCallback(
    (next: FormFactor) => {
      // Aynı zaten seçili ise no-op
      if (next === formFactor && formFactorTouched) return;
      // Tasarım blob URL'lerini temizle (memory leak yok)
      designs.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      // State'leri default'a döndür
      setFormFactor(next);
      setFormFactorTouched(true);
      setTouchedSteps(new Set([0])); // sadece etiket türü touched
      setMaterial("kuse");
      setCoating("yok");
      setCustoms(["yok"]);
      setYaldiz("altin");
      setWinding(1);
      setCoreSize(76);
      setRollLabelCount(500);
      setWidth(60);
      setHeight(80);
      setQty(next === "rulo" ? ETIKET_MIN_QTY : ETIKET_TABAKA_MIN_QTY);
      setDesignCount(1);
      setDesigns([]);
      // step-0 touched gözüksün diye markTouched(0) tetikle
      // (setTouchedSteps Set'ini doğrudan set ettiğimiz için zaten dahil)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formFactor, formFactorTouched, designs]
  );

  // Adım etiketleri + DOM id mapping — tabaka modunda Özellik/Sarım yok.
  // Sefa 16 May denetim #1: i18n — labels artık t.etiket.step*'ten geliyor.
  const STEP_LABELS_FULL_I18N: readonly string[] = [
    t.etiket.stepFormFactor,
    t.etiket.stepMaterial,
    t.etiket.stepCoating,
    t.etiket.stepFeature,
    t.etiket.stepWinding,
    t.etiket.stepWindingDetail,
    t.etiket.stepSize,
    t.etiket.stepDesign,
    t.etiket.stepQty,
  ];
  const STEP_LABELS_TABAKA_I18N: readonly string[] = [
    t.etiket.stepFormFactor,
    t.etiket.stepMaterial,
    t.etiket.stepCoating,
    t.etiket.stepSize,
    t.etiket.stepDesign,
    t.etiket.stepQty,
  ];
  const stepLabels =
    formFactor === "rulo" ? STEP_LABELS_FULL_I18N : STEP_LABELS_TABAKA_I18N;
  const stepIds =
    formFactor === "rulo" ? STEP_IDS_FULL : STEP_IDS_TABAKA;

  // FormSection için UI numarası: DOM step id'sinden formFactor'a göre
  // sıralı 1-N indeks üretir. Örn rulo'da step-6 → 6, tabaka'da step-6 → 3.
  const uiStepNumber = (domStepId: number): number => {
    const idx = stepIds.indexOf(domStepId);
    return idx === -1 ? 0 : idx + 1;
  };

  // Sefa 18 May v53: Sequential UX → useSequentialSteps hook'una
  // taşındı (tüm konfigüratör sayfaları aynı sistemi kullanır).
  const { isLocked: isStepLocked, lockMessage: getLockMessage } =
    useSequentialSteps({
      stepIds,
      stepLabels,
      touchedSteps,
      prerequisiteForFirst: formFactorTouched,
      locale,
    });

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

  // Sefa 18 May v65: Form factor değişince incompatible seçim revert
  // useEffect'i kaldırıldı. handleFormFactorChange tüm reset'i yapıyor
  // (tam refresh — state default'lara dönüyor, kullanıcı sıfırdan ayar).

  // /tasarımlarım'dan "Yeniden bastır" tıklandıysa kullanıcıyı bilgilendir.
  // Reprint flow (Sefa kuralı 15 May v6): artık MultiDesignUploader
  // local-preview kullanıyor (PendingDesign), eski DesignTempState reprint
  // direkt mockup'a gitmiyor. Kullanıcı sayfada manuel re-upload yapar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reprint") !== "1") return;
    try {
      const raw = sessionStorage.getItem("pim_reprint_design");
      if (raw) {
        sessionStorage.removeItem("pim_reprint_design");
        toast.info(
          "Yeniden bastırma için malzeme/adet seç, tasarım dosyalarını tekrar yükle"
        );
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multi-customization (Sefa kuralı 15 May v4): pricing engine artık
  // customizations array'ini destekliyor — tüm multiplier'lar çarpılır.
  // Backwards compat için primaryCustom da gönderiliyor (ilk seçim).
  const primaryCustom: EtiketCustomId = customs[0] ?? "yok";

  // Engine ile canlı quote (multi-customization aktif)
  const quote = quoteCustomerEtiket({
    width,
    height,
    qty,
    material,
    coating,
    customization: primaryCustom,
    customizations: customs,
  });

  const rawTotal = quote.ok ? quote.total : 0;
  const rawUnit = quote.ok ? quote.unitPrice : 0;
  const rollsNeeded = quote.ok ? quote.rollsNeeded : 0;

  // Sefa kuralı (15 May v6): "Her tasarımdan qty adet × designCount tasarım"
  // mantığı sticker'da olduğu gibi etikete de uygulandı.
  // total = quote(qty) × designCount × discountFactor (her tasarım için
  // ayrı setup/baskı → designCount artarken fiyat lineer artar).
  const designDiscountPct = designCountDiscountPct(designCount);
  const designDiscountFactor = 1 - designDiscountPct / 100;
  const totalEtiketCount = qty * designCount;
  const total = rawTotal * designCount * designDiscountFactor;
  const unit = rawUnit * designDiscountFactor;

  // Tier savings — 1K (min) baseline ile karşılaştır
  const tierSavings = quote.ok
    ? computeEtiketTierSavings({ width, height, material, coating, customization: primaryCustom, customizations: customs }, minQty, qty)
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
  // Sefa 18 May v68 (UX uzman 3.2): Sticky CTA görünürken Pim chat butonu
  // sticky bar'ın üzerine binmesin → CSS variable ile chat'i yukarı kaydır.
  // PimChat.tsx `--sticky-cta-h` variable'ı okur.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    // Mobile breakpoint kontrolü — lg altında sticky bar var
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (showStickyBar && isMobile) {
      root.style.setProperty("--sticky-cta-h", "76px");
    } else {
      root.style.setProperty("--sticky-cta-h", "0px");
    }
    return () => {
      root.style.setProperty("--sticky-cta-h", "0px");
    };
  }, [showStickyBar]);

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
    // Sefa kuralı (15 May v6): toplam etiket = qty × designCount
    // (her tasarımdan ayrı baskı). Cart'a totalEtiketCount kaydedilir.
    const designCountSuffix =
      designCount > 1
        ? ` · ${designCount} tasarım × ${qty.toLocaleString("tr-TR")} = ${totalEtiketCount.toLocaleString("tr-TR")} etiket`
        : "";
    const primary = designs[0];
    // Sefa 17 May P1-12: tasarım yüklemeden sepete ekle akışı net opt-in.
    // Eski "policy: ödeme sonrası 3 gün" gizliydi → cart title'da açık
    // göster ki müşteri sepete bakınca "tasarımı yüklemem lazım" anlasın.
    const hasNoDesign = designs.length === 0;
    const result = await addToCustomerCart({
      product: "etiket",
      title: `Etiket · ${matName} + ${coatName}${
        designCount > 1 ? ` (${designCount} tasarım)` : ""
      }${hasNoDesign ? " · 📎 Tasarım sonra yüklenecek" : ""}`,
      config: `${width}×${height}mm · ${qty.toLocaleString("tr-TR")} adet · ${custName}${customSuffix}${formFactor === "rulo" ? ` · Sarım ${winding} · Göbek ${coreSize}mm · ${rollLabelCount} adet/rulo` : ""}${designCountSuffix}`,
      width,
      height,
      qty: totalEtiketCount, // toplam etiket = qty × designCount
      unit: parseFloat(unit.toFixed(2)),
      total: Math.round(total),
      materialId: material,
      coatingId: coating,
      customizationId: primaryCustom,
      winding,
      // PendingDesign local-only (Supabase tempId yok) — "local-{id}" formatında.
      // Sipariş sonrası detay sayfasında gerçek upload yapılır (sticker pattern).
      designTempId: primary ? `local-${primary.id}` : undefined,
      designPreviewUrl: primary?.previewUrl,
      designFileName: primary?.name,
      // Multi-design metadata (Sefa 15 May v6): designCount + tüm dosyalar
      // (primary dahil, sticker pattern'ine paralel).
      designCount: designCount > 1 ? designCount : undefined,
      additionalDesigns:
        designs.length > 0
          ? designs.map((d) => ({
              tempId: `local-${d.id}`,
              previewUrl: d.previewUrl,
              fileName: d.name,
              sizeBytes: d.sizeBytes,
              mimeType: d.mimeType,
            }))
          : undefined,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    // PendingDesign local-preview blob URL'lerini revoke et (memory leak yok)
    designs.forEach((d) => URL.revokeObjectURL(d.previewUrl));
    // Sefa 18 May v60-v61: toast yerine modal popup; productSummary
    // locale-aware ('adet'/'etiket' EN'de 'pcs'/'labels')
    const summary =
      designs.length > 0
        ? `${matName} · ${width}×${height} mm · ${designCount} ${locale === "en" ? "designs" : "tasarım"} × ${qty.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} = ${totalEtiketCount.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} ${t.cart.unitLabel}`
        : `${matName} · ${width}×${height} mm · ${qty.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} ${t.cart.unitPiece}`;
    setCartSuccessSummary(summary);
    setCartSuccessOpen(true);
    setDesigns([]);
    setDesignCount(1);
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
    totalEtiketCount,
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
              "Kozmetik, gıda, içecek, parfüm etiketleri. Vinil/kuşe/transparent. AI dosya kontrolü ile 5 iş günü içinde kargoda. 1.000 adetten başlar.",
            category: "Etiket / Label",
            priceFrom: 850,
          }),
          breadcrumbSchema([
            { label: "Anasayfa", url: "/" },
            { label: "Etiket", url: "/etiket" },
          ]),
        ]}
      />
      {/* Sefa 17 May v40: küçük breadcrumb yerine BÜYÜK başlık strip'i.
          Title Case, full-width, görsel olarak güçlü açılış. */}
      <div className="border-b border-gri-200 bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-full bg-pim-mercan"
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pim-mercan">
              Konfigüratör
            </span>
          </div>
          <h1 className="text-[26px] md:text-[40px] font-semibold tracking-tight leading-tight text-lacivert">
            {t.etiket.pageTitle}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        {/* Sefa 18 May v68: preview kolonu sticker ile aynı oran (1fr).
            Eskiden 1.3fr → çok genişti; sticker'daki kompakt görünüm
            daha dengeli + config alanı daha geniş okunur kalıyor. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_160px] gap-6 lg:gap-7 items-start">
          {/* LEFT — sticky preview (Sefa 18 May v67: yeni ProductPreviewShell
              + EtiketLivePreview kompozisyonu, eski PreviewCanvas kaldırıldı) */}
          <div className="lg:sticky lg:top-20">
            <ProductPreviewShell
              width={width}
              height={height}
              view={previewView}
              onViewChange={setPreviewView}
              footnote={
                primaryDesign
                  ? t.etiket.livePreviewWithFile
                  : t.etiket.livePreviewNoFile
              }
            >
              <EtiketLivePreview
                formFactor={formFactor}
                material={material}
                coating={coating}
                customs={customs}
                yaldiz={yaldiz}
                width={width}
                height={height}
                view={previewView}
                designUrl={primaryDesign?.previewUrl ?? null}
                /* Sefa 18 May v67: gerçek geometri — tabaka grid'i
                 * "kaç adet sığar"a göre çizer (sabit 6 değil). */
                geometryCols={quote.ok ? quote.geometry.cols : undefined}
                geometryRows={
                  quote.ok ? quote.geometry.rowsPerSheet : undefined
                }
                geometryPerSheet={
                  quote.ok ? quote.geometry.perSheet : undefined
                }
              />
            </ProductPreviewShell>
            {/* Design upload zone sol panelden kaldırıldı — Sefa kuralı
                (15 May v2): "Boyut altına tasarım adeti kısmı ekle".
                MultiDesignDropZone Boyut FormSection'ının altında.
                Sefa 18 May v67: BOYUT chip + 3D/Düz toggle artık
                ProductPreviewShell içinde — eski legacy buttonlar silindi. */}
          </div>

          {/* RIGHT — config (Sefa 17 May v40: h1 duplicate kaldırıldı,
              üstte büyük strip'e taşındı) */}
          <div className="flex flex-col gap-5">

            {/* Step 0 — Etiket türü (Sefa 17 May v40: form factor seçimi
                FormSection olarak kutu içine alındı, ADIM 1 numaralı) */}
            <FormSection
              id="step-0"
              number={uiStepNumber(0)}
              title={t.etiket.stepFormFactor}
              hint="Rulo etiketlerde ekstra özelleştirme seçenekleri mevcuttur."
            >
              <div className="grid grid-cols-2 gap-2">
                {FORM_FACTORS.map((f) => {
                  // Touched değilse görsel seçili yok (Sefa kuralı 15 May v4)
                  const active = formFactorTouched && formFactor === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        // Sefa 18 May v65: form factor değişince TÜM seçimler
                        // sıfırlanır (refresh davranışı). handleFormFactorChange
                        // markTouched(0) dahil tüm reset'i yapar.
                        handleFormFactorChange(f.id);
                      }}
                      aria-pressed={active}
                      className={cn(
                        // Sefa 18 May v68: sticker CutModeCard ile birebir parite
                        // — p-4, ring-1.5px, flex items-start (üst hizalı), gap-3
                        "p-4 rounded-xl ring-[1.5px] text-left transition-all flex items-start gap-3",
                        active
                          ? "ring-pim-mercan bg-pim-mercan-tint/40 shadow-1 -translate-y-0.5"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.icon}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "font-semibold text-[14.5px] leading-tight",
                            active ? "text-pim-mercan" : "text-lacivert"
                          )}
                        >
                          {locale === "en" ? f.label_en : f.label}
                        </div>
                        <div className="text-[12.5px] text-gri-700 mt-1 leading-snug">
                          {locale === "en" ? f.desc_en : f.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* Mobile horizontal stepper — sadece mobile/tablet (lg altı).
                Desktop'ta sağdaki dikey rail görünür (VerticalStepProgress).
                Sefa kararı (15 May): "dikey rail daha şık". */}
            {/* Sefa 18 May v68 (UX uzman 4-mobile): Mobile stepper sticky
                — scroll'da kaybolmasın, kullanıcı her zaman nerede olduğunu
                bilsin. top-16 navbar altında. */}
            <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4 bg-krem/80 backdrop-blur-md py-2">
              <div className="bg-white rounded-xl px-4 py-3 ring-1 ring-gri-200 shadow-1">
                <StepProgress
                  steps={stepLabels}
                  stepIds={stepIds}
                  activeStep={activeStep}
                  completedSet={touchedSteps}
                  onStepClick={scrollToStep}
                />
              </div>
            </div>

            {/* Step 1 — Malzeme (Sefa 18 May v42: hint eklendi) */}
            <FormSection
              id="step-1"
              number={uiStepNumber(1)}
              title={t.config.materialTitle}
              hint={
                locale === "en"
                  ? "Material that the print will be applied on"
                  : "Baskının uygulanacağı malzeme"
              }
              locked={isStepLocked(1)}
              lockMessage={getLockMessage(1)}
            >
              {/* Sefa 18 May v68: sticker'a paralel — 2 → 3 kolon (md+).
                  6 etiket malzemesi 3×2 grid'e oturur, kartlar kompakt
                  + okunur. Mobile 2 kolon korunur. */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
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
                    {/* Sefa 18 May v68 (Sefa feedback): h-14 → aspect-[2/1]
                        SVG native oran (220×110). Distortion/sünme yok,
                        kompozisyon tam görünür. */}
                    <MaterialSwatch
                      surface={m.surface}
                      fallback={m.swatch}
                      className="w-full aspect-[2/1] mb-2.5"
                      label={locale === "en" ? m.name_en : m.name}
                    />
                    {/* Sefa 18 May v68 (Sefa feedback): sağ üst Icon.Info "i"
                        ikonu kaldırıldı — tooltip için zaten title yanında "?"
                        gösterilir. Başlık satırına min-h ekle ki 1 ya da 2
                        satır olsa da içerikler eşit hizada üstten başlasın. */}
                    <div className="font-semibold text-sm inline-flex items-start gap-1.5 min-h-[2.6em] leading-tight">
                      <span>{locale === "en" ? m.name_en : m.name}</span>
                      {"tooltip" in m && m.tooltip ? (
                        <InfoTooltip text={m.tooltip} />
                      ) : null}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                      {locale === "en" ? m.desc_en : m.desc}
                    </div>
                    {/* Opsiyonel uyarı notu (örn kraft) */}
                    {"note" in m && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-saman-koyu font-medium leading-tight">
                        <span aria-hidden>⚠</span>
                        <span>
                          {locale === "en" && "note_en" in m
                            ? (m as { note_en: string }).note_en
                            : (m as { note: string }).note}
                        </span>
                      </div>
                    )}
                  </SelectableCard>
                ))}
              </div>
              <a
                href="/malzemeler#etiket-malzemeleri"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2.5 text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                {locale === "en" ? "Material details" : "Malzeme detayları"}
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
              locked={isStepLocked(2)}
              lockMessage={getLockMessage(2)}
            >
              {/* Sefa 18 May v68: 4 kaplama → 4 kolon tek satır (md+),
                  mobile 2 kolon. Sticker yüzeyiyle aynı kompakt his. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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
                    {/* Sefa 18 May v68: aspect-[2/1] SVG native oran +
                        line-clamp-2 ile desc 2 satır sabit → kart eşit
                        yükseklik */}
                    {/* Sefa 18 May v68: aspect-[2/1] SVG native oran +
                        line-clamp-2 ile desc 2 satır sabit → kart eşit
                        yükseklik. Title min-h ile içerikler üstten başlar. */}
                    <MaterialSwatch
                      surface={c.surface}
                      className="w-full aspect-[2/1] mb-2"
                      label={locale === "en" ? c.name_en : c.name}
                    />
                    <div className="font-semibold text-sm inline-flex items-start gap-1.5 min-h-[2.6em] leading-tight">
                      <span>{locale === "en" ? c.name_en : c.name}</span>
                      {c.tooltip ? <InfoTooltip text={c.tooltip} /> : null}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                      {locale === "en" ? c.desc_en : c.desc}
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
              hint={
                locale === "en"
                  ? "Special layer — combine multiple options"
                  : "Özel katman — birden fazla seçebilirsin"
              }
              locked={isStepLocked(3)}
              lockMessage={getLockMessage(3)}
            >
              {/* Sefa 18 May v68: 4 özelleştirme → 4 kolon (md+).
                  Kompakt + tek satır görünüm. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {CUSTOMS.map((c) => {
                  // Touched değilse görsel olarak seçili göstermeyiz
                  // (Sefa kuralı: varsayılan seçim olmasın).
                  // Sefa 16 May denetim #6: hideCheckmark kaldırıldı —
                  // standart sağ üst rozet Malzeme/Kaplama ile tutarlı.
                  const isSelected =
                    touchedSteps.has(3) && customs.includes(c.id);
                  return (
                    <SelectableCard
                      key={c.id}
                      selected={isSelected}
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
                      {/* Sefa 16 May denetim #6: sol checkbox kaldırıldı,
                          standart SelectableCard sağ üst rozetine geri
                          dönüldü. Malzeme/Kaplama ile tutarlı görsel. */}
                      {/* Sefa 18 May v68: aspect-[2/1] + line-clamp-2 + title min-h */}
                      <MaterialSwatch
                        surface={c.surface}
                        className="w-full aspect-[2/1] mb-2"
                        label={locale === "en" ? c.name_en : c.name}
                      />
                      <div className="font-semibold text-sm inline-flex items-start gap-1.5 min-h-[2.6em] leading-tight">
                        <span>{locale === "en" ? c.name_en : c.name}</span>
                        {c.tooltip ? <InfoTooltip text={c.tooltip} /> : null}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                        {locale === "en" ? c.desc_en : c.desc}
                      </div>
                    </SelectableCard>
                  );
                })}
              </div>

              {customs.includes("yaldiz") && (
                <div className="mt-3 p-3.5 rounded-xl bg-gri-50 ring-1 ring-gri-200">
                  <div className="text-[13px] font-semibold mb-2.5">
                    {locale === "en" ? "Foil color" : "Yaldız rengi"}
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
              locked={isStepLocked(4)}
              lockMessage={getLockMessage(4)}
            >
              {/* Sefa 18 May v46: Kalın guidance — eski alt info kutusunun
                  içeriği üstte vurgulu olarak. */}
              <div className="mb-3.5 text-[13.5px] text-lacivert leading-relaxed">
                {locale === "en" ? (
                  <>
                    Not sure? Pick{" "}
                    <strong className="font-bold text-pim-mercan">
                      Winding 1 (straight)
                    </strong>{" "}
                    — the most common direction.
                  </>
                ) : (
                  <>
                    Emin değilsen{" "}
                    <strong className="font-bold text-pim-mercan">
                      Sarım 1 (düz)
                    </strong>{" "}
                    seç — en yaygın kullanılan yön.
                  </>
                )}
              </div>

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
                    <div key={n} className="relative">
                      {/* Sefa 18 May v68 (UX uzman 2.3): Standart PopulerBadge
                          ile değiştirildi — tüm sayfalarda tek tutarlı rozet. */}
                      {n === 1 && (
                        <PopulerBadge tooltip="En yaygın kullanılan yön" />
                      )}
                      <SelectableCard
                        selected={touchedSteps.has(4) && winding === n}
                        onClick={() => {
                          setWinding(n);
                          markTouched(4);
                        }}
                        padding={10}
                        style={{ textAlign: "center", paddingTop: 12 }}
                        aria-label={`Dışa sarım yön ${n}${n === 1 ? " (önerilen)" : ""}`}
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
                    </div>
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

              {/* Sefa 18 May v46: Alt info kutusu kaldırıldı (vurgulu
                  guidance üstte). */}
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
              locked={isStepLocked(5)}
              lockMessage={getLockMessage(5)}
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
                      <div key={c.id} className="relative">
                        {/* Sefa 18 May v52: 76mm önerilen → yuvarlak mercan
                            standart PopulerBadge (Sefa 18 May v68) */}
                        {c.id === 76 && (
                          <PopulerBadge tooltip="Endüstri standardı (3 inch)" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCoreSize(c.id);
                            markTouched(5);
                          }}
                          aria-pressed={active}
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 ring-1 text-center transition-all",
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
                          </div>
                          <div className="text-[11px] text-gri-700 mt-0.5">
                            {c.desc}
                          </div>
                        </button>
                      </div>
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
                      <div key={q} className="relative">
                        {/* Sefa 18 May v68 (UX uzman 2.3): Standart PopulerBadge */}
                        {q === 500 && (
                          <PopulerBadge tooltip="En yaygın seçim" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setRollLabelCount(q);
                            markTouched(5);
                          }}
                          aria-pressed={active}
                          className={cn(
                            "w-full rounded-xl px-3 py-2.5 ring-1 text-center transition-all",
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
                          </div>
                        </button>
                      </div>
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
              locked={isStepLocked(6)}
              lockMessage={getLockMessage(6)}
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    Genişlik (mm)
                  </span>
                  {/* Sefa 18 May v64: touched değilse value boş gözüksün
                      (kullanıcı bilinçli seçim yapsın) */}
                  <input
                    type="number"
                    value={touchedSteps.has(6) ? width : ""}
                    placeholder="örn. 60"
                    autoComplete="off"
                    onChange={(e) => {
                      setWidth(Math.max(5, Number(e.target.value) || 5));
                      markTouched(6);
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
                    value={touchedSteps.has(6) ? height : ""}
                    placeholder="örn. 80"
                    autoComplete="off"
                    onChange={(e) => {
                      setHeight(Math.max(5, Number(e.target.value) || 5));
                      markTouched(6);
                    }}
                    min={5}
                    max={1470}
                    step={1}
                    className="block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow tabular-nums"
                  />
                </label>
              </div>

              {/* Hızlı boyut chip'leri — Sefa kararı 18 May v49:
                  "En çok tercih edilen ölçüler (mm)" başlığı + güncel liste.
                  Sıralama: küçükten büyüğe (yaklaşık), 15 boyut. */}
              <div className="mt-4">
                <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-2">
                  En çok tercih edilen ölçüler (mm)
                </div>
                <div className="flex gap-2 flex-wrap">
                {[
                  { w: 15, h: 40, label: "15×40" },
                  { w: 20, h: 50, label: "20×50" },
                  { w: 30, h: 30, label: "30×30" },
                  { w: 30, h: 50, label: "30×50" },
                  { w: 40, h: 60, label: "40×60" },
                  { w: 50, h: 50, label: "50×50" },
                  { w: 50, h: 80, label: "50×80" },
                  { w: 50, h: 200, label: "50×200" },
                  { w: 60, h: 120, label: "60×120" },
                  { w: 70, h: 70, label: "70×70" },
                  { w: 80, h: 80, label: "80×80" },
                  { w: 80, h: 100, label: "80×100" },
                  { w: 100, h: 100, label: "100×100" },
                  { w: 100, h: 150, label: "100×150" },
                  { w: 150, h: 200, label: "150×200" },
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
                        markTouched(6);
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
              </div>
            </FormSection>

            {/* Step 7 — Tasarım dosyaları (Sefa kuralı 15 May v3):
                Boyut altına eklenir, max 50 dosya, her biri 30 MB.
                Stepper'a DAHİL (numaralı). Tasarım adedi input ile
                fiyat tier mantığına bağlanabilir (sonraki commit). */}
            <FormSection
              id="step-7"
              number={uiStepNumber(7)}
              title="Tasarımlar"
              hint="Her tasarımdan aynı adet basılır. Çoklu tasarımda otomatik iskonto var."
              locked={isStepLocked(7)}
              lockMessage={getLockMessage(7)}
            >
              <MultiDesignUploader
                designCount={designCount}
                onDesignCountChange={(n) => {
                  setDesignCount(n);
                  markTouched(7);
                }}
                designs={designs}
                onDesignsChange={(d) => {
                  setDesigns(d);
                  markTouched(7);
                }}
                qtyPerDesign={qty}
                productLabel="etiket"
              />
              {designDiscountPct > 0 && (
                <p className="mt-3 text-[12px] text-pim-mercan font-semibold">
                  ✨ {designCount} tasarım için{" "}
                  <strong>%{designDiscountPct} iskonto</strong> uygulanıyor —
                  fiyat kartında görünür
                </p>
              )}
            </FormSection>

            {/* Step 6 — Adet (serbest input + preset chip'ler).
                Hint formFactor'a göre dinamik (rulo 1000+, tabaka 100+). */}
            <FormSection
              id="step-8"
              number={uiStepNumber(8)}
              title="Her tasarımdan kaç adet?"
              hint={
                formFactor === "rulo"
                  ? `${minQty.toLocaleString("tr-TR")}'den başla, ${qtyStep} adetlik artışla seç. Birden fazla tasarım koyarsan her birinden bu adet basılır.`
                  : `${minQty} adetten başla, serbest tam sayı (max ${maxQty.toLocaleString("tr-TR")}). Her tasarımdan ayrı baskı.`
              }
              locked={isStepLocked(8)}
              lockMessage={getLockMessage(8)}
            >
              {/* Sefa 18 May v58: Slider + inline +/− step butonları.
                  Manuel input kutusu kaldırıldı (slider yeterli, kullanıcı
                  istediği değeri sağdaki ok'larla fine tune ediyor). */}
              <div className="px-1">
                <div className="flex items-center justify-between mb-2 gap-3">
                  {/* Sefa 18 May v66: 'adet en alt adetten başlasın'
                      → touched check kaldırıldı, default minQty her zaman gözüküyor */}
                  <span className="text-[28px] font-bold text-lacivert tabular-nums leading-none">
                    {qty.toLocaleString("tr-TR")}
                    <span className="text-[14px] font-medium text-gri-700 ml-1">
                      adet
                    </span>
                  </span>
                  {/* Sefa 18 May v58: Slider yanında +/− ok — fine control */}
                  <div className="inline-flex items-stretch rounded-full ring-1 ring-gri-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setQty((v) => snapQty(v - qtyStep));
                        markTouched(8);
                      }}
                      disabled={qty <= minQty}
                      aria-label={`${qtyStep} adet azalt`}
                      className="w-9 h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      −
                    </button>
                    <span
                      aria-hidden
                      className="w-px bg-gri-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setQty((v) => snapQty(v + qtyStep));
                        markTouched(8);
                      }}
                      disabled={qty >= maxQty}
                      aria-label={`${qtyStep} adet artır`}
                      className="w-9 h-9 grid place-items-center text-base font-semibold text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Sefa 18 May v68 (UX uzman 3.8): Logaritmik tick'ler —
                    25K nerede sorusu artık görsel olarak belli. Eski min/max
                    iki ucundaki label kaldırıldı, tick'ler yeterli. */}
                <QtySlider
                  value={qty}
                  min={minQty}
                  max={maxQty}
                  step={qtyStep}
                  onChange={(v) => {
                    setQty(snapQty(v));
                    markTouched(8);
                  }}
                  ariaLabel="Etiket adedi (slider)"
                  ticks={
                    formFactor === "rulo"
                      ? [1000, 2000, 5000, 10000, 25000, 50000]
                      : [250, 500, 1000, 2500, 5000, 10000]
                  }
                  showTickLabels
                />
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

              {/* Preset chip'leri — popüler nokta atışı */}
              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <span className="text-[11.5px] text-gri-500 mr-1">
                  {t.config.suggested}
                </span>
                {qtyPresets.map((q) => {
                  const active = touchedSteps.has(8) && qty === q;
                  // Sefa 18 May v58: popüler yıldız gösterimi kaldırıldı
                  // Sefa kuralı (15 May v2): binler nokta ile (10.000 not 10K)
                  const label = q.toLocaleString("tr-TR");
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQty(q);
                        markTouched(8);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors tabular-nums",
                        active
                          ? "bg-pim-mercan text-white"
                          : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
                      )}
                    >
                      {label}
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
                  </>
                }
                /* Sefa 18 May v62: İşlem özeti — toplam rulo + toplam adet
                   (caller locale-aware string'ler oluşturur) */
                /* v63: labels kısaltıldı — eyebrow "İşlem özeti" zaten
                   "Toplam" sözünü taşıyor, içeride tekrar gerek yok */
                summaryItems={[
                  ...(rollsNeeded > 0
                    ? [
                        {
                          icon: "📦",
                          label: locale === "en" ? "Roll count" : "Rulo adedi",
                          value: `${rollsNeeded} ${locale === "en" ? "rolls" : "rulo"}`,
                        },
                      ]
                    : []),
                  {
                    icon: "📋",
                    label: locale === "en" ? "Label count" : "Etiket adedi",
                    value: `${totalEtiketCount.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} ${t.cart.unitLabel}`,
                  },
                  ...(designCount > 1
                    ? [
                        {
                          icon: "🎨",
                          label: locale === "en" ? "Designs" : "Tasarım",
                          value: `${designCount}`,
                        },
                      ]
                    : []),
                ]}
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
                /* Sefa 18 May v62: footnote kaldırıldı — KDV bilgisi
                   unitPrice'da, teslim ve özet zaten kart içinde var. */
                footnote={null}
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
                {t.config.stepperSteps}
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
      {/* Bilgi bandı kaldırıldı (Sefa kuralı 15 May v5) */}

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
            {totalEtiketCount.toLocaleString("tr-TR")} etiket
            {designCount > 1 ? ` (${designCount} tasarım)` : ""} · {width}×
            {height}mm · KDV dahil
          </div>
          {/* Sefa 17 May P1-12: tasarım eksik hint */}
          {designs.length === 0 && (
            <div className="text-[10.5px] text-saman-koyu mt-1 truncate">
              📎 Tasarım sonra yüklenecek (3 gün)
            </div>
          )}
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

      {/* Sefa 18 May v60: Sepete eklendi onay pop-up'ı */}
      <AddToCartSuccessModal
        open={cartSuccessOpen}
        onClose={() => setCartSuccessOpen(false)}
        productSummary={cartSuccessSummary}
      />
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
  // Kuşe (yeni 15 May): hafif krem, mat kaplamalı kağıt hissi
  kuse: "linear-gradient(180deg, #FAFAF4 0%, #EDEDE4 100%)",
  // Şeffaf etiket (Sefa 18 May v42): hafif saydam, arka planı gösteren
  seffaf:
    "linear-gradient(180deg, rgba(240,249,255,0.5) 0%, rgba(255,255,255,0.3) 100%)",
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
  const { t, locale } = useT();
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
  // Sefa 18 May v42: seffaf de transparent davranışı alır (ultra gibi)
  const isTransparent = material === "ultra" || material === "seffaf";
  const labelBg = isTransparent
    ? designUrl
      ? ultraCheckerBg
      : "rgba(255,255,255,0.5)"
    : material === "metalik"
      ? "linear-gradient(135deg,#E5E9EE,#FFFFFF,#C7CFD8)"
      : material === "kraft"
        ? "#E8C99B"
        : "white";
  const labelBgSize =
    isTransparent && designUrl
      ? "10px 10px, 10px 10px, 10px 10px, 10px 10px, auto"
      : "auto";
  const labelBgPos =
    isTransparent && designUrl
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
      {/* Sefa 17 May v41: Empty hint overlay kaldırıldı — sabun mockup'ı
          kendi başına yeterli (Olea etiket görseli zaten "burada ne olur"u
          anlatıyor). showEmptyHint prop'u expose edildi ama no-op. */}

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

      {/* Dimension overlay — Sefa 16 May denetim #18:
          Etiket "ÖLÇÜ" idi → sticker ile tutarlı "BOYUT" oldu
          (t.config.dimensionBadge anahtarı, sticker da aynısını kullanır). */}
      <div className="absolute bottom-6 left-6 px-3 py-2 bg-white rounded-lg shadow-1 flex items-center gap-3">
        <div className="text-sm">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            {t.config.dimensionBadge}
          </div>
          <div className="font-semibold">
            {width} × {height} mm
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-6 left-6 px-3 py-1.5 bg-white rounded-full shadow-1 flex items-center gap-1.5 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-yesil" />
        {t.config.livePreviewBadge}
      </div>

      {/* İpucu kartı kaldırıldı — Sefa kuralı (15 May v4):
          Preview canvas temiz kalsın, Pim mascot sadece sağ alt floating
          chat'te (PimChat.tsx). Kullanıcı isterse oradan soru sorar. */}
    </div>
  );
}
