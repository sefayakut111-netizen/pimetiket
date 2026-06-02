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
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSequentialSteps, isStepComplete, findFirstIncompleteStep } from "@/lib/use-sequential-steps";
import {
  focusPendingConfiguratorStep,
  getFirstPendingStepId,
} from "@/lib/configurator-step-highlight";
import { track } from "@/lib/analytics/posthog-events";
import { AddToCartSuccessModal } from "@/components/cart/AddToCartSuccessModal";
import { ClampedNumberInput } from "@/components/ClampedNumberInput";
// Pim mascot import edilmiyor — UX audit (15 May): inline avatar kart
// kaldırıldı, Pim sadece PimChat floating button'da tek tutarlı persona.
import { Icon } from "@/components/Icon";
import { SchemaJsonLd, breadcrumbSchema } from "@/components/SchemaJsonLd";
import {
  FormSection,
  SelectableCard,
  PriceCard,
  Pill,
  QtySlider,
  MaterialSwatch,
  PopulerBadge,
  InfoTooltip,
  Button,
  type DesignTempState,
} from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
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
import {
  type DetectedDimensions,
  detectedDimsTrimHint,
} from "@/lib/design-dimensions";
import { useEditorPrefill } from "@/lib/editor/use-editor-prefill";
import { useT } from "@/lib/i18n/context";
import { useSanitizeEmptyQueryParam } from "@/lib/use-sanitize-empty-query-param";
import {
  quoteCustomerEtiket,
  computeEtiketTierSavings,
  CUSTOMER_ETIKET_TIERS,
  ETIKET_MIN_QTY,
  ETIKET_MAX_QTY,
  ETIKET_QTY_STEP,
  ETIKET_RULO_MIN_W,
  ETIKET_RULO_MIN_H,
  ETIKET_RULO_MAX_W,
  ETIKET_RULO_MAX_H,
  type EtiketMaterialId,
  type EtiketCoatingId,
  type EtiketCustomId,
} from "@/lib/etiket-customer-pricing";
// Sefa 20 May v68 (Aşama B + B+): müşteri gizleme flag'leri
import {
  HIDDEN_ETIKET_MATERIALS,
  HIDDEN_ETIKET_COATINGS,
  SHOW_ETIKET_CUSTOMIZATION_STEP,
  SHOW_ETIKET_CORE_SIZE_PICKER,
  ETIKET_DEFAULT_CORE_SIZE,
  SHOW_ETIKET_FORM_FACTOR_PICKER,
} from "@/lib/etiket-feature-flags";
// Sefa 20 May v68: kart sayısına göre dinamik grid sütun helper
import { gridColsForCount } from "@/lib/grid-cols";
// Faz 2 (Sefa 19 May v68): admin /admin/fiyatlar canlı config → /etiket
// Client-safe import.
import { getLivePricingConfig } from "@/lib/pricing-config-client";
import type { ProfileConfig } from "@/lib/pricing-config-types";
import {
  FALLBACK_ETIKET_RULO_CONFIG,
  FALLBACK_ETIKET_TABAKA_CONFIG,
} from "@/lib/pricing-config-types";
import { getActiveMaterials } from "@/lib/pricing-materials";
import { quoteEtiketFromConfig } from "@/lib/customer-pricing-from-config";
import type { PricebookSnapshot } from "@/lib/pricing-pricebook-types";
import {
  FALLBACK_PRICEBOOK_SNAPSHOT,
  PRICEBOOK_MAX_QTY,
} from "@/lib/pricing-pricebook-types";
import { isPricebookMode } from "@/lib/pricing-pricebook";
import { deriveScopeFromProduct } from "@/lib/pricing-calc";
import {
  TABAKA_USABLE_H,
  TABAKA_USABLE_W,
} from "@/lib/pricing-engine/constants";
import {
  addToCustomerCart,
  removeFromCustomerCart,
  listCustomerCart,
} from "@/lib/customer-cart";
import { loadEditIntent, clearEditIntent } from "@/lib/cart-edit-intent";
import { quantizeForCart } from "@/lib/pricing-quantize";
import { buildSummaryItems } from "@/lib/order-summary";
import { ProductReviews } from "@/components/reviews/ProductReviews";
// Sefa 18 May v68: ProductInfoSection kaldırıldı (3 feature söylemi gereksiz)
// import { ProductInfoSection } from "@/components/ProductInfoSection";
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

/** Slider tick adayları — maxQty (pricebook vb.) ile filtrelenir */
const RULO_QTY_TICK_CANDIDATES = [
  1000, 5000, 10000, 15000, 20000, 25000,
] as const;
const TABAKA_QTY_TICK_CANDIDATES = [
  250, 500, 1000, 2500, 5000, 10000,
] as const;

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
  // Sefa 21 May v68 (ürün denetim P1 #12): binlik ayraç tutarlı (1.000)
  if (qty < 2000) return { msg: "+1.000 adet ekle, %4 daha tasarruf", to: 2000 };
  if (qty < 5000) return { msg: "5.000'e çık, %6 daha tasarruf", to: 5000 };
  if (qty < 10000) return { msg: "10.000'e çık, %6 daha tasarruf", to: 10000 };
  if (qty < 20000) return { msg: "20.000'e çık, %7 daha tasarruf", to: 20000 };
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
 *  Rulo (9 adım, form factor picker kapalıysa 8):
 *   Malzeme → Kaplama → Özelleştirme → Tasarım → Boyut → Adet →
 *   Sarım yönü → Sarım detayı
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
// Sefa 20 May v68 (Aşama B+/sequential lock fix):
//   - SHOW_ETIKET_FORM_FACTOR_PICKER=false → Step 0 çıkar
//   - SHOW_ETIKET_CUSTOMIZATION_STEP=false → Step 3 çıkar (gizli, ASLA
//     touched olmaz, sequential lock sonraki step'leri ASLA açmaz idi).
//   Stepper ve useSequentialSteps gizli step'leri görmemeli.
// Sefa 21 May v68: Adet tasarımdan sonra (fiyat/iskonto). Sarım adet altında.
//   Tasarım (7) → Boyut (6) → Adet (8) → Sarım Yönü (4) → Sarım Detayı (5)
// stepIds lock zinciri DOM ile aynı: … → 7 → 6 → 8 → 4 → 5. Tasarım opsiyonel.
const OPTIONAL_DESIGN_STEP = 7;
const STEP_IDS_FULL: readonly number[] = (() => {
  const ids: number[] = [];
  if (SHOW_ETIKET_FORM_FACTOR_PICKER) ids.push(0);
  ids.push(1, 2);
  if (SHOW_ETIKET_CUSTOMIZATION_STEP) ids.push(3);
  ids.push(7, 6, 8, 4, 5);
  return ids;
})();
const STEP_IDS_TABAKA: readonly number[] = SHOW_ETIKET_FORM_FACTOR_PICKER
  ? [0, 1, 2, 7, 6, 8]
  : [1, 2, 7, 6, 8];

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

const ETIKET_STEP_NAMES: Record<number, string> = {
  0: "form_factor",
  1: "material",
  2: "coating",
  3: "customization",
  4: "winding_direction",
  5: "winding_detail",
  6: "size",
  8: "quantity",
  7: "design",
};

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");
/**
 * Birim fiyat formatlama — smart precision.
 *
 * Audit 15 May (Sefa raporu): "2,32 ₺/adet × 2.000 = 4.640 ₺ ama
 * gösterilen 4.631 ₺ → 9 ₺ diskrepans". Kök: birim fiyat aslında
 * 2,3155 ama toFixed(2) ile 2,32'ye yuvarlanıyor → müşteri matematiği
 * tutturamıyor → güven kaybı.
 *
 * Çözüm: 2 ondalık matematik tutturuyorsa 2 göster (örn 2,50 exact),
 * yoksa 4 ondalık göster (örn 2,3155). Müşteri kalkulatöre vurunca
 * unit × qty = total tam tutar.
 */
/** Sefa 18 May v68 (UX uzman 3.7): Birim fiyatlar 2 ondalığa yuvarlandı.
 *  "2,5079 ₺" → "2,51 ₺" — 4 basamak okunaklılığı bozuyordu, kuruş
 *  hassasiyeti (2 ondalık) Türk müşterisi için yeterli ve standart. */
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

// Sefa 20 May v68 (Konfigüratör reform Aşama A + C):
// /etiket grid sayfasından gelen URL query param'larını okur.
// URL: /etiket/yapilandir?form=rulo&shape=square
//   - form: "rulo" | "tabaka" → formFactor pre-fill
//   - shape: dinamik boyut input için (kare/daire = orantı kilitli tek input)
function readInitialFormFactor(searchParams: URLSearchParams): FormFactor {
  const form = searchParams.get("form");
  if (form === "tabaka") return "tabaka";
  return "rulo"; // varsayılan + bilinmeyen değerlerde
}

/** Etiket şekli — Aşama A grid kartlarından gelen değerler.
 *  Sefa 20 May v68: "rounded" kaldırıldı; kare/dikdörtgen içinde
 *  cornerStyle ayrı state olarak yönetilir (Düz / Yumuşak). */
type EtiketShape =
  | "diecut"
  | "clear"
  | "circle"
  | "square"
  | "rectangle"
  | "oval"
  | "sheet";

const VALID_SHAPES: readonly EtiketShape[] = [
  "diecut",
  "clear",
  "circle",
  "square",
  "rectangle",
  "oval",
  "sheet",
];

/** Köşe stili — yalnız kare/dikdörtgen için. */
type CornerStyle = "sharp" | "rounded";

function readInitialShape(searchParams: URLSearchParams): EtiketShape {
  const shape = searchParams.get("shape");
  // Sefa 20 May v68 geri uyumluluk: eski "?shape=rounded" link'leri
  // "rectangle"'a yönlendirilir (cornerStyle 'rounded' olarak ayarlanır).
  if (shape === "rounded") return "rectangle";
  // Sefa 21 May v68 (ürün denetim P1 #6): "clear" bir şekil değil malzeme.
  // ?shape=clear gelse formu rectangle yap, material'ı readInitialMaterial
  // üstlensin (seffaf).
  if (shape === "clear") return "rectangle";
  if (shape && (VALID_SHAPES as readonly string[]).includes(shape)) {
    return shape as EtiketShape;
  }
  return "rectangle"; // varsayılan: mevcut davranış (2 input)
}

/** Sefa 21 May v68 (ürün denetim P1 #6 + #8): ?shape=clear ile gelen
 *  müşteri "Şeffaf Rulo Etiket" sayfasından geldi → material default
 *  "seffaf" olsun (kullanıcı el ile değişene kadar). */
function readInitialMaterial(searchParams: URLSearchParams): EtiketMaterialId | null {
  const shape = searchParams.get("shape");
  if (shape === "clear") return "seffaf";
  const mat = searchParams.get("material");
  if (mat === "kuse" || mat === "kraft" || mat === "beyaz" || mat === "seffaf" || mat === "ultra") {
    return mat;
  }
  return null;
}

/** ?corner=rounded → rounded, varsayılan sharp.
 *  Eski "?shape=rounded" link'lerinde de cornerStyle otomatik rounded. */
function readInitialCornerStyle(searchParams: URLSearchParams): CornerStyle {
  if (searchParams.get("corner") === "rounded") return "rounded";
  if (searchParams.get("shape") === "rounded") return "rounded";
  return "sharp";
}

/** Şekil tek değer mi gerektiriyor (kare/daire) — orantı kilidi */
function isSingleDimensionShape(shape: EtiketShape): boolean {
  return shape === "square" || shape === "circle";
}

/** Şekil köşe stili destekliyor mu (kare/dikdörtgen) */
function supportsCornerStyle(shape: EtiketShape): boolean {
  return shape === "square" || shape === "rectangle";
}

/** Şekil etiketi — TR/EN, PriceCard özeti + cart config string için */
// Sefa 21 May v68 (ürün denetim P1 #7): liste sayfasında "Özel Kesim Rulo
// Etiket" (Title Case), konfigüratörde "Özel kesim Rulo Etiket" küçük
// "kesim" idi — Title Case birleştirildi (tüm shape adları kelime başı büyük).
function shapeLabel(shape: EtiketShape, locale: string): string {
  const isEn = locale === "en";
  switch (shape) {
    case "diecut":
      return isEn ? "Die-Cut" : "Özel Kesim";
    case "clear":
      return isEn ? "Rectangle" : "Dikdörtgen";
    case "circle":
      return isEn ? "Circle" : "Yuvarlak";
    case "square":
      return isEn ? "Square" : "Kare";
    case "rectangle":
      return isEn ? "Rectangle" : "Dikdörtgen";
    case "oval":
      return isEn ? "Oval" : "Oval";
    case "sheet":
      return isEn ? "Sheet" : "Tabaka";
  }
}

/** Köşe stili etiketi — sadece kare/dikdörtgen için anlamlı */
function cornerLabel(corner: CornerStyle, locale: string): string {
  const isEn = locale === "en";
  if (corner === "rounded") return isEn ? "Rounded corner" : "Yumuşak köşe";
  return isEn ? "Sharp corner" : "Düz köşe";
}

// Suspense boundary için: useSearchParams Next 16'da Suspense ister.
export default function EtiketPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gri-50" />}>
      <EtiketPage />
    </Suspense>
  );
}

function EtiketPage() {
  const toast = useToast();
  const { t, locale, hydrated } = useT();
  const searchParams = useSearchParams();
  useSanitizeEmptyQueryParam("form");
  // Sefa kuralları (15 May v2):
  //  - Varsayılan: Kuşe Etiket + Kaplama yok (1. sıra)
  //  - Adet: minimum'dan başlasın (rulo→1000, tabaka→250)
  // Sefa 20 May v68 (Aşama A + C): URL'den form + shape param oku, pre-fill
  // Sefa 21 May v68 (site denetim P0 #2): useSearchParams hook'unu initial
  // state'te kullan — `typeof window` kontrolü SSR'da search param'ı
  // gönderiyordu boş ve default ("rectangle Rulo Etiket") hidration flash
  // ediyordu, sonra useEffect ile düzelirken kullanıcı yanlış başlık
  // görüyordu. Hook initial render'da doğru değeri verir.
  const initialParams = new URLSearchParams(searchParams.toString());

  useEffect(() => {
    track("configurator_started", { product: "etiket" });
  }, []);

  const [formFactor, setFormFactor] = useState<FormFactor>(() =>
    readInitialFormFactor(initialParams)
  );
  const [shape, setShape] = useState<EtiketShape>(() =>
    readInitialShape(initialParams)
  );
  const [cornerStyle, setCornerStyle] = useState<CornerStyle>(() =>
    readInitialCornerStyle(initialParams)
  );
  // searchParams değişirse (client-side nav) sync — kullanıcı farklı karttan
  // yeni girerse formFactor + shape + cornerStyle yeniden eşleşir
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    setShape(readInitialShape(params));
    const corner = params.get("corner");
    if (corner === "rounded" || corner === "sharp") {
      setCornerStyle(corner);
    } else if (params.get("shape") === "rounded") {
      setCornerStyle("rounded");
    }
  }, [searchParams]);
  const [material, setMaterial] = useState<EtiketMaterialId>(
    () => readInitialMaterial(initialParams) ?? "kuse"
  );
  const [coating, setCoating] = useState<EtiketCoatingId>("yok");

  // Sefa 21 May v68 (sistem denetim #4): shape kare/yuvarlak'a geçince
  // height'i width ile eşitle — kullanıcı boyut adımına geçmeden default
  // tutarlı (60×60 yerine 60×80 görünme bug fix).
  useEffect(() => {
    if (shape === "square" || shape === "circle") {
      if (width !== height) {
        setHeight(width);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  // Faz 2 (Sefa 19 May v68): admin /admin/fiyatlar live_config
  //   - formFactor değişince scope (etiket_rulo vs etiket_tabaka) yeniden çek
  //   - Material/Coating/Customization name+desc admin'den öncelikli
  //   - Fiyat hesabı quoteEtiketFromConfig'le (config varsa)
  const [adminConfig, setAdminConfig] = useState<ProfileConfig | null>(null);
  const [pricebookSnapshot, setPricebookSnapshot] =
    useState<PricebookSnapshot>(FALLBACK_PRICEBOOK_SNAPSHOT);
  useEffect(() => {
    let cancelled = false;
    const scope = deriveScopeFromProduct("etiket", formFactor);
    setAdminConfig(null);
    void getLivePricingConfig(scope).then((cfg) => {
      if (!cancelled) setAdminConfig(cfg);
    });
    if (formFactor === "rulo") {
      void fetch("/api/public/pricebook", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { ok?: boolean; snapshot?: PricebookSnapshot }) => {
          if (!cancelled && j.ok && j.snapshot) setPricebookSnapshot(j.snapshot);
        })
        .catch(() => {
          /* fallback snapshot kalir */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [formFactor]);

  /** Admin live_config'ten name/desc override helper.
   *  bucket: "material" | "coating" | "customization"
   *  fallback: i18n string (locale === "en" ? *_en : *) */
  const adminText = (
    bucket: "material" | "coating" | "customization",
    id: string,
    field: "name" | "desc"
  ): string | undefined => {
    if (!adminConfig) return undefined;
    if (bucket === "material") {
      return adminConfig.materials.find((m) => m.id === id)?.[field];
    }
    return adminConfig.options?.[bucket]?.items.find((i) => i.id === id)?.[
      field
    ];
  };

  /** Sefa 19 May v68: admin'in ↑↓ ile belirlediği sıralama.
   *  Admin config varsa o sırayla, yoksa modül const sırasıyla.
   *
   *  Sefa 20 May v68 (graceful fallback fix):
   *  Admin'de eksik kalan veya ID typo'lu (örn 'spot_uv' vs 'spotuv')
   *  module id'leri SİLİNMEZ — sıralanmış admin id'lerinin SONUNA
   *  eklenir. Kapalı set yaklaşımı: müşteri sayfasında tüm hardcoded
   *  seçenekler her zaman görünür, admin sadece sıralama + name/desc
   *  değiştirir.
   */
  const orderedIds = <T extends string>(
    moduleIds: readonly T[],
    bucket: "materials" | "coating" | "customization"
  ): readonly T[] => {
    const adminIds =
      bucket === "materials"
        ? getActiveMaterials(adminConfig).map((m) => m.id)
        : adminConfig?.options?.[bucket]?.items.map((i) => i.id);
    if (!adminIds || adminIds.length === 0) return moduleIds;
    const filtered = adminIds.filter((id) =>
      (moduleIds as readonly string[]).includes(id)
    ) as T[];
    // Module'da olup admin'de olmayan id'leri SONA EKLE (graceful fallback)
    const missing = moduleIds.filter((id) => !filtered.includes(id));
    return [...filtered, ...missing];
  };
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
  // Sefa 21 May v68 (ürün denetim P2 #18): tabaka modunda default qty 1000
  // → 250 (formFactor=tabaka URL'inden gelen kullanıcı için min seviye).
  const [qty, setQty] = useState<number>(() =>
    readInitialFormFactor(initialParams) === "tabaka"
      ? ETIKET_TABAKA_MIN_QTY
      : ETIKET_MIN_QTY
  );
  // Sefa 21 May v68 (sistem denetim #4): shape="square"/"circle" iken
  // default eş kenar (60×60). Eski 60×80 (dikdörtgen) yuvarlak/kare
  // ürününde kafa karıştırıyordu.
  const [width, setWidth] = useState<number>(60);
  const [height, setHeight] = useState<number>(() => {
    const initShape = readInitialShape(initialParams);
    return initShape === "square" || initShape === "circle" ? 60 : 80;
  });
  // Sefa 18 May v68 (CRO denetim — Preset feedback fix):
  // Preset chip tıklanınca input'lara 700ms pulse animasyonu — kullanıcı
  // değişikliği fark etsin. Eski versiyon: input doldu ama görsel feedback
  // yoktu, "preset bastım mı manuel girdim mi belirsiz" şikayeti.
  const [presetPulseAt, setPresetPulseAt] = useState<number | null>(null);
  // Tasarım adedi — kullanıcı kaç farklı tasarım göndereceğini söyler.
  // Max 50 (yüklenen dosya sayısı ile uyumsuzsa uyarı).
  const [designCount, setDesignCount] = useState<number>(1);
  // Pre-purchase tasarım — Sefa kuralı (15 May v6):
  // Sticker'daki MultiDesignUploader pattern'i etikette de kullanılıyor.
  // PendingDesign local-only (Supabase upload yok), sipariş sonrası
  // detay sayfasından gerçek upload yapılır.
  // designs[0] mockup preview için primary, diğerleri metadata.
  const [designs, setDesigns] = useState<PendingDesign[]>([]);
  const editorCutlineDraftIdRef = useRef<string | undefined>(undefined);
  const editorDesignRef = useRef<DesignTempState | null>(null);
  useEditorPrefill({
    onDesign: (d) => {
      editorDesignRef.current = d;
    },
    onDimensions: (w, h) => {
      setWidth(w);
      setHeight(h);
    },
    onCutlineDraftId: (id) => {
      editorCutlineDraftIdRef.current = id;
    },
    toastInfo: toast.info,
  });
  const primaryDesign = designs[0] ?? null;
  const [detectedDims, setDetectedDims] = useState<DetectedDimensions | null>(
    null
  );
  const [dimsPromptShown, setDimsPromptShown] = useState(false);
  const [dimsAccepted, setDimsAccepted] = useState(false);

  // Sefa 20-21 May v68 test #3: Sepetten "Düzenle" — URL ?edit=ID + cart
  // lookup + localStorage intent fallback. State restore + editingItemId
  // ile "Sepete Ekle"de eski item silinir (replace pattern).
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    if (editingItemId === editId) return; // zaten uygulandı

    const items = listCustomerCart();
    let it = items.find((i) => i.id === editId);
    if (!it) {
      const intent = loadEditIntent();
      if (intent && intent.editingItemId === editId) it = intent.item;
    }
    if (!it || it.product !== "etiket") return;

    if (it.materialId) setMaterial(it.materialId as EtiketMaterialId);
    if (it.coatingId) setCoating(it.coatingId as EtiketCoatingId);
    const itemFormFactor =
      (it.meta?.formFactor as FormFactor | undefined) ?? "rulo";
    setFormFactor(itemFormFactor);
    if (it.width) setWidth(it.width);
    if (it.height) setHeight(it.height);
    if (it.winding) setWinding(it.winding);
    if (it.coreSize) setCoreSize(it.coreSize);
    if (it.rollLabelCount) setRollLabelCount(it.rollLabelCount);
    const designCnt = it.designCount ?? 1;
    const minForItem =
      itemFormFactor === "tabaka" ? ETIKET_TABAKA_MIN_QTY : ETIKET_MIN_QTY;
    setQty(Math.max(minForItem, Math.round(it.qty / designCnt)));
    if (designCnt > 1) setDesignCount(designCnt);

    // Tüm adımları touched işaretle (lock guard düşmesin)
    setTouchedSteps(new Set([1, 2, 3, 4, 5, 6, 7, 8]));

    setEditingItemId(editId);
    clearEditIntent();
  }, [searchParams, editingItemId]);

  // Sefa 18 May v68 (5): 3D / Eskiz toggle state
  const [previewView, setPreviewView] = useState<PreviewView>("3d");

  // Touched steps — kullanıcı bir adımda seçim yaptıysa o FormSection
  // numarası set'e eklenir (1=Malzeme, 2=Kaplama, 3=Özellik, 4=Sarım,
  // 5=Sarım detayı, 6=Boyut, 7=Tasarım, 8=Adet). Audit (15 May, Sefa):
  // "seçim yaptıkça çalışmıyor". Scroll-based active + touch-based done.
  // Sefa 15 May v4: varsayılan seçim de touched değilse görsel seçili
  // değil. Form factor için ayrı flag: formFactorTouched.
  // Sefa 21 May v68 (konfigüratör denetim #2 + #10 — kendi bug fix'i):
  // touchedSteps SADECE kullanıcı seçimleri (TAMAM yeşil onay için).
  // URL pre-fill'den gelen adımlar unlockedSteps'e gider (lock açılır
  // ama TAMAM göstermez).
  const [touchedSteps, setTouchedSteps] = useState<Set<number>>(
    () => new Set()
  );
  const unlockedSteps = useMemo(() => {
    const set = new Set<number>();
    if (searchParams.get("material") || searchParams.get("shape") === "clear") {
      set.add(1);
    }
    // shape URL boyut state'ini pre-fill eder (readInitialShape) ama
    // unlockedSteps'e eklenmez — aksi halde Adet (8) erken açılıyordu.
    return set;
  }, [searchParams]);
  // Sefa 20 May v68 (Aşama B+): Form factor picker gizliyse müşteri URL'den
  // pre-fill ile zaten geldi → formFactorTouched her zaman true varsay (Step 1
  // Malzeme locked kalmasın). Picker açıksa eski davranış: kullanıcı seçmeli.
  const [formFactorTouched, setFormFactorTouched] = useState(
    !SHOW_ETIKET_FORM_FACTOR_PICKER
  );
  // Sefa 18 May v60: Sepete eklendi pop-up'ı (toast yerine modal)
  const [cartSuccessOpen, setCartSuccessOpen] = useState(false);
  const [cartAdding, setCartAdding] = useState(false);
  const [cartSuccessSummary, setCartSuccessSummary] = useState<string>("");
  const [noDesignModalOpen, setNoDesignModalOpen] = useState(false);
  const bypassNoDesignConfirmRef = useRef(false);
  const markTouched = useCallback((n: number, value?: string | number) => {
    setTouchedSteps((prev) => {
      if (prev.has(n)) return prev;
      const next = new Set(prev);
      next.add(n);
      return next;
    });
    const step = ETIKET_STEP_NAMES[n];
    if (step) {
      track("configurator_step", {
        product: "etiket",
        step,
        ...(value != null ? { value } : {}),
      });
    }
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
      setTouchedSteps(new Set(SHOW_ETIKET_FORM_FACTOR_PICKER ? [0] : []));
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

  // URL ?form= değişince picker ile aynı reset (grid navigasyonu)
  useEffect(() => {
    const form = searchParams.get("form");
    if (form !== "rulo" && form !== "tabaka") return;
    if (form !== formFactor) {
      handleFormFactorChange(form);
    }
  }, [searchParams, formFactor, handleFormFactorChange]);

  // Adım etiketleri + DOM id mapping — tabaka modunda Özellik/Sarım yok.
  // Sefa 16 May denetim #1: i18n — labels artık t.etiket.step*'ten geliyor.
  // Sefa 20 May v68 (Aşama B+/sequential lock fix):
  //   - SHOW_ETIKET_FORM_FACTOR_PICKER=false → stepFormFactor çıkar
  //   - SHOW_ETIKET_CUSTOMIZATION_STEP=false → stepFeature çıkar
  //   STEP_IDS_FULL ile birebir eşleşmeli, yoksa sequential lock kırılır.
  // stepIds DOM sırası: … Tasarım → Boyut → Adet → Sarım Yönü → Sarım detayı.
  const STEP_LABELS_FULL_I18N: readonly string[] = (() => {
    const labels: string[] = [];
    if (SHOW_ETIKET_FORM_FACTOR_PICKER) labels.push(t.etiket.stepFormFactor);
    labels.push(t.etiket.stepMaterial, t.etiket.stepCoating);
    if (SHOW_ETIKET_CUSTOMIZATION_STEP) labels.push(t.etiket.stepFeature);
    labels.push(
      t.etiket.stepDesign,
      t.etiket.stepSize,
      t.etiket.stepQty,
      t.etiket.stepWinding,
      t.etiket.stepWindingDetail
    );
    return labels;
  })();
  const STEP_LABELS_TABAKA_I18N: readonly string[] = SHOW_ETIKET_FORM_FACTOR_PICKER
    ? [
        t.etiket.stepFormFactor,
        t.etiket.stepMaterial,
        t.etiket.stepCoating,
        t.etiket.stepDesign,
        t.etiket.stepSize,
        t.etiket.stepQty,
      ]
    : [
        t.etiket.stepMaterial,
        t.etiket.stepCoating,
        t.etiket.stepDesign,
        t.etiket.stepSize,
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
  const stepComplete = useCallback(
    (stepId: number) => isStepComplete(stepId, touchedSteps, unlockedSteps),
    [touchedSteps, unlockedSteps]
  );

  const { isLocked: isStepLocked, lockMessage: getLockMessage } =
    useSequentialSteps({
      stepIds,
      stepLabels,
      touchedSteps,
      unlockedSteps,
      optionalStepIds: new Set([OPTIONAL_DESIGN_STEP]),
      prerequisiteForFirst: formFactorTouched,
      locale,
    });

  // Adet sınırları formFactor'a göre değişir (Sefa kuralı 15 May).
  const minQty =
    formFactor === "rulo" ? ETIKET_MIN_QTY : ETIKET_TABAKA_MIN_QTY;
  const pricingConfig =
    adminConfig ??
    (formFactor === "tabaka"
      ? FALLBACK_ETIKET_TABAKA_CONFIG
      : FALLBACK_ETIKET_RULO_CONFIG);
  const pricebookActive =
    formFactor === "rulo" && isPricebookMode(pricingConfig);
  const maxQty =
    formFactor === "rulo"
      ? pricebookActive
        ? Math.min(ETIKET_MAX_QTY, PRICEBOOK_MAX_QTY)
        : ETIKET_MAX_QTY
      : ETIKET_TABAKA_MAX_QTY;
  const qtyStep =
    formFactor === "rulo" ? ETIKET_QTY_STEP : ETIKET_TABAKA_QTY_STEP;
  const snapQty = formFactor === "rulo" ? snapEtiketQty : snapTabakaQty;
  const qtySliderTicks = (
    formFactor === "rulo" ? RULO_QTY_TICK_CANDIDATES : TABAKA_QTY_TICK_CANDIDATES
  ).filter((t) => t >= minQty && t <= maxQty);
  // Faz 2 (Sefa 19 May v68): adminConfig.tiers > ETIKET_PRESETS/ETIKET_TABAKA_PRESETS
  const qtyPresets: readonly number[] = adminConfig?.tiers
    ? [...adminConfig.tiers]
        .sort((a, b) => a.qty - b.qty)
        .map((t) => t.qty)
    : formFactor === "rulo"
      ? ETIKET_PRESETS
      : ETIKET_TABAKA_PRESETS;
  const popularPreset =
    formFactor === "rulo"
      ? ETIKET_POPULAR_PRESET
      : ETIKET_TABAKA_POPULAR_PRESET;

  const sizeMinW = formFactor === "rulo" ? ETIKET_RULO_MIN_W : 5;
  const sizeMinH = formFactor === "rulo" ? ETIKET_RULO_MIN_H : 5;
  const sizeMaxW =
    formFactor === "rulo" ? ETIKET_RULO_MAX_W : TABAKA_USABLE_W;
  const sizeMaxH =
    formFactor === "rulo" ? ETIKET_RULO_MAX_H : TABAKA_USABLE_H;
  const sizeMinEqual =
    formFactor === "rulo"
      ? Math.max(ETIKET_RULO_MIN_W, ETIKET_RULO_MIN_H)
      : 5;
  const sizeMaxEqual =
    formFactor === "rulo"
      ? Math.min(ETIKET_RULO_MAX_W, ETIKET_RULO_MAX_H)
      : Math.min(TABAKA_USABLE_W, TABAKA_USABLE_H);

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

  // Faz 2: admin live_config varsa kullan, yoksa eski engine fallback.
  // Bridge null dönerse (config eksik / material ID admin'de yok) eski engine.
  const etiketQuoteInput = {
    width,
    height,
    qty,
    material,
    coating,
    customization: primaryCustom,
    customizations: customs,
  };
  const quote =
    quoteEtiketFromConfig(pricingConfig, etiketQuoteInput, {
      formFactor,
      pricebookSnapshot:
        formFactor === "rulo" ? pricebookSnapshot : undefined,
    }) ??
    (formFactor === "rulo"
      ? quoteCustomerEtiket(etiketQuoteInput)
      : {
          ok: false as const,
          reason: "Tabaka fiyatı hesaplanamadı — boyutu kontrol edin.",
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
  // Sefa 20 May v68 test (fiyat tutarsızlığı fix): quantizeForCart ile
  // konfigüratör hesabı sepetle tutarlı (unit × qty linear). Detay:
  // src/lib/pricing-quantize.ts
  const _rawUnitWithDiscount = rawUnit * designDiscountFactor;
  const _quantizedEtiket = quantizeForCart(_rawUnitWithDiscount, totalEtiketCount);
  const total = _quantizedEtiket.total;
  const unit = _quantizedEtiket.unit;
  // Backward-compat (raw değerler) — display'de kullanılmıyor ama
  // referans olarak kalsın
  void rawTotal;

  // Tier savings — 1K (min) baseline ile karşılaştır
  const tierSavings = quote.ok
    ? computeEtiketTierSavings({ width, height, material, coating, customization: primaryCustom, customizations: customs }, minQty, qty)
    : 0;

  const quoteError = !quote.ok ? quote.reason : null;

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

  const optionalConfiguratorSteps = useMemo(
    () => new Set([OPTIONAL_DESIGN_STEP]),
    []
  );
  const firstPendingStepId = useMemo(
    () =>
      getFirstPendingStepId(stepIds, touchedSteps, optionalConfiguratorSteps),
    [stepIds, touchedSteps, optionalConfiguratorSteps]
  );
  const focusPendingStep = useCallback(() => {
    if (firstPendingStepId == null) return;
    focusPendingConfiguratorStep(firstPendingStepId, scrollToStep, stepIds);
  }, [firstPendingStepId, scrollToStep, stepIds]);

  // Sepete ekle — hem PriceCard hem sticky bar tetikler.
  // Sefa kuralı (15 May v2): max 50 tasarım. Şu an cart item modeli tek
  // tasarım bağlar → designs[0] cart'a, designs[1..N] design_metadata
  // alanına serileştirilir (cart genişlemesi sonraki commit'te).
  const handleAddToCart = useCallback(async () => {
    if (cartAdding) return;
    // Sefa 20 May v68: zorunlu step kontrolü — touched değilse o adıma
    // scroll + flash + toast. Tasarım step (7) opsiyonel (sonra yükleme
    // akışı aktif).
    const OPTIONAL_STEPS = new Set([7]);
    const missingStepId = findFirstIncompleteStep(stepIds, touchedSteps, {
      optionalStepIds: OPTIONAL_STEPS,
    });
    if (missingStepId != null) {
      const idx = stepIds.indexOf(missingStepId);
      const label = stepLabels[idx] ?? "önceki";
      toast.error(
        locale === "en"
          ? `Complete "${label}" first.`
          : `Önce "${label}" adımını seç.`
      );
      focusPendingConfiguratorStep(missingStepId, scrollToStep, stepIds);
      return;
    }
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
    // Sefa 17 May P1-12: tasarım yüklemeden sepete ekle akışı net opt-in.
    // Eski "policy: ödeme sonrası 3 gün" gizliydi → cart title'da açık
    // göster ki müşteri sepete bakınca "tasarımı yüklemem lazım" anlasın.
    const hasNoDesign = designs.length === 0;

    if (
      designCount > 1 &&
      designs.length > 0 &&
      designs.length < designCount
    ) {
      toast.error(
        `${designCount} tasarım seçtin ama ${designs.length} dosya yükledin. Eksik dosyaları yükle veya tasarım sayısını düşür.`
      );
      return;
    }

    // Sefa 22 May v68 — C sorun fix: tasarımsız sepete ekle BİLİNÇLİ
    // olsun. Modal yok, native confirm yeterli (hızlı, mobile uyumlu).
    // Bilinçsiz "atlama" sonucu awaiting_upload sipariş açılmasını önler.
    if (hasNoDesign && !bypassNoDesignConfirmRef.current) {
      setNoDesignModalOpen(true);
      return;
    }
    bypassNoDesignConfirmRef.current = false;

    setCartAdding(true);
    try {
    const { prepareDesignsForCart } = await import(
      "@/lib/cart/prepare-designs-for-cart"
    );
    const {
      persistedDesigns,
      resolvedDesignTempId,
      resolvedPreviewUrl: _resolvedPreviewUrl,
      additionalDesigns,
      uploadFailed,
    } = await prepareDesignsForCart(
      designs,
      editorDesignRef.current ?? undefined
    );
    const primaryPersisted = persistedDesigns[0];
    if (uploadFailed) {
      toast.error(
        "Tasarım sunucuya yüklenemedi — giriş yapıp tekrar dene."
      );
      return;
    }

    const result = await addToCustomerCart({
      product: "etiket",
      title: `Etiket · ${matName} + ${coatName}${
        designCount > 1 ? ` (${designCount} tasarım)` : ""
      }${hasNoDesign ? " · 📎 Tasarım sonra yüklenecek" : ""}`,
      config: `${shapeLabel(shape, "tr")}${supportsCornerStyle(shape) ? ` (${cornerLabel(cornerStyle, "tr").toLowerCase()})` : ""} · ${width}×${height}mm · ${qty.toLocaleString("tr-TR")} adet · ${custName}${customSuffix}${formFactor === "rulo" ? ` · Sarım ${winding} · Göbek ${coreSize}mm · ${rollLabelCount} adet/rulo` : ""}${designCountSuffix}`,
      width,
      height,
      qty: totalEtiketCount, // toplam etiket = qty × designCount
      unit: parseFloat(unit.toFixed(2)),
      total: Math.round(total),
      materialId: material,
      coatingId: coating,
      customizationId: primaryCustom,
      meta: {
        customizations: customs.filter((id) => id !== "yok"),
        formFactor,
        designCount,
        ...(editorCutlineDraftIdRef.current
          ? { editorCutlineDraftId: editorCutlineDraftIdRef.current }
          : {}),
      },
      winding,
      // Sefa 21 May v68 Mig 073: rulo göbek + adet/rulo structured kayıt
      // (eskiden sadece config string'inde tutuluyordu, sipariş detay özet
      // için yapılandırılmış kayıt gerekli — order-summary.ts helper).
      coreSize: formFactor === "rulo" ? coreSize : undefined,
      rollLabelCount: formFactor === "rulo" ? rollLabelCount : undefined,
      designTempId: resolvedDesignTempId,
      // Sefa 20 May v68 (test): persistDesignPreview ile kalıcı Supabase URL
      designPreviewUrl: _resolvedPreviewUrl,
      designFileName: primaryPersisted?.name,
      designMimeType: primaryPersisted?.mimeType,
      // Multi-design metadata (Sefa 15 May v6): designCount + ek dosyalar
      // (primary hariç — sepet badge doğru sayı göstersin).
      designCount: designCount > 1 ? designCount : undefined,
      additionalDesigns,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    // Sefa 20 May v68 test #3: Düzenle akışı — yeni item eklendi, eski item
    // sepetten silinir (replace pattern). editingItemId null'a çek.
    if (editingItemId) {
      await removeFromCustomerCart(editingItemId);
      setEditingItemId(null);
    }
    // PendingDesign local-preview blob URL'lerini revoke et (memory leak yok)
    designs.forEach((d) => {
      if (d.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(d.previewUrl);
      }
      if (
        d.generatedPreviewUrl &&
        d.generatedPreviewUrl.startsWith("blob:") &&
        d.generatedPreviewUrl !== d.previewUrl
      ) {
        URL.revokeObjectURL(d.generatedPreviewUrl);
      }
    });
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
    } finally {
      setCartAdding(false);
    }
  }, [
    cartAdding,
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
    stepIds,
    stepLabels,
    touchedSteps,
    unlockedSteps,
    scrollToStep,
    locale,
  ]);

  if (!hydrated) {
    return (
      <main
        className="bg-gri-50 min-h-[calc(100vh-64px)]"
        aria-busy="true"
        aria-label={locale === "en" ? "Loading configurator" : "Konfigüratör yükleniyor"}
      >
        <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-8 animate-pulse">
          <div className="h-10 w-72 max-w-full bg-gri-200 rounded-lg mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[360px] bg-gri-100 rounded-xl" />
            <div className="h-[560px] bg-gri-100 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] animate-fade-up">
      <SchemaJsonLd
        data={breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: "Etiket", url: "/etiket" },
        ])}
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
            {/* Sefa 20 May v68: dinamik ürün başlığı — şekil + form + Etiket.
                Örn: "Özel Kesim Rulo Etiket", "Yuvarlak Tabaka Etiket". */}
            {locale === "en"
              ? `${shapeLabel(shape, "en")} ${formFactor === "rulo" ? "Roll" : "Sheet"} Label`
              : `${shapeLabel(shape, "tr")} ${formFactor === "rulo" ? "Rulo" : "Tabaka"} Etiket`}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        {/* Sefa 18 May v68: preview kolonu sticker ile aynı oran (1fr).
            Eskiden 1.3fr → çok genişti; sticker'daki kompakt görünüm
            daha dengeli + config alanı daha geniş okunur kalıyor. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 lg:gap-7 items-start">
          {/* LEFT — sticky preview (Sefa 18 May v67: yeni ProductPreviewShell
              + EtiketLivePreview kompozisyonu, eski PreviewCanvas kaldırıldı) */}
          <div className="min-w-0 lg:sticky lg:top-20 self-start">
            <ProductPreviewShell
              width={width}
              height={height}
              view={previewView}
              onViewChange={setPreviewView}
              footnote={t.etiket.livePreviewNoFile}
            >
              <EtiketLivePreview
                formFactor={formFactor}
                shape={shape}
                cornerStyle={cornerStyle}
                material={material}
                coating={coating}
                customs={customs}
                yaldiz={yaldiz}
                width={width}
                height={height}
                view={previewView}
                /* Sefa 20 May v68: etiket önizlemesi sadece boyut + malzeme
                 * gösterir; tasarım yüklense bile preview'a basılmaz —
                 * gerçek baskı /onay sayfasında prova ile gösterilir. */
                designUrl={null}
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

          {/* RIGHT — config + dikey ADIMLAR rail (iç içe grid — rail config ile hizalı) */}
          <div className="min-w-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_160px] gap-6 lg:gap-5 items-start">
          <div className="min-w-0 flex flex-col gap-5">

            {/* Step 0 — Etiket türü (Sefa 17 May v40: form factor seçimi
                FormSection olarak kutu içine alındı, ADIM 1 numaralı).
                Sefa 20 May v68 (Aşama B+): SHOW_ETIKET_FORM_FACTOR_PICKER
                false → bu adım render edilmez. Form factor URL ?form= ile
                pre-fill ediliyor, müşteri /etiket grid kartından geliyor. */}
            {SHOW_ETIKET_FORM_FACTOR_PICKER && (
            <FormSection
              id="step-0"
              number={uiStepNumber(0)}
              title={t.etiket.stepFormFactor}
              hint="Rulo etiketlerde ekstra özelleştirme seçenekleri mevcuttur."
              needsAttention={firstPendingStepId === 0}
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
            )}

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
                  attentionStepId={firstPendingStepId}
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
              needsAttention={firstPendingStepId === 1}
            >
              {!stepComplete(1) && (
                <p className="mb-3 text-[13px] font-medium text-pim-mercan bg-pim-mercan-tint/40 rounded-lg px-3 py-2">
                  {locale === "en"
                    ? "Select a material to unlock the next steps."
                    : "Devam etmek için bir malzeme seç — sonraki adımlar açılacak."}
                </p>
              )}
              {/* Sefa 20 May v68: grid kart sayısına göre dinamik (gridColsForCount).
                  HIDDEN_ETIKET_MATERIALS + formFactor filtresi sonrası görünür
                  kart sayısı, sütun sayısı = kart sayısı → kutu doldurulur,
                  boş hücre kalmaz. */}
              {(() => {
                const visibleMaterials = orderedIds(
                  MATERIALS.map((m) => m.id),
                  "materials"
                )
                  .map((id) => MATERIALS.find((m) => m.id === id)!)
                  .filter((m) =>
                    (m.modes as readonly string[]).includes(formFactor)
                  )
                  .filter((m) => !HIDDEN_ETIKET_MATERIALS.includes(m.id));
                return (
                  <div className={`${gridColsForCount(visibleMaterials.length)} gap-2.5`}>
                    {visibleMaterials.map((m) => (
                  <SelectableCard
                    key={m.id}
                    // Sefa 21 May v68 (sistem denetim #12): URL pre-fill
                    // (unlockedSteps) ile gelen seçim de "selected ring"
                    // göstersin — kart visual preselect.
                    selected={stepComplete(1) && material === m.id}
                    onClick={() => {
                      setMaterial(m.id);
                      markTouched(1);
                      track("material_selected", {
                        product: "etiket",
                        material: m.id,
                      });
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
                      {adminText("material", m.id, "desc") ?? (locale === "en" ? m.desc_en : m.desc)}
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
                );
              })()}
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
              needsAttention={firstPendingStepId === 2}
            >
              {/* Sefa 20 May v68: grid kart sayısına göre dinamik. HIDDEN +
                  formFactor sonrası görünür kart sayısı = sütun sayısı,
                  kutu boş hücre olmadan doldurulur. */}
              {(() => {
                const visibleCoatings = orderedIds(
                  COATINGS.map((c) => c.id),
                  "coating"
                )
                  .map((id) => COATINGS.find((c) => c.id === id)!)
                  .filter((c) =>
                    (c.modes as readonly string[]).includes(formFactor)
                  )
                  .filter((c) => !HIDDEN_ETIKET_COATINGS.includes(c.id));
                return (
                  <div className={`${gridColsForCount(visibleCoatings.length)} gap-2.5`}>
                    {visibleCoatings.map((c) => (
                  <SelectableCard
                    key={c.id}
                    selected={stepComplete(2) && coating === c.id}
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
                      label={adminText("coating", c.id, "name") ?? (locale === "en" ? c.name_en : c.name)}
                    />
                    <div className="font-semibold text-sm inline-flex items-start gap-1.5 min-h-[2.6em] leading-tight">
                      <span>{adminText("coating", c.id, "name") ?? (locale === "en" ? c.name_en : c.name)}</span>
                      {c.tooltip ? <InfoTooltip text={c.tooltip} /> : null}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                      {/* Sefa 21 May v68 (sistem denetim #10): malzeme
                          plastik/film ise "Kaplamasız" için "doğal kâğıt
                          dokusu" mantıksız — alternatif metin. */}
                      {c.id === "yok" &&
                      (material === "seffaf" || material === "ultra" || material === "beyaz")
                        ? "Düz yüzey — ek bir film kaplaması yok."
                        : adminText("coating", c.id, "desc") ??
                          (locale === "en" ? c.desc_en : c.desc)}
                    </div>
                  </SelectableCard>
                ))}
                  </div>
                );
              })()}
            </FormSection>

            {/* Step 3 — Özelleştirme (sadece RULO modunda görünür).
                Tabaka etikette emboss/yaldız/spot UV yok — Sefa kuralı.
                Sefa kuralı (15 May v3): Multi-select — birden fazla
                özellik kombine edilebilir (örn Emboss + Spot UV).
                Sefa 20 May v68 (Aşama B): SHOW_ETIKET_CUSTOMIZATION_STEP
                false ise hiç render etme. Müşteri ileride açılmak üzere
                gizlendi. Kod silinmedi — flag toggle yeterli. */}
            {formFactor === "rulo" && SHOW_ETIKET_CUSTOMIZATION_STEP && (
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
              needsAttention={firstPendingStepId === 3}
            >
              {/* Sefa 18 May v68: 4 özelleştirme → 4 kolon (md+).
                  Kompakt + tek satır görünüm. */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {orderedIds(
                  CUSTOMS.map((c) => c.id),
                  "customization"
                )
                  .map((id) => CUSTOMS.find((c) => c.id === id)!)
                  .map((c) => {
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
                        label={adminText("customization", c.id, "name") ?? (locale === "en" ? c.name_en : c.name)}
                      />
                      <div className="font-semibold text-sm inline-flex items-start gap-1.5 min-h-[2.6em] leading-tight">
                        <span>{adminText("customization", c.id, "name") ?? (locale === "en" ? c.name_en : c.name)}</span>
                        {c.tooltip ? <InfoTooltip text={c.tooltip} /> : null}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                        {adminText("customization", c.id, "desc") ?? (locale === "en" ? c.desc_en : c.desc)}
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

            {/* Step 7 — Tasarım (Boyut'tan önce — otomatik ölçü algılama) */}
            <FormSection
              id="step-7"
              number={uiStepNumber(7)}
              title="Tasarımlar"
              hint="Tasarımın hazırsa şimdi yükle; değilse boş bırak, ödeme sonrası yükleyebilirsin."
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
                onDimensionsDetected={(dims) => {
                  setDetectedDims(dims);
                  setDimsPromptShown(true);
                  setDimsAccepted(false);
                }}
              />
              {designDiscountPct > 0 && (
                <p className="mt-3 text-[12px] text-pim-mercan font-semibold">
                  ✨ {designCount} tasarım için{" "}
                  <strong>%{designDiscountPct} iskonto</strong> uygulanıyor —
                  fiyat kartında görünür
                </p>
              )}
              {designs.length === 0 && (
                <div className="mt-3 rounded-lg border border-pim-mercan/30 bg-pim-mercan-tint/30 p-3 text-[12px] leading-relaxed text-lacivert">
                  <strong>Sonra yükleme akışı aktif:</strong> Tasarımsız da
                  sepete ekleyebilirsin. Ödeme yaptıktan sonra "Tasarımını
                  yükle" sayfasına yönlendirileceksin (ve hatırlatma mail'i
                  alacaksın).
                </div>
              )}
            </FormSection>

            {/* Step 6 — Boyut (UI numarası formFactor'a göre) */}
            <FormSection
              id="step-6"
              number={uiStepNumber(6)}
              title={t.config.sizeTitle}
              hint={t.etiket.sizeHint}
              locked={isStepLocked(6)}
              lockMessage={getLockMessage(6)}
              needsAttention={firstPendingStepId === 6}
            >
              {detectedDims && dimsPromptShown && !dimsAccepted && (
                <div className="mb-4 p-3 rounded-lg bg-pim-mercan-tint/30 ring-1 ring-pim-mercan/40 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[13px] text-lacivert">
                    <strong>Tasarımının ölçüsünü tespit ettim:</strong>{" "}
                    {detectedDims.widthMm}×{detectedDims.heightMm}mm
                    {detectedDims.confidence === "estimated" && (
                      <span className="text-gri-500 ml-1">
                        (300 DPI varsayımıyla)
                      </span>
                    )}
                    {detectedDimsTrimHint(detectedDims) && (
                      <div className="text-[11px] text-gri-600 mt-0.5">
                        {detectedDimsTrimHint(detectedDims)}
                      </div>
                    )}
                    <div className="text-[11px] text-gri-600 mt-0.5">
                      Boyut alanına yazmamı ister misin?
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSingleDimensionShape(shape)) {
                          const v = Math.max(
                            detectedDims.widthMm,
                            detectedDims.heightMm
                          );
                          setWidth(v);
                          setHeight(v);
                        } else {
                          setWidth(detectedDims.widthMm);
                          setHeight(detectedDims.heightMm);
                        }
                        markTouched(6);
                        setDimsAccepted(true);
                        setDimsPromptShown(false);
                      }}
                      className="px-3 py-1.5 bg-pim-mercan text-white text-[12px] font-semibold rounded-lg hover:bg-pim-mercan-koyu"
                    >
                      Evet, kullan
                    </button>
                    <button
                      type="button"
                      onClick={() => setDimsPromptShown(false)}
                      className="px-3 py-1.5 bg-white text-gri-700 text-[12px] font-medium rounded-lg ring-1 ring-gri-200 hover:bg-gri-50"
                    >
                      Hayır, elle gireceğim
                    </button>
                  </div>
                </div>
              )}
              {/* Sefa 20 May v68 (2. revize): Köşe seçeneği — sticker
                  CornerStyleCard pattern'ine paralel. L ikonu + başlık +
                  alt başlık. 2 kart yan yana, aktif olan mercan border. */}
              {supportsCornerStyle(shape) && (
                <div className="mb-4">
                  <div className="text-[11.5px] font-bold tracking-[0.06em] text-lacivert mb-2 uppercase">
                    {locale === "en" ? "Corner option" : "Köşe seçeneği"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(["sharp", "rounded"] as const).map((opt) => {
                      const active = cornerStyle === opt;
                      const stroke = active
                        ? "var(--color-pim-mercan)"
                        : "var(--color-lacivert)";
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCornerStyle(opt)}
                          aria-pressed={active}
                          className={cn(
                            "p-4 rounded-xl ring-[1.5px] text-left transition-all flex items-center gap-3",
                            active
                              ? "ring-pim-mercan bg-pim-mercan-tint/40 shadow-1"
                              : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                          )}
                        >
                          {/* L köşe ikonu — düz vs yumuşatılmış */}
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 32 32"
                            aria-hidden="true"
                            className="shrink-0"
                          >
                            {opt === "sharp" ? (
                              <path
                                d="M 4 28 L 4 4 L 28 4"
                                fill="none"
                                stroke={stroke}
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            ) : (
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
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "font-bold text-[14px] leading-tight",
                                active ? "text-pim-mercan" : "text-lacivert"
                              )}
                            >
                              {locale === "en"
                                ? opt === "sharp"
                                  ? "Sharp corner"
                                  : "Rounded corner"
                                : opt === "sharp"
                                  ? "Düz köşe"
                                  : "Yumuşatılmış köşe"}
                            </div>
                            <div className="text-[12px] text-gri-700 leading-tight mt-0.5">
                              {locale === "en"
                                ? opt === "sharp"
                                  ? "Crisp corner"
                                  : "Soft rounded corner"
                                : opt === "sharp"
                                  ? "Keskin köşe"
                                  : "Yuvarlatılmış köşe"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sefa 20 May v68 (Aşama C): shape'e göre dinamik boyut.
                  Kare/Daire → orantı kilitli tek input (w=h otomatik).
                  Diğerleri → mevcut 2 input. */}
              {isSingleDimensionShape(shape) ? (
                <div className="max-w-xs">
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block inline-flex items-center gap-1.5">
                      {shape === "circle" ? "Çap (mm)" : "Kenar (mm)"}
                      <span className="px-1.5 py-0.5 rounded bg-pim-mercan-tint text-pim-mercan text-[10px] font-bold uppercase tracking-wide">
                        Orantı kilitli
                      </span>
                    </span>
                    <input
                      type="number"
                      value={touchedSteps.has(6) ? width : ""}
                      placeholder={shape === "circle" ? "örn. 50" : "örn. 60"}
                      autoComplete="off"
                      onChange={(e) => {
                        const v = Math.max(
                          sizeMinEqual,
                          Number(e.target.value) || sizeMinEqual
                        );
                        setWidth(v);
                        setHeight(v); // orantı kilidi — kare/daire için w=h
                        markTouched(6);
                        track("size_selected", {
                          product: "etiket",
                          width: v,
                          height: v,
                          preset: false,
                        });
                      }}
                      min={sizeMinEqual}
                      max={sizeMaxEqual}
                      step={1}
                      className={cn(
                        "block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all tabular-nums",
                        presetPulseAt
                          ? "ring-pim-mercan ring-2 shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]"
                          : "ring-gri-200"
                      )}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                      {shape === "oval" ? "Uzun eksen (mm)" : "Genişlik (mm)"}
                    </span>
                    {/* Sefa 18 May v64: touched değilse value boş gözüksün.
                        Sefa 21 May v68: clamp on blur (silme bug fix). */}
                    <ClampedNumberInput
                      value={touchedSteps.has(6) ? width : undefined}
                      placeholder="örn. 60"
                      autoComplete="off"
                      onChange={(v) => {
                        setWidth(v);
                        markTouched(6);
                      }}
                      min={sizeMinW}
                      max={sizeMaxW}
                      step={1}
                      className={cn(
                        "block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all tabular-nums",
                        presetPulseAt
                          ? "ring-pim-mercan ring-2 shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]"
                          : "ring-gri-200"
                      )}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const w = width;
                      const h = height;
                      setWidth(h);
                      setHeight(w);
                      markTouched(6);
                    }}
                    disabled={!width || !height}
                    className="self-end mb-3 p-2 rounded-lg text-gri-500 hover:bg-pim-mercan-tint hover:text-pim-mercan transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gri-500"
                    title="Genişlik ↔ Yükseklik ters çevir"
                    aria-label="Boyutları ters çevir"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden
                    >
                      <path
                        d="M3 5h10M3 5l3-3M3 5l3 3M13 11H3M13 11l-3-3M13 11l-3 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                      {shape === "oval" ? "Kısa eksen (mm)" : "Yükseklik (mm)"}
                    </span>
                    <ClampedNumberInput
                      value={touchedSteps.has(6) ? height : undefined}
                      placeholder="örn. 80"
                      autoComplete="off"
                      onChange={(v) => {
                        setHeight(v);
                        markTouched(6);
                      }}
                      min={sizeMinH}
                      max={sizeMaxH}
                      step={1}
                      className={cn(
                        "block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all tabular-nums",
                        presetPulseAt
                          ? "ring-pim-mercan ring-2 shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]"
                          : "ring-gri-200"
                      )}
                    />
                  </label>
                </div>
              )}

              {formFactor === "rulo" && (
                <p className="mt-2 text-[11.5px] text-gri-600 leading-relaxed">
                  Rulo etiket ebat aralığı:{" "}
                  <strong>
                    {ETIKET_RULO_MIN_W}×{ETIKET_RULO_MIN_H} – {ETIKET_RULO_MAX_W}×
                    {ETIKET_RULO_MAX_H} mm
                  </strong>{" "}
                  (genişlik × yükseklik, sarım yönü sabit).
                </p>
              )}

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
                ]
                  // Sefa 20 May v68 (Aşama C): kare/daire ise sadece eşit
                  // kenar preset'ler gösterilsin (orantı bozulmasın). Daire
                  // için label "30mm çap" stiline çevirelim render'da.
                  .filter((p) =>
                    isSingleDimensionShape(shape) ? p.w === p.h : true
                  )
                  .map((preset) => {
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
                        // Input'larda kısa bir pulse — preset basıldığını
                        // görsel olarak ilet
                        setPresetPulseAt(Date.now());
                        setTimeout(() => setPresetPulseAt(null), 700);
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

            {/* DOM sırası: Tasarım → Boyut → Adet → Sarım Yönü → Sarım Detayı */}
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
              needsAttention={firstPendingStepId === 8}
            >
              {isStepLocked(8) ? (
                <p className="text-[14px] text-gri-600 leading-relaxed">
                  {locale === "en"
                    ? `From ${minQty.toLocaleString("en-US")} pcs — unlocks after you set size.`
                    : `${minQty.toLocaleString("tr-TR")} adetten başlayabilirsin — önce boyutu seç.`}
                </p>
              ) : (
              <>
              {/* Sefa 18 May v58: Slider + inline +/− step butonları.
                  Manuel input kutusu kaldırıldı (slider yeterli, kullanıcı
                  istediği değeri sağdaki ok'larla fine tune ediyor). */}
              <div className="px-1 min-w-0 overflow-hidden">
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
                  ticks={qtySliderTicks}
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
                {qtyPresets.filter((q) => q >= minQty && q <= maxQty).map((q) => {
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
                        track("tier_selected", {
                          product: "etiket",
                          qty: q,
                          tierLabel: label,
                        });
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
              </>
              )}
            </FormSection>

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
              needsAttention={firstPendingStepId === 4}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
              hint="Göbek çapı ve rulo başına etiket adedi — makine uyumu için."
              locked={isStepLocked(5)}
              lockMessage={getLockMessage(5)}
              needsAttention={firstPendingStepId === 5}
            >
              {/* Göbek çapı — Sefa 20 May v68 (Aşama B):
                  Picker gizli, 76mm sabit badge gösterilir. 25/40mm gizlendi
                  (üretim partneri endüstri standardı 76mm istiyor).
                  SHOW_ETIKET_CORE_SIZE_PICKER true yapılırsa eski 3-buton
                  grid'i geri gelir. */}
              <div>
                <div className="text-[11.5px] font-bold tracking-[0.06em] text-lacivert mb-2 uppercase">
                  Göbek çapı
                </div>
                {SHOW_ETIKET_CORE_SIZE_PICKER ? (
                  <div className="grid grid-cols-3 gap-2">
                    {CORE_SIZES.map((c) => {
                      const active = touchedSteps.has(5) && coreSize === c.id;
                      return (
                        <div key={c.id} className="relative">
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
                ) : (
                  /* Sefa 20 May v68: kompakt pill — eski 2xl badge çok
                     büyüktü, sayfada görsel ağırlık dengelensin. */
                  <div className="inline-flex items-center gap-2 rounded-full bg-pim-mercan-tint ring-1 ring-pim-mercan/40 px-3 py-1.5 text-[13px]">
                    <span className="font-bold text-pim-mercan tabular-nums">
                      {ETIKET_DEFAULT_CORE_SIZE}mm
                    </span>
                    <span className="text-gri-500">·</span>
                    <span className="text-gri-700">
                      3 inç, endüstri standardı
                    </span>
                  </div>
                )}
              </div>

              {/* Sarım adeti */}
              <div className="mt-4">
                <div className="text-[11.5px] font-bold tracking-[0.06em] text-lacivert mb-2 uppercase">
                  Bir rulodaki etiket adedi
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

            {/* Price card — Intersection observer için ref'li wrapper */}
            <div ref={priceCardRef}>
              {quoteError && (
                <div className="mb-3 rounded-lg bg-kirmizi-soft/30 ring-1 ring-kirmizi/30 px-4 py-3 text-[13px] text-kirmizi">
                  ⚠️ {quoteError}
                </div>
              )}
              <PriceCard
                variant="quiet"
                topLabel="TOPLAM"
                total={total}
                unitPrice={
                  <>
                    Birim fiyat{" "}
                    <strong className="text-lacivert">
                      {fmtUnit(unit)} ₺/adet
                    </strong>{" "}
                    · KDV dahil
                  </>
                }
                /* Sefa 21 May v68: İŞLEM ÖZETİ — buildSummaryItems helper
                   tek-doğru-kaynak. Malzeme, Kaplama, Özelleştirme, Boyut,
                   Sarım, Göbek, Rulodaki adet, Toplam adet, Tasarım sayısı.
                   Sipariş detay sayfasında aynı helper kullanılır → tutarlı. */
                summaryItems={[
                  // Şekil + Köşe + Rulo adedi: helper kapsamı dışında
                  // (configurator-only state'ler) — manuel ekleniyor
                  {
                    icon: "🔷",
                    label: locale === "en" ? "Shape" : "Şekil",
                    value: shapeLabel(shape, locale),
                  },
                  ...(supportsCornerStyle(shape)
                    ? [
                        {
                          icon: cornerStyle === "rounded" ? "🔘" : "▫️",
                          label: locale === "en" ? "Corner" : "Köşe",
                          value: cornerLabel(cornerStyle, locale),
                        },
                      ]
                    : []),
                  // Helper'dan gelen tüm cart-item alanları
                  ...buildSummaryItems(
                    {
                      id: "preview",
                      product: "etiket",
                      title: "",
                      config: "",
                      width,
                      height,
                      qty: totalEtiketCount,
                      unit,
                      total,
                      materialId: material,
                      coatingId: coating,
                      customizationId: primaryCustom,
                      // Sefa 21 May v68 (ürün denetim P0 #1): tabaka modunda
                      // rulo'ya özgü alanları (sarım, göbek, rulo/adet)
                      // göndermeyelim → "Sarım yönü" / "Toplam rulo" satırları
                      // tabaka özetinde sızmasın.
                      winding: formFactor === "rulo" ? winding : undefined,
                      coreSize: formFactor === "rulo" ? coreSize : undefined,
                      rollLabelCount:
                        formFactor === "rulo" ? rollLabelCount : undefined,
                      designCount: designCount > 1 ? designCount : undefined,
                      addedAt: 0,
                    },
                    locale === "en" ? "en" : "tr"
                  ),
                  ...(formFactor === "rulo" && rollsNeeded > 0
                    ? [
                        {
                          icon: "📦",
                          label: locale === "en" ? "Roll count" : "Toplam rulo",
                          value: `${rollsNeeded} ${locale === "en" ? "rolls" : "rulo"}`,
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
                ctaLoading={cartAdding}
                onCta={handleAddToCart}
                /* Sefa 21 May v68 (konfigüratör denetim #4): zorunlu
                   adımlar tamamlanmadıkça PriceCard'da "tahmini fiyat"
                   bandı gösterilir; #1 sessiz fail için ek görsel uyarı. */
                pendingStepsCount={
                  stepIds.filter(
                    (id) =>
                      id !== 7 /* Tasarım opsiyonel */ &&
                      !stepComplete(id)
                  ).length
                }
                firstPendingStepLabel={(() => {
                  const firstPending = findFirstIncompleteStep(
                    stepIds,
                    touchedSteps,
                    {
                      optionalStepIds: new Set([7]),
                    }
                  );
                  if (firstPending == null) return undefined;
                  const idx = stepIds.indexOf(firstPending);
                  return stepLabels[idx];
                })()}
                onPendingStepsClick={focusPendingStep}
                /* Sefa 18 May v62: footnote kaldırıldı — KDV bilgisi
                   unitPrice'da, teslim ve özet zaten kart içinde var. */
                footnote={null}
              />
            </div>
          </div>

          {/* RAIL — desktop only dikey stepper. Config sütunu ile aynı
              grid hücresinde — preview yüksekliğinden bağımsız üst hizalı. */}
          <aside
            className="hidden lg:block lg:sticky lg:top-20 self-start min-w-0"
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
                attentionStepId={firstPendingStepId}
              />
            </div>
          </aside>
          </div>
        </div>
      </div>
      {/* Bilgi bandı kaldırıldı (Sefa kuralı 15 May v5) */}

      {/* Sefa 18 May v68: ProductInfoSection (3 feature söylemi) kaldırıldı.
          Yorumlar direkt gösterilir. */}
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
            {fmt(total)} ₺
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
          disabled={!quote.ok || cartAdding}
          // Sefa 21 May v68 (konfigüratör denetim #6): unique aria-label
          // — PriceCard ana buton ile karışmasın (screen reader iki kez
          // "Sepete ekle" okumaz).
          aria-label="Sepete ekle — sticky mobile bar"
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5",
            "bg-pim-mercan text-white font-bold text-[14px]",
            "px-5 h-11 rounded-full shadow-1",
            "active:scale-[0.98] transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {cartAdding ? "Ekleniyor…" : "Sepete ekle"}
          {!cartAdding && <Icon.ArrowR size={14} />}
        </button>
      </div>

      <Modal
        open={noDesignModalOpen}
        onClose={() => setNoDesignModalOpen(false)}
        title="Tasarım yüklemeden devam?"
      >
        <p className="text-[14px] text-gri-700 leading-relaxed mb-4">
          Ödeme sonrası &ldquo;Tasarımını yükle&rdquo; sayfasına yönlendirileceksin
          (3 gün süre, hatırlatma mail&apos;i alacaksın).
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setNoDesignModalOpen(false);
              const idx = stepIds.indexOf(7);
              if (idx >= 0) scrollToStep(idx + 1);
            }}
          >
            Önce tasarımı yükle
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              bypassNoDesignConfirmRef.current = true;
              setNoDesignModalOpen(false);
              void handleAddToCart();
            }}
          >
            Sonra yükleyeceğim, sepete ekle
          </Button>
        </div>
      </Modal>

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
