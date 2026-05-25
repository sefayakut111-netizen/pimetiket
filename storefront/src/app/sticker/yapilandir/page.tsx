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
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSequentialSteps } from "@/lib/use-sequential-steps";
import { AddToCartSuccessModal } from "@/components/cart/AddToCartSuccessModal";
// Pim mascot kaldırıldı (Sefa kuralı 15 May v4 — sticker UX paketi).
import {
  SchemaJsonLd,
  productSchema,
  breadcrumbSchema,
} from "@/components/SchemaJsonLd";
import { ProductReviews } from "@/components/reviews/ProductReviews";
// Sefa 18 May v68: ProductInfoSection kaldırıldı (3 feature söylemi gereksiz)
// import { ProductInfoSection } from "@/components/ProductInfoSection";
import { StepProgress, VerticalStepProgress } from "@/components/Stepper";
import { Icon } from "@/components/Icon";
import {
  FormSection,
  SelectableCard,
  PriceCard,
  useToast,
  MaterialSwatch,
  PopulerBadge,
  InfoTooltip,
  type DesignTempState,
  type SurfaceId,
} from "@/components/ui";
import {
  ProductPreviewShell,
  StickerLivePreview,
  type PreviewView,
} from "@/components/preview";
import {
  MultiDesignUploader,
  type PendingDesign,
} from "@/components/sticker/MultiDesignUploader";
// Sefa 18 May v68 (6): TabakaPreview kaldırıldı — sol canlı önizleme
// (eskiz modu) zaten tabaka yerleşimini gösteriyor. Admin tarafında kalır.
// import { TabakaPreview } from "@/components/sticker/TabakaPreview";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { useExperiment } from "@/lib/analytics/feature-flags";
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
// Sefa 20 May v68 (Sticker reform): müşteri gizleme flag'leri
import {
  HIDDEN_STICKER_MATERIALS,
  HIDDEN_STICKER_FINISHES,
  SHOW_STICKER_CUT_MODE_PICKER,
  SHOW_STICKER_SHAPE_PICKER,
} from "@/lib/sticker-feature-flags";
// Sefa 20 May v68: kart sayısına göre dinamik grid sütun helper
import { gridColsForCount } from "@/lib/grid-cols";
// Faz 2 (Sefa 19 May v68): admin /admin/fiyatlar canlı config → /sticker
// Client-safe import (pricing-config.ts'in server-only createAdminClient
// referansı bundle'a sızmasın).
import { getLivePricingConfig } from "@/lib/pricing-config-client";
import { ClampedNumberInput } from "@/components/ClampedNumberInput";
import type { ProfileConfig } from "@/lib/pricing-config-types";
import { quoteStickerFromConfig } from "@/lib/customer-pricing-from-config";
import {
  addToCustomerCart,
  removeFromCustomerCart,
  listCustomerCart,
} from "@/lib/customer-cart";
import { loadEditIntent, clearEditIntent } from "@/lib/cart-edit-intent";
import { quantizeForCart } from "@/lib/pricing-quantize";
import { buildSummaryItems } from "@/lib/order-summary";

// ============================================================
// Configuration data
// ============================================================

// Sıra: Kare → Yuvarlak → Özel oran → Kontur kesim
// Tabaka modunda Kontur kesim GÖSTERİLMEZ (tabakada özel kontur yok).
// Sefa kuralı (16 May denetim #1): name/desc i18n'a bağlandı —
// SHAPES_DEFS, MATERIALS_DEFS, FINISHES_DEFS sadece id + non-text data,
// component içinde t.* ile name+desc inşa edilir.

// Sefa 20 May v68 (Sticker reform): "rectangle", "oval", "bumper" eklendi.
// Eski "ozel" + "die" geri uyumluluk için kalır (URL/order_items'ta görülebilir).
// Bumper = rectangle + preset boyut 280×80 + corner=rounded (handler içinde).
const SHAPE_IDS = [
  "square",
  "circle",
  "ozel",
  "die",
  "rectangle",
  "oval",
  "bumper",
  "diecut", // alias of "die" — yeni grid'den gelir
] as const;
type ShapeId = (typeof SHAPE_IDS)[number];

/** CutMode — "kisscut" Sefa 20 May v68 eklendi (yarı kesim, arka kağıt sağlam). */
type CutMode = "tabaka" | "diecut" | "kisscut";

/** Bumper sticker varsayılan boyutu (mm) — Sefa 20 May v68 kararı. */
const BUMPER_PRESET_WIDTH = 280;
const BUMPER_PRESET_HEIGHT = 80;

/** Şekil tek değer mi gerektiriyor (kare/daire/oval) — orantı kilidi */
function isSingleDimensionShape(shape: ShapeId): boolean {
  return shape === "square" || shape === "circle" || shape === "oval";
}

/** Köşe stili destekleyen şekiller — kare/dikdörtgen/bumper */
function supportsCornerStyle(shape: ShapeId): boolean {
  return shape === "square" || shape === "rectangle" || shape === "bumper";
}

/** Yeni shape değerlerini pricing engine + StickerLivePreview için legacy
 *  4-değere map eder (square|circle|ozel|die). Yeni shape'ler metadata
 *  amaçlı UI'da var, pricing/preview'a etki etmez. */
function mapShapeToLegacy(shape: ShapeId): "circle" | "square" | "ozel" | "die" {
  switch (shape) {
    case "rectangle":
      return "square"; // dikdörtgen — geometric en yakın legacy
    case "oval":
      return "ozel"; // oval → özel oran
    case "bumper":
      return "ozel"; // bumper = özel oran + softCorners
    case "diecut":
      return "die"; // alias
    default:
      return shape as "circle" | "square" | "ozel" | "die";
  }
}

/** kisscut → diecut (pricing/geometry impact yok, cart config string'inde
 *  ayrı saklanır). */
function mapCutToLegacy(cut: CutMode): "diecut" | "tabaka" {
  return cut === "kisscut" ? "diecut" : cut;
}

const MATERIAL_SWATCHES = {
  vinil: "#FFFFFF",
  transparan: "linear-gradient(135deg,#E0F2FE,#FFFFFF)",
  holo: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
  simli:
    "radial-gradient(circle at 30% 30%, #FFE8B7 1.5px, transparent 2.5px), radial-gradient(circle at 70% 60%, #FFB7E5 1.5px, transparent 2.5px), radial-gradient(circle at 50% 80%, #B7E8FF 1px, transparent 2px), linear-gradient(135deg,#F5EBD9,#FFFFFF)",
} as const;

/** Sefa 18 May v67: Sticker malzeme dokuları — gerçek malzeme hissi
 *  veren photorealistic SVG'ler. vinil → opak PP doku, transparan
 *  → frosted, holo → iridescence, simli → glitter+spark. */
const MATERIAL_SURFACES = {
  vinil: "opakpp",
  transparan: "transparan",
  holo: "holografik",
  simli: "simli",
} as const;

/** Sticker finish (parlak/mat/yok) için surface mapping.
 *  parlak → parlak selefon, mat → mat selefon, yok → kaplamasız. */
const FINISH_SURFACES = {
  parlak: "parlakselefon",
  mat: "matselefon",
  yok: "kaplamasiz",
} as const;

const MATERIAL_IDS = ["vinil", "transparan", "holo", "simli"] as const;
const FINISH_IDS = ["parlak", "mat", "yok"] as const;

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
/**
 * Birim fiyat formatlama — smart precision.
 *
 * Sefa 18 May v68 (UX uzman 3.7): Birim fiyat 2 ondalığa sabitlendi.
 * "0,2510" gibi 4 basamak okunaklılığı bozuyordu. Toplam fiyat zaten
 * doğru (round-half ile matematik tutuyor), birim fiyat referans değer.
 */
const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

// ============================================================
// Page
// ============================================================

// Sefa 20 May v68 (Sticker reform): /sticker grid'den gelen URL pre-fill helper'ları
function readInitialCutMode(searchParams: URLSearchParams): CutMode {
  const formParam = searchParams.get("form");
  if (formParam !== null && formParam.length === 0) {
    return "diecut";
  }
  const cut = searchParams.get("cut");
  if (cut === "tabaka" || cut === "diecut" || cut === "kisscut") return cut;
  return "diecut";
}

function readInitialShape(searchParams: URLSearchParams): ShapeId {
  const shape = searchParams.get("shape");
  // "diecut" alias of "die" — grid bunu yolluyor
  if (shape === "diecut") return "die";
  // Sefa 21 May v68 (site denetim P0 #2): shape param malzeme/finish değeri
  // taşıyorsa (örn ?shape=holo/transparent/glitter — derin link veya eski
  // share URL) bunlar shape DEĞİL, default die-cut'a düş ve material'ı
  // readInitialMaterial üstlensin.
  if (shape === "holo" || shape === "transparan" || shape === "transparent" || shape === "glitter" || shape === "simli") {
    return "die";
  }
  if (shape && (SHAPE_IDS as readonly string[]).includes(shape)) {
    return shape as ShapeId;
  }
  if (shape && !(SHAPE_IDS as readonly string[]).includes(shape)) {
    return "square";
  }
  return "square";
}

function readInitialMaterial(
  searchParams: URLSearchParams
): StickerMaterial | null {
  const mat = searchParams.get("material");
  if (mat === "vinil" || mat === "transparan" || mat === "holo" || mat === "simli") {
    return mat;
  }
  // Sefa 21 May v68 (site denetim P0 #2): shape parametresi malzeme adı
  // ile gelmişse onu material'a çevir. ?shape=holo → material=holo,
  // ?shape=glitter → simli, ?shape=transparent → transparan.
  const shapeAsMaterial = searchParams.get("shape");
  if (shapeAsMaterial === "holo") return "holo";
  if (shapeAsMaterial === "simli" || shapeAsMaterial === "glitter") return "simli";
  if (shapeAsMaterial === "transparan" || shapeAsMaterial === "transparent") return "transparan";
  return null;
}

function readInitialCorner(searchParams: URLSearchParams): boolean {
  // ?corner=rounded → softCorners=true; bumper otomatik rounded
  const corner = searchParams.get("corner");
  if (corner === "rounded") return true;
  if (searchParams.get("shape") === "bumper") return true;
  return false;
}

// Suspense boundary için (Next 16 useSearchParams Suspense ister prerender uyumu için)
export default function StickerPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gri-50" />}>
      <StickerPage />
    </Suspense>
  );
}

function StickerPage() {
  const toast = useToast();
  const { t, locale } = useT();
  const searchParams = useSearchParams();

  // Faz 2 (Sefa 19 May v68): admin /admin/fiyatlar live_config
  //   - name/desc override edilir (admin'den gelen önceliklidir)
  //   - fiyat hesabı quoteStickerFromConfig'le yapılır
  //   - config yüklenene kadar i18n + eski engine fallback
  const [adminConfig, setAdminConfig] = useState<ProfileConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getLivePricingConfig("sticker").then((cfg) => {
      if (!cancelled) setAdminConfig(cfg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // i18n'a bağlı array'ler — Sefa kuralı (16 May denetim #1):
  // dil değiştiğinde shape/material/finish name+desc çevrilir.
  const SHAPES = SHAPE_IDS.map((id) => ({
    id,
    name:
      id === "square"
        ? t.sticker.shapeSquare
        : id === "circle"
          ? t.sticker.shapeCircle
          : id === "ozel"
            ? t.sticker.shapeCustom
            : t.sticker.shapeContour,
    desc:
      id === "square"
        ? t.sticker.shapeSquareDesc
        : id === "circle"
          ? t.sticker.shapeCircleDesc
          : id === "ozel"
            ? t.sticker.shapeCustomDesc
            : t.sticker.shapeContourDesc,
  }));

  // Faz 2 (Sefa 19 May v68): ad/açıklama + SIRA admin live_config > i18n fallback.
  // Admin /admin/fiyatlar'da ↑↓ ile sıralanmış malzemeler aynı sırayla render.
  // Sefa 20 May v68 (graceful fallback): admin'de eksik/typo'lu module id'leri
  // sıralanmış admin id'lerinin SONUNA eklenir — müşteri tarafında kapalı set
  // her zaman görünür kalır.
  const orderedMaterialIds: readonly StickerMaterial[] = (() => {
    let base: readonly StickerMaterial[];
    if (!adminConfig?.materials) {
      base = MATERIAL_IDS;
    } else {
      const adminFiltered = adminConfig.materials
        .map((m) => m.id as StickerMaterial)
        .filter((id) => (MATERIAL_IDS as readonly string[]).includes(id));
      const missing = MATERIAL_IDS.filter(
        (id) => !(adminFiltered as readonly string[]).includes(id)
      );
      base = [...adminFiltered, ...missing] as readonly StickerMaterial[];
    }
    // Sefa 20 May v68: müşteri gizleme flag'i uygula
    return base.filter(
      (id) => !HIDDEN_STICKER_MATERIALS.includes(id)
    ) as readonly StickerMaterial[];
  })();
  const MATERIALS = orderedMaterialIds.map((id) => {
    const fromAdmin = adminConfig?.materials.find((m) => m.id === id);
    const i18nName =
      id === "vinil"
        ? t.sticker.materialVinil
        : id === "transparan"
          ? t.sticker.materialTransparan
          : id === "holo"
            ? t.sticker.materialHolo
            : t.sticker.materialSimli;
    const i18nDesc =
      id === "vinil"
        ? t.sticker.materialVinilDesc
        : id === "transparan"
          ? t.sticker.materialTransparanDesc
          : id === "holo"
            ? t.sticker.materialHoloDesc
            : t.sticker.materialSimliDesc;
    return {
      id,
      name: fromAdmin?.name ?? i18nName,
      desc: fromAdmin?.desc ?? i18nDesc,
      swatch: MATERIAL_SWATCHES[id],
      surface: MATERIAL_SURFACES[id] as SurfaceId,
    };
  });

  // Sefa 19 May v68: finiş sırası da admin'den (varsa)
  // Sefa 20 May v68 (graceful fallback): eksik module id'ler sona eklenir
  const orderedFinishIds: readonly StickerFinish[] = (() => {
    let base: readonly StickerFinish[];
    const items = adminConfig?.options?.finish?.items;
    if (!items) {
      base = FINISH_IDS;
    } else {
      const adminFiltered = items
        .map((i) => i.id as StickerFinish)
        .filter((id) => (FINISH_IDS as readonly string[]).includes(id));
      const missing = FINISH_IDS.filter(
        (id) => !(adminFiltered as readonly string[]).includes(id)
      );
      base = [...adminFiltered, ...missing] as readonly StickerFinish[];
    }
    // Sefa 20 May v68: müşteri gizleme flag'i uygula
    return base.filter(
      (id) => !HIDDEN_STICKER_FINISHES.includes(id)
    ) as readonly StickerFinish[];
  })();
  const FINISHES = orderedFinishIds.map((id) => {
    const fromAdmin = adminConfig?.options?.finish?.items.find(
      (i) => i.id === id
    );
    const i18nName =
      id === "parlak"
        ? t.sticker.finishParlak
        : id === "mat"
          ? t.sticker.finishMat
          : t.sticker.finishNone;
    const i18nDesc =
      id === "parlak"
        ? t.sticker.finishParlakDesc
        : id === "mat"
          ? t.sticker.finishMatDesc
          : t.sticker.finishNoneDesc;
    return {
      id,
      name: fromAdmin?.name ?? i18nName,
      desc: fromAdmin?.desc ?? i18nDesc,
      surface: FINISH_SURFACES[id] as SurfaceId,
    };
  });

  // A/B test: sticker CTA varyantı. PostHog'da `sticker_cta_v2` flag'ı
  // tanımlandığında otomatik aktifleşir. Variants:
  //   control = "Sepete ekle"
  //   test    = "Sepete ekle · 5 iş günü içinde kargoda"
  // PostHog yüklenmemişse veya consent yoksa → control (default).
  const { variant: ctaVariant } = useExperiment("sticker_cta_v2", [
    "control",
    "test",
  ]);
  const ctaLabel =
    ctaVariant === "test"
      ? `${t.config.addToCart} · 5 iş günü içinde kargoda`
      : t.config.addToCart;
  // Sefa 21 May v68 (site denetim P0 #2): useSearchParams initial state'te
  // kullanılır (typeof window check'i SSR'da boş döndürüyor + ilk render
  // yanlış title flashı doğuruyordu).
  const initialParams = new URLSearchParams(searchParams.toString());
  const [cutMode, setCutMode] = useState<CutMode>(() =>
    readInitialCutMode(initialParams)
  );
  const [shape, setShape] = useState<ShapeId>(() =>
    readInitialShape(initialParams)
  );
  const [softCorners, setSoftCorners] = useState<boolean>(() =>
    readInitialCorner(initialParams)
  );
  const [material, setMaterial] = useState<StickerMaterial>(() => {
    const initial = readInitialMaterial(initialParams);
    return initial ?? "vinil";
  });
  const [finish, setFinish] = useState<StickerFinish>("parlak");

  // Sefa 20 May v68: searchParams değişirse (client-side nav) sync —
  // kullanıcı farklı karttan yeni girerse state'ler yeniden eşleşir
  useEffect(() => {
    const formParam = searchParams.get("form");
    if (formParam !== null && formParam.length === 0) {
      setCutMode("diecut");
    }
    const cut = searchParams.get("cut");
    if (cut === "tabaka" || cut === "diecut" || cut === "kisscut") {
      setCutMode(cut);
    }
    const sp = searchParams.get("shape");
    if (sp === "diecut") {
      setShape("die");
    } else if (sp && (SHAPE_IDS as readonly string[]).includes(sp)) {
      setShape(sp as ShapeId);
    } else if (sp && !(SHAPE_IDS as readonly string[]).includes(sp)) {
      setShape("square");
    }
    if (sp === "bumper") {
      setWidth(BUMPER_PRESET_WIDTH);
      setHeight(BUMPER_PRESET_HEIGHT);
      setSoftCorners(true);
    }
    const mat = searchParams.get("material");
    if (mat === "vinil" || mat === "transparan" || mat === "holo" || mat === "simli") {
      setMaterial(mat);
    }
    const corner = searchParams.get("corner");
    if (corner === "rounded") setSoftCorners(true);
    else if (corner === "sharp") setSoftCorners(false);
  }, [searchParams]);

  // editIntent useEffect aşağıda — `editingItemId` state declaration'ı
  // önce gelmesi gerekiyor (TDZ).

  // Müşteri serbest qty seçer — 25'er artış, 25-1000 aralık.
  // findTier en yakın STICKER_TIERS multiplier'ını otomatik uygular.
  // Sefa 21 May v68 (sistem denetim #18): sticker default tier
  // 250 → 25. /sticker liste sayfası ve SSS "25 adetten başlar" diyor;
  // konfigüratör default'u da onunla aynı olsun.
  const [tier, setTier] = useState<number>(25);

  // Sefa 20 May v68 test #3: Sepetten "Düzenle" geldi mi? editingItemId
  // varsa "Sepete Ekle" sonrası eskiyi siler (replace pattern).
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Sefa 20-21 May v68 test #3: URL ?edit=ID + cart lookup + localStorage
  // fallback. State'leri en son ayarlarla restore eder. [searchParams,
  // editingItemId] dep — edit ID URL'de iken tekrar tetiklenirse no-op.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    if (editingItemId === editId) return;

    const items = listCustomerCart();
    let it = items.find((i) => i.id === editId);
    if (!it) {
      const intent = loadEditIntent();
      if (intent && intent.editingItemId === editId) it = intent.item;
    }
    if (!it || it.product !== "sticker") return;

    if (it.material) setMaterial(it.material);
    if (it.finish) setFinish(it.finish);
    if (it.width) setWidth(it.width);
    if (it.height) setHeight(it.height);
    if (it.softCorners !== undefined) setSoftCorners(it.softCorners);
    if (it.cut === "tabaka" || it.cut === "diecut") setCutMode(it.cut);
    const designCnt = it.designCount ?? 1;
    setTier(Math.max(25, Math.round(it.qty / designCnt)));
    if (designCnt > 1) setDesignCount(designCnt);

    setTouchedSteps(new Set([1, 2, 3, 4, 5, 6, 7]));
    setEditingItemId(editId);
    clearEditIntent();
  }, [searchParams, editingItemId]);

  // Sefa 20 May v68: bumper sticker varsayılan 280×80mm (klasik tampon),
  // diğerleri 75×75. URL ?shape=... ve useEffect ile sync.
  const initialDims = (() => {
    if (typeof window === "undefined") return { w: 75, h: 75 };
    const urlShape = new URLSearchParams(window.location.search).get("shape");
    if (urlShape === "bumper") {
      return { w: BUMPER_PRESET_WIDTH, h: BUMPER_PRESET_HEIGHT };
    }
    return { w: 75, h: 75 };
  })();
  const [width, setWidth] = useState<number>(initialDims.w);
  const [height, setHeight] = useState<number>(initialDims.h);
  // Sefa 18 May v68 (CRO denetim — Preset feedback fix):
  // Preset chip basıldığında input'ta 700ms pulse animasyonu
  const [presetPulseAt, setPresetPulseAt] = useState<number | null>(null);
  // Pre-purchase tasarım — sepete eklemeden önce yüklenip mockup'ta görünür
  const [design, setDesign] = useState<DesignTempState | null>(null);
  // Sefa Madde 9 (11 May): müşteri çoklu tasarım yükleyebilir.
  // designCount × tier adet = toplam sticker. Tasarımlar local-preview.
  const [designCount, setDesignCount] = useState<number>(1);
  const [designs, setDesigns] = useState<PendingDesign[]>([]);

  // Sefa 18 May v68 (5): 3D / Eskiz toggle state
  const [previewView, setPreviewView] = useState<PreviewView>("3d");

  // Stepper state (Sefa kuralı 15 May v4 — UX paketi sticker'a):
  // 7 adım: Kesim → Şekil → Malzeme → Yüzey → Boyut → Adet → Tasarım
  // Sefa 20 May v68: cut+shape picker'lar gizliyse, gridden geldiği için
  // step 1 ve 2 "touched" varsayılır (sequential locked guard düşmesin).
  // Sefa 21 May v68 (konfigüratör denetim #2/#10 — kendi bug fix'i):
  // touchedSteps SADECE kullanıcı seçimleri için. Picker gizli ise
  // (flag false) o adım "tamamlanmış" varsayılır (kullanıcının yapacağı
  // bir şey yok). URL pre-fill'den gelenler unlockedSteps'e gider.
  const [touchedSteps, setTouchedSteps] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (!SHOW_STICKER_CUT_MODE_PICKER) initial.add(1);
    if (!SHOW_STICKER_SHAPE_PICKER) initial.add(2);
    return initial;
  });
  const unlockedSteps = useMemo(() => {
    const set = new Set<number>();
    if (initialParams.get("material")) set.add(3);
    if (initialParams.get("shape")) {
      set.add(2);
      set.add(1);
    }
    if (initialParams.get("cut")) set.add(1);
    return set;
  }, [initialParams]);

  // Sefa 21 May v68 (konfigüratör denetim #8): geçersiz URL parametresi
  // ile geldiyse kullanıcıya bilgilendirici toast — sessizce default'a
  // düşmesin. Mount'ta bir kez kontrol.
  useEffect(() => {
    const cutParam = initialParams.get("cut");
    const shapeParam = initialParams.get("shape");
    const matParam = initialParams.get("material");
    const validCuts = ["tabaka", "diecut", "kisscut"];
    const validShapes = [
      "diecut",
      "die",
      "circle",
      "square",
      "rectangle",
      "oval",
      "bumper",
      "holo",
      "transparan",
      "transparent",
      "glitter",
      "simli",
    ];
    const validMaterials = ["vinil", "transparan", "holo", "simli"];
    const bad: string[] = [];
    if (cutParam && !validCuts.includes(cutParam)) bad.push(`cut=${cutParam}`);
    if (shapeParam && !validShapes.includes(shapeParam))
      bad.push(`shape=${shapeParam}`);
    if (matParam && !validMaterials.includes(matParam))
      bad.push(`material=${matParam}`);
    if (bad.length > 0) {
      toast.info(
        `Bilinmeyen seçim (${bad.join(", ")}) — varsayılan Kare Sticker yüklendi. Üstte ürünü değiştirebilirsin.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Sefa 18 May v60: Sepete eklendi pop-up'ı
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

  // Sefa 18 May v66: Cut mode değişince TÜM seçimleri sıfırla
  // (etiket form factor refresh pattern — birebir paralel).
  // Sefa 19 May v68: Default "diecut" — kullanıcı Die Cut'a tıklayınca
  // next === cutMode oluyor, eskiden early-return touched'ı atlıyordu →
  // step 2 (Şekil) kilitli kalıyordu. Artık "aynı seçim ise" durumunda
  // sadece touched işaretle, state reset etmeden geç.
  const handleCutModeChange = useCallback(
    (next: "diecut" | "tabaka") => {
      // Aynı seçimde state'i resetleme, ama step 1'i touched yap → unlock
      if (next === cutMode) {
        setTouchedSteps((prev) =>
          prev.has(1) ? prev : new Set([...prev, 1])
        );
        return;
      }
      // Tasarım blob URL'leri temizle (memory leak yok)
      designs.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      // State'leri default'a döndür
      setCutMode(next);
      setTouchedSteps(new Set([1])); // sadece kesim tipi touched
      setShape("square");
      setSoftCorners(false);
      setMaterial("vinil");
      setFinish("parlak");
      setTier(25);
      setWidth(75);
      setHeight(75);
      setDesign(null);
      setDesignCount(1);
      setDesigns([]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cutMode, designs]
  );
  // Sefa 16 May denetim #1: i18n. EN locale'de İngilizce stepper.
  // Sefa 20 May v68 (2. revize): SHOW_STICKER_SHAPE_PICKER=false ise
  // Step 2 (Şekil) FormSection da gizlendi (köşe seçici Step 5'e taşındı).
  // stepIds + stepLabels'tan da çıkar → sequential lock + stepper UI temizlenir.
  const stepLabels = (() => {
    const labels: string[] = [];
    if (SHOW_STICKER_CUT_MODE_PICKER) labels.push(t.sticker.cutTypeTitle);
    if (SHOW_STICKER_SHAPE_PICKER) labels.push(t.sticker.shapeTitle);
    labels.push(
      t.config.materialTitle,
      t.config.finishTitle,
      t.config.sizeTitle,
      t.config.qtyTitle,
      // Sefa 21 May v68 (site denetim P1 #5): proper i18n key (locale
      // hack'i yerine designTitle eklendi — sidebar artık "Design"
      // göstermiyor TR'de).
      t.config.designTitle
    );
    return labels;
  })();
  const stepIds: readonly number[] = (() => {
    const ids: number[] = [];
    if (SHOW_STICKER_CUT_MODE_PICKER) ids.push(1);
    if (SHOW_STICKER_SHAPE_PICKER) ids.push(2);
    ids.push(3, 4, 5, 6, 7);
    return ids;
  })();
  const uiStepNumber = (domStepId: number): number => {
    const idx = stepIds.indexOf(domStepId);
    return idx === -1 ? 0 : idx + 1;
  };

  // Sefa 18 May v53: Sequential UX — basamak tamamlanmadan sonraki kilitli
  const { isLocked: isStepLocked, lockMessage: getLockMessage } =
    useSequentialSteps({
      stepIds,
      stepLabels,
      touchedSteps,
      unlockedSteps,
      locale,
    });

  // Active step — IntersectionObserver ile scroll'a göre
  const [activeStep, setActiveStep] = useState(1);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = stepIds
      .map((n, idx) => {
        const el = document.getElementById(`step-${n}`);
        return el ? { el, stepIndex: idx + 1 } : null;
      })
      .filter(
        (x): x is { el: HTMLElement; stepIndex: number } => x !== null
      );
    if (sections.length === 0) return;
    const idToIndex = new Map(
      sections.map((s) => [s.el.id, s.stepIndex])
    );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stepper noktasına tıklanınca scroll-to
  const scrollToStep = useCallback((stepIndex: number) => {
    const sectionId = stepIds[stepIndex - 1];
    if (sectionId == null) return;
    const el = document.getElementById(`step-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sticky CTA bar — PriceCard görünür değilse mobile'da bar göster
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
  // Sefa 18 May v68 (UX uzman 3.2): Sticky CTA göründüğünde Pim chat
  // butonu yukarı kaysın (etiket page pattern'i ile paralel).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
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

  // Tasarım sayısı iskonto — sticker'da da etiket pattern'i
  // 1 → %0, 2-3 → %2, 4-5 → %4, 6-10 → %6, 11-25 → %8, 26-50 → %10
  const designDiscountPct =
    designCount >= 26
      ? 10
      : designCount >= 11
        ? 8
        : designCount >= 6
          ? 6
          : designCount >= 4
            ? 4
            : designCount >= 2
              ? 2
              : 0;
  const designDiscountFactor = 1 - designDiscountPct / 100;

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

  // Faz 2: admin live_config varsa kullan, yoksa eski engine fallback.
  // Bridge null dönerse (config eksik / material ID admin'de yok) eski engine.
  // Sefa 20 May v68: pricing engine "kisscut" enum'u bilmiyor — diecut'a
  // map et (geometry/pricing impact yok). Yeni cut tipi cart config string'e
  // ayrı yansır.
  const quoteInput = {
    width,
    height,
    material,
    finish,
    qty: tier,
    cut: mapCutToLegacy(cutMode),
  };
  const quote =
    (adminConfig && quoteStickerFromConfig(adminConfig, quoteInput)) ??
    quoteCustomerSticker(quoteInput);

  // Sefa Madde 9: toplam fiyat = quote × designCount × iskonto
  // (her tasarım için ayrı baskı + tasarım sayısı iskonto v4)
  const perDesignTotal = quote.ok ? quote.total : 0;
  const rawTotal = perDesignTotal * designCount * designDiscountFactor;
  const rawUnit =
    (quote.ok ? quote.unitPrice : 0) * designDiscountFactor;
  // Sefa 20 May v68 test (fiyat tutarsızlığı fix): Konfigüratör hesabı ile
  // sepet hesabı arasında 1-2 ₺ yuvarlama farkı vardı (raw round vs unit×qty
  // linear). quantizeForCart ile her yerde tek-doğru-kaynak: 2 ondalık unit
  // × tam qty = round total. PriceCard, "Sepete Ekle" payload ve sepet
  // listesi artık her zaman aynı rakamı gösterir.
  const quantized = quantizeForCart(rawUnit, tier * designCount);
  const total = quantized.total;
  const currentUnit = quantized.unit;
  // Backward-compat: bazı log/UI yerlerinde raw değer hala kullanılıyor olabilir
  void rawTotal;
  const overrunCount = quote.ok ? quote.overrunCount : 0;
  const totalStickerCount = tier * designCount;
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
            // Sefa 21 May v68 (ürün denetim P2 #20): "Die-cut/holo" karışık
            // dil → tam Türkçe terimler.
            name: "Sticker — özel baskı",
            description:
              "Özel kesim veya tabaka. Vinil, şeffaf, holografik, simli. Laptop, defter, kampanya için. AI dosya kontrolü ile 5 iş günü içinde kargoda. 25 adetten başlar.",
            category: "Sticker",
            priceFrom: 113,
          }),
          breadcrumbSchema([
            { label: "Anasayfa", url: "/" },
            { label: "Sticker", url: "/sticker" },
          ]),
        ]}
      />
      {/* Sefa 18 May v43: /etiket sayfasıyla aynı yapı.
          Tam-genişlik strip + mercan eyebrow 'KONFIGÜRATÖR' + büyük h1.
          '25 adetten başlar' rozeti kaldırıldı (Sefa isteği). */}
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
            {/* Sefa 20 May v68: dinamik ürün başlığı — cut/material/shape
                önceliklerine göre. Örn: "Özel Kesim Sticker", "Holografik
                Sticker", "Yarı Kesim Sticker", "Sticker Sayfası". */}
            {(() => {
              const isEn = locale === "en";
              if (cutMode === "tabaka") return isEn ? "Sticker Sheet" : "Sticker Sayfası";
              if (cutMode === "kisscut") return isEn ? "Kiss-Cut Sticker" : "Yarı Kesim Sticker";
              if (material === "holo") return isEn ? "Holographic Sticker" : "Holografik Sticker";
              if (material === "simli") return isEn ? "Glitter Sticker" : "Simli Sticker";
              if (material === "transparan") return isEn ? "Clear Sticker" : "Şeffaf Sticker";
              if (shape === "bumper") return "Bumper Sticker";
              const shapeMap: Record<string, [string, string]> = {
                diecut: ["Die-Cut", "Özel Kesim"],
                die: ["Die-Cut", "Özel Kesim"],
                ozel: ["Die-Cut", "Özel Kesim"],
                circle: ["Circle", "Yuvarlak"],
                square: ["Square", "Kare"],
                rectangle: ["Rectangle", "Dikdörtgen"],
                oval: ["Oval", "Oval"],
              };
              const [en, tr] = shapeMap[shape] ?? ["Die-Cut", "Özel Kesim"];
              return isEn ? `${en} Sticker` : `${tr} Sticker`;
            })()}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-8 py-6 md:py-8 pb-20">
        {/* Sefa 18 May v43: page hero kaldırıldı (üstte strip var, duplicate
            başlık + '25 adetten başlar' rozeti gereksizdi) */}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_160px] gap-6 lg:gap-7 items-start">
          {/* LEFT — sticky preview (Sefa 18 May v67: yeni ProductPreviewShell
              + StickerLivePreview kompozisyonu. Cut mode + şekil + malzeme
              canlı yansır. Die-cut'ta beyaz kontur belirgin → ürün tipi
              görsel olarak anlatılır.) */}
          <div className="lg:sticky lg:top-20">
            <ProductPreviewShell
              width={width}
              height={height}
              view={previewView}
              onViewChange={setPreviewView}
              footnote={
                design
                  ? t.sticker.livePreviewWithFile
                  : t.sticker.livePreviewNoFile
              }
            >
              <StickerLivePreview
                // Sefa 21 May v68 (konfigüratör denetim #5): preview artık
                // tüm shape/cut tiplerini ayrı render edebiliyor — legacy
                // mapping kaldırıldı, kisscut + rectangle/oval/bumper olduğu
                // gibi gönderilir.
                cutMode={cutMode}
                shape={shape}
                softCorners={softCorners}
                material={material}
                finish={finish}
                width={width}
                height={height}
                qty={tier}
                view={previewView}
                designUrl={design?.previewUrl ?? null}
                /* Sefa 18 May v67: gerçek geometri — tabaka grid'i pricing
                 * hesabından "kaç adet sığar" üzerinden çizilir.
                 * v68: tabaka boyutu da geçirildi (üst köşe etiketi). */
                geometryCols={quote.ok ? quote.geometry.cols : undefined}
                geometryRows={quote.ok ? quote.geometry.rows : undefined}
                geometryPerSheet={
                  quote.ok ? quote.geometry.perSheet : undefined
                }
                geometrySheetsNeeded={
                  quote.ok ? quote.geometry.sheetsNeeded : undefined
                }
                geometrySheetW={quote.ok ? quote.geometry.sheetW : undefined}
                geometrySheetH={quote.ok ? quote.geometry.sheetH : undefined}
              />
            </ProductPreviewShell>
            {/* Sefa 18 May v68 (CRO denetim KRİTİK fix):
                Preview altındaki "mockup için şimdi tasarım yükle" CTA'sı
                kaldırıldı. Mockup preview feature iptal — varsayılan akış
                = sepete eklerken konfigüratör Tasarım adımında yüklenir.
                Eski versiyon misafir kullanıcı için login redirect veriyordu,
                Persona C (Canva tasarımcı) bounce ediyordu. */}
          </div>

          {/* RIGHT — config */}
          <div className="flex flex-col gap-4">
            {/* Mobile horizontal stepper — desktop'ta dikey rail var */}
            {/* Sefa 18 May v68 (UX uzman 4-mobile): Sticky mobile stepper —
                etiket page ile aynı pattern. */}
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

            {/* 1. ADIM: Kesim Tipi (Tabaka / Die Cut) — şekilden önce.
                Sefa 20 May v68 (Sticker reform): /sticker grid'den
                ?cut=... ile pre-fill geldiği için bu adım gizli.
                SHOW_STICKER_CUT_MODE_PICKER true yapılırsa geri gelir. */}
            {SHOW_STICKER_CUT_MODE_PICKER && (
            <FormSection
              id="step-1"
              number={uiStepNumber(1)}
              title={t.sticker.cutTypeTitle}
              hint={t.sticker.cutTypeHint}
            >
              <div className="grid grid-cols-2 gap-3">
                <CutModeCard
                  kind="tabaka"
                  selected={touchedSteps.has(1) && cutMode === "tabaka"}
                  onClick={() => handleCutModeChange("tabaka")}
                />
                <CutModeCard
                  kind="diecut"
                  selected={touchedSteps.has(1) && cutMode === "diecut"}
                  onClick={() => handleCutModeChange("diecut")}
                />
              </div>
            </FormSection>
            )}

            {/* Step 2 — Şekil seçici. Sefa 20 May v68 (2. revize):
                SHOW_STICKER_SHAPE_PICKER false ise tüm FormSection gizli.
                Köşe seçici Step 5 (Boyut) içine taşındı. Şekil gridten
                ?shape=... ile pre-fill geliyor, müşteri tekrar görmek
                zorunda değil. */}
            {SHOW_STICKER_SHAPE_PICKER && (
            <FormSection
              id="step-2"
              number={uiStepNumber(2)}
              title={t.sticker.shapeTitle}
              hint={
                cutMode === "tabaka"
                  ? t.sticker.shapeHintTabaka
                  : t.sticker.shapeHintDieCut
              }
              locked={isStepLocked(2)}
              lockMessage={getLockMessage(2)}
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
                    selected={touchedSteps.has(2) && shape === s.id}
                    onClick={() => {
                      setShape(s.id);
                      markTouched(2);
                      // Sefa 18 May v68: Şekil değişimi → default boyut adapte.
                      // Boyut adımı (5) henüz touched değilse otomatik:
                      //   ozel  → bumper (100×40 dar dikdörtgen)
                      //   kare/yuvarlak → kare 75×75
                      // Touched ise kullanıcı seçimi korunur.
                      if (!touchedSteps.has(5)) {
                        if (s.id === "ozel") {
                          setWidth(100);
                          setHeight(40);
                          // Bumper sticker için yumuşatılmış köşe default
                          setSoftCorners(true);
                        } else if (s.id === "square" || s.id === "circle") {
                          setWidth(75);
                          setHeight(75);
                        }
                      }
                    }}
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

              {/* Sefa 20 May v68: Köşe seçici Step 5 (Boyut) içine taşındı.
                  Eskiden burada idi. */}

              {/* Sefa 18 May v68: panel metni daha akıcı + somut.
                  Eski: "Kontur kesim ile mümkün olanlar / ve dahası ..."
                  Yeni: "Tasarımının silüetine göre kesim — her form mümkün." */}
              {shape === "die" && (
                <div className="mt-3 px-3.5 py-3 rounded-lg bg-krem-soft ring-1 ring-krem-deep">
                  <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-gri-700 mb-2">
                    Tasarımının silüetine göre kesim
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <ShapeExampleIcon kind="heart" />
                    <ShapeExampleIcon kind="star" />
                    <ShapeExampleIcon kind="wave" />
                    <ShapeExampleIcon kind="leaf" />
                    <ShapeExampleIcon kind="speech" />
                    <span className="text-[11.5px] text-gri-700 ml-1 leading-snug">
                      Tasarımın hangi formdaysa, sticker da o şekilde kesilir —
                      kalp, yıldız, yaprak, balon, dalga ya da kendi özgün
                      silüetin.
                    </span>
                  </div>
                </div>
              )}
            </FormSection>
            )}

            <FormSection
              id="step-3"
              number={uiStepNumber(3)}
              title={t.config.materialTitle}
              locked={isStepLocked(3)}
              lockMessage={getLockMessage(3)}
            >
              {/* Sefa 20 May v68: grid kart sayısına göre dinamik
                  (gridColsForCount). Kart sayısı = sütun sayısı, boş hücre yok. */}
              <div className={`${gridColsForCount(MATERIALS.length)} gap-2.5`}>
                {MATERIALS.map((m) => (
                  <SelectableCard
                    key={m.id}
                    // Sefa 21 May v68 (sistem denetim #12): URL pre-fill
                    // (?material=) ile gelen seçim de "selected ring"
                    // göstersin — kart visual preselect.
                    selected={
                      (touchedSteps.has(3) || unlockedSteps.has(3)) &&
                      material === m.id
                    }
                    onClick={() => {
                      setMaterial(m.id);
                      markTouched(3);
                    }}
                    padding={12}
                  >
                    <MaterialSwatch
                      surface={m.surface}
                      fallback={m.swatch}
                      className="w-full aspect-[2/1] mb-2"
                      label={m.name}
                    />
                    {/* Sefa 18 May v68: title min-h → 2 satır da olsa içerik üstten başlar */}
                    <div className="font-semibold text-sm min-h-[2.6em] leading-tight">
                      {m.name}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                      {m.desc}
                    </div>
                  </SelectableCard>
                ))}
              </div>
              <a
                href="/malzemeler#sticker-malzemeleri"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2.5 text-[12.5px] font-semibold text-pim-mercan hover:underline"
              >
                Malzeme detayları
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </a>

              {/* Sefa 22 May v68 Faz 3a — Transparan material seçilince
                  beyaz plan bilgi kartı. Müşteri "şeffaf etiket = arkadaki
                  yazılar görünür mü?" sorusunun cevabını burada görür.
                  Manuel upload akışı Faz 3b'de prova sayfasında. */}
              {material === "transparan" && (
                <div className="mt-3 rounded-lg border border-pim-mercan/30 bg-pim-mercan-tint/30 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="inline-block w-5 h-5 rounded shrink-0 mt-0.5 border border-gri-300"
                      style={{ backgroundColor: "white" }}
                      aria-hidden
                    />
                    <div className="flex-1 text-[12.5px] text-lacivert leading-relaxed">
                      <div className="font-semibold text-[13px] mb-1">
                        Beyaz plan otomatik hazırlanır
                      </div>
                      <p className="text-gri-700">
                        Şeffaf etikette tasarımının opaque (görünür)
                        alanları için sistem otomatik olarak beyaz alt
                        katman üretir — böylece renkler dolgun çıkar,
                        arkadaki yazı/yüzey rengi karışmaz.
                      </p>
                      <p className="mt-1.5 text-gri-700">
                        İleri tasarımcıysan ve kendi beyaz planını
                        yüklemek istiyorsan, sipariş sonrası{" "}
                        <strong className="text-pim-mercan">
                          Prova sayfasında
                        </strong>{" "}
                        manuel beyaz plan yükleyebilirsin.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </FormSection>

            <FormSection
              id="step-4"
              number={uiStepNumber(4)}
              title={t.config.finishTitle}
              locked={isStepLocked(4)}
              lockMessage={getLockMessage(4)}
            >
              <div className={`${gridColsForCount(FINISHES.length)} gap-2.5`}>
                {FINISHES.map((f) => (
                  <SelectableCard
                    key={f.id}
                    selected={touchedSteps.has(4) && finish === f.id}
                    onClick={() => {
                      setFinish(f.id);
                      markTouched(4);
                    }}
                    padding={12}
                  >
                    {/* Sefa 18 May v68: aspect-[2/1] + line-clamp-2 + title min-h */}
                    <MaterialSwatch
                      surface={f.surface}
                      className="w-full aspect-[2/1] mb-2"
                      label={f.name}
                    />
                    <div className="font-semibold text-sm min-h-[2.6em] leading-tight">
                      {f.name}
                    </div>
                    <div className="text-[13px] text-gri-700 mt-0.5 line-clamp-2 min-h-[2.5em]">
                      {f.desc}
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            <FormSection
              id="step-5"
              number={uiStepNumber(5)}
              title={t.config.sizeTitle}
              hint="Esnek boyut girebilirsin ya da en çok tercih edilen ölçülere göz atabilirsin."
              locked={isStepLocked(5)}
              lockMessage={getLockMessage(5)}
            >
              {/* Sefa 20 May v68 (test geri bildirim): Köşe seçeneği — eski
                  L-ikon kart formatı geri getirildi (etiket ile paralel,
                  commit 2aa0c83 pattern). Pill chip → 2 büyük kart yan yana. */}
              {supportsCornerStyle(shape) && (
                <div className="mb-4">
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-lacivert mb-2">
                    {locale === "en" ? "Corner option" : "Köşe seçeneği"}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(["sharp", "soft"] as const).map((opt) => {
                      const active =
                        opt === "soft" ? softCorners : !softCorners;
                      const stroke = active
                        ? "var(--color-pim-mercan)"
                        : "var(--color-lacivert)";
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSoftCorners(opt === "soft")}
                          aria-pressed={active}
                          // Sefa 21 May v68 (ürün denetim P2 #19): "Düz" ve
                          // "Keskin" kullanıcıya benzer geliyor; tooltip ile
                          // farkı açıkla.
                          title={
                            opt === "sharp"
                              ? "90° keskin köşe — kart hissi"
                              : "Yuvarlatılmış köşe (~5 mm yarıçap) — yumuşak görünüm"
                          }
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

              {/* Sefa 21 May v68 (ürün denetim P0 #3 + #4): Boyut input
                  şekle göre dinamik etiketlenir.
                    - circle  → tek input "Çap"
                    - square  → tek input "Kenar" (eş kenar orantı kilidi)
                    - oval    → "Uzun eksen × Kısa eksen"
                    - bumper  → "Uzun kenar × Kısa kenar"
                    - diğer   → "Genişlik × Yükseklik" (mevcut) */}
              {shape === "circle" || shape === "square" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                      {shape === "circle" ? "Çap (mm)" : "Kenar (mm)"}
                    </span>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => {
                        const v = Math.max(
                          STICKER_MIN_DIM,
                          Math.min(
                            STICKER_MAX_W,
                            Number(e.target.value) || STICKER_MIN_DIM
                          )
                        );
                        setWidth(v);
                        setHeight(v); // orantı kilidi — daire/kare eş kenar
                        markTouched(5);
                      }}
                      min={STICKER_MIN_DIM}
                      max={STICKER_MAX_W}
                      step={1}
                      className={cn(
                        "block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all tabular-nums",
                        presetPulseAt
                          ? "ring-pim-mercan ring-2 shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]"
                          : "ring-gri-200"
                      )}
                    />
                  </label>
                  <div className="hidden sm:flex items-end pb-2 text-[11.5px] text-gri-500">
                    ⓘ {shape === "circle"
                      ? "Daire için çap = genişlik = yükseklik (orantı kilidi)"
                      : "Kare için kenar = genişlik = yükseklik (orantı kilidi)"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    {shape === "oval"
                      ? "Uzun eksen (mm)"
                      : shape === "bumper"
                        ? "Uzun kenar (mm)"
                        : "Genişlik (mm)"}
                  </span>
                  {/* Sefa 21 May v68: ClampedNumberInput — onBlur'da clamp.
                      Önce keystroke'ta clamp ediyordu, kullanıcı 252→25 silmek
                      isteyince anında 60'a (MIN) snap oluyordu. */}
                  <ClampedNumberInput
                    value={width}
                    onChange={(v) => {
                      setWidth(v);
                      markTouched(5);
                    }}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_W}
                    step={1}
                    className={cn(
                      "block w-full h-12 px-3.5 rounded-[12px] bg-white text-[15px] font-medium text-lacivert ring-1 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all tabular-nums",
                      presetPulseAt
                        ? "ring-pim-mercan ring-2 shadow-[0_0_0_4px_var(--color-pim-mercan-tint)]"
                        : "ring-gri-200"
                    )}
                  />
                </label>
                <span className="text-gri-500 font-medium pb-3.5 text-lg">×</span>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gri-700 mb-1.5 block">
                    {shape === "oval"
                      ? "Kısa eksen (mm)"
                      : shape === "bumper"
                        ? "Kısa kenar (mm)"
                        : "Yükseklik (mm)"}
                  </span>
                  <ClampedNumberInput
                    value={height}
                    onChange={(v) => {
                      setHeight(v);
                      markTouched(5);
                    }}
                    min={STICKER_MIN_DIM}
                    max={STICKER_MAX_H}
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

              {/* Sefa 20 May v68 (test): Boyut preset chip'leri shape'e göre.
                  Yuvarlak için 30×30...90×90 (cm cinsinden 3×3...9×9 mantığı,
                  mm'ye çevrilmiş), diğer şekiller için tam mevcut liste. */}
              <div className="mt-4">
                <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-2">
                  En çok tercih edilen ölçüler (mm)
                </div>
                <div className="flex gap-2 flex-wrap">
                {/* Sefa 21 May v68 (ürün denetim P0 #2 + #4): preset
                    listesi şekle göre kendi anlamlı setine sahip.
                      - circle: çap (30-90 mm)
                      - square: eş kenar (30-150 mm)
                      - bumper: uzun yatay formatlar (150-300 mm)
                      - oval:   uzun×kısa eksen oranlı (60-120 mm)
                      - die/rectangle/diğer: genel dikdörtgen 15 ölçü */}
                {(shape === "circle"
                  ? [
                      { w: 30, h: 30, label: "30×30" },
                      { w: 40, h: 40, label: "40×40" },
                      { w: 50, h: 50, label: "50×50" },
                      { w: 60, h: 60, label: "60×60" },
                      { w: 70, h: 70, label: "70×70" },
                      { w: 80, h: 80, label: "80×80" },
                      { w: 90, h: 90, label: "90×90" },
                    ]
                  : shape === "square"
                  ? [
                      { w: 30, h: 30, label: "30×30" },
                      { w: 40, h: 40, label: "40×40" },
                      { w: 50, h: 50, label: "50×50" },
                      { w: 60, h: 60, label: "60×60" },
                      { w: 70, h: 70, label: "70×70" },
                      { w: 80, h: 80, label: "80×80" },
                      { w: 100, h: 100, label: "100×100" },
                      { w: 150, h: 150, label: "150×150" },
                    ]
                  : shape === "bumper"
                  ? [
                      { w: 150, h: 50, label: "150×50" },
                      { w: 200, h: 50, label: "200×50" },
                      { w: 220, h: 60, label: "220×60" },
                      { w: 250, h: 75, label: "250×75" },
                      { w: 280, h: 80, label: "280×80" },
                      { w: 300, h: 100, label: "300×100" },
                    ]
                  : shape === "oval"
                  ? [
                      { w: 50, h: 30, label: "50×30" },
                      { w: 60, h: 40, label: "60×40" },
                      { w: 70, h: 50, label: "70×50" },
                      { w: 80, h: 50, label: "80×50" },
                      { w: 100, h: 60, label: "100×60" },
                      { w: 120, h: 70, label: "120×70" },
                      { w: 150, h: 90, label: "150×90" },
                    ]
                  : [
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
                ]).map((preset) => {
                  const active =
                    touchedSteps.has(5) &&
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
                        // Input pulse animasyonu
                        setPresetPulseAt(Date.now());
                        setTimeout(() => setPresetPulseAt(null), 700);
                      }}
                      className={cn(
                        "px-3 h-10 md:h-8 rounded-full text-[12px] font-semibold transition-colors",
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

              {sizeError && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-kirmizi/10 text-kirmizi text-[12.5px] font-semibold">
                  ⚠️ {sizeError}
                </div>
              )}
            </FormSection>

            <FormSection
              id="step-6"
              number={uiStepNumber(6)}
              title={t.config.qtyTitle}
              hint="Her tasarımdan kaç adet"
              locked={isStepLocked(6)}
              lockMessage={getLockMessage(6)}
            >
              {/* Sefa kuralı (Madde 9 + v4): adet bilgisi göster, fiyat
                  TOPLAM kartında. Duplicate kaldırıldı. */}
              <div className="mb-3">
                <span className="text-[28px] font-bold text-lacivert tabular-nums leading-none">
                  {tier.toLocaleString("tr-TR")}
                  <span className="text-[14px] font-medium text-gri-700 ml-1">
                    adet
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {savings > 0 && (
                  <div className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                    %{savings} tasarruf 🎯 — adet indirimi
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

              {/* Preset chip'leri — TEK seçim yöntemi
                  Faz 2 (Sefa 19 May v68): adminConfig.tiers > STICKER_PRESETS */}
              <div className="flex gap-2 mt-4 flex-wrap items-center">
                <span className="text-[11.5px] text-gri-500 mr-1">
                  {t.config.suggested}
                </span>
                {(adminConfig?.tiers
                  ? [...adminConfig.tiers]
                      .sort((a, b) => a.qty - b.qty)
                      .map((t) => t.qty)
                  : STICKER_PRESETS
                ).map((q) => {
                  const active = touchedSteps.has(6) && tier === q;
                  const popular = q === STICKER_POPULAR_PRESET;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setTier(q);
                        markTouched(6);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "relative px-3 h-10 md:h-8 rounded-full text-[12.5px] font-semibold transition-colors tabular-nums",
                        active
                          ? "bg-pim-mercan text-white"
                          : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
                      )}
                    >
                      {q}
                      {popular && !active && <PopulerBadge variant="inline" />}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* Çoklu tasarım yükleyici + designCount input (Sefa Madde 9)
                Mig 061: Tasarım zorunlu değil — boş bırakırsan ödeme sonrası
                /siparis/[id]/tasarim-yukle sayfasından yükleyebilirsin. */}
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
                qtyPerDesign={tier}
                productLabel="sticker"
              />
              {designDiscountPct > 0 && (
                <p className="mt-3 text-[12px] text-pim-mercan font-semibold">
                  ✨ {designCount} tasarım için <strong>%{designDiscountPct} iskonto</strong> uygulanıyor — fiyat kartında görünür
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

            {/* Sefa 18 May v68 (6): Sağdaki "Tabaka yerleşimi" kaldırıldı.
                Sol canlı önizlemede zaten tabaka yerleşimi gösteriliyor
                (eskiz modunda referans tarz). Bu bilgi admin tarafında
                ayrıca üretim diagramı olarak kalır. */}

            <div ref={priceCardRef}>
            <PriceCard
              /* Sefa 21 May v68: /etiket konfigüratör pattern'ine taşındı.
                 variant=bold (lacivert SEÇİMİN) → variant=quiet (krem TOPLAM)
                 unitPrice "X adet × Y ₺" → "Birim fiyat Y ₺/adet"
                 footnote kaldırıldı (KDV bilgisi unitPrice'da, özet kart içinde)
                 Multi-design adet bilgisi İŞLEM ÖZETİ'nde otomatik. */
              variant="quiet"
              topLabel="TOPLAM"
              total={total}
              // İŞLEM ÖZETİ — buildSummaryItems helper (tek-doğru-kaynak).
              // Sipariş detay sayfasında da aynı helper kullanılır.
              summaryItems={buildSummaryItems(
                {
                  id: "preview",
                  product: "sticker",
                  title: "",
                  config: "",
                  width,
                  height,
                  qty: tier * designCount,
                  unit: currentUnit,
                  total,
                  shape: mapShapeToLegacy(shape),
                  cut: mapCutToLegacy(cutMode),
                  softCorners,
                  material,
                  finish,
                  designCount: designCount > 1 ? designCount : undefined,
                  addedAt: 0,
                },
                locale
              )}
              unitPrice={
                <>
                  Birim fiyat{" "}
                  <strong className="text-lacivert">
                    {fmtUnit(currentUnit)} ₺/adet
                  </strong>{" "}
                  · KDV dahil
                </>
              }
              savingsLabel={savings > 0 ? `%${savings} adet indirimi` : null}
              footnote={null}
              pendingStepsCount={
                stepIds.filter(
                  (id) => id !== 7 && !touchedSteps.has(id)
                ).length
              }
              firstPendingStepLabel={(() => {
                const firstPending = stepIds.find(
                  (id) => id !== 7 && !touchedSteps.has(id)
                );
                if (firstPending == null) return undefined;
                const idx = stepIds.indexOf(firstPending);
                return stepLabels[idx];
              })()}
              deliveryDate={deliveryEstimate({ kind: "sticker", qty: totalStickerCount })}
              ctaLabel={ctaLabel}
              onCta={async () => {
                // Sefa 20 May v68: zorunlu step kontrolü — touched değilse
                // o adıma scroll + flash + toast. Tasarım (7) opsiyonel.
                const OPTIONAL_STEPS = new Set([7]);
                const missingStepId = stepIds.find(
                  (id) => !OPTIONAL_STEPS.has(id) && !touchedSteps.has(id)
                );
                if (missingStepId != null) {
                  const idx = stepIds.indexOf(missingStepId);
                  const label = stepLabels[idx] ?? "önceki";
                  toast.error(
                    locale === "en"
                      ? `Complete "${label}" first.`
                      : `Önce "${label}" adımını seç.`
                  );
                  scrollToStep(idx + 1);
                  const el = document.getElementById(`step-${missingStepId}`);
                  if (el) {
                    el.classList.add("ring-2", "ring-pim-mercan", "ring-offset-2", "transition-all");
                    el.style.boxShadow = "0 0 0 4px var(--color-pim-mercan-tint)";
                    setTimeout(() => {
                      el.classList.remove("ring-2", "ring-pim-mercan", "ring-offset-2");
                      el.style.boxShadow = "";
                    }, 2500);
                  }
                  return;
                }
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
                // Çoklu tasarım için title'da designCount belirt
                const titleSuffix =
                  designCount > 1 ? ` (${designCount} tasarım)` : "";

                // Sefa 22 May v68 — C sorun fix (etiket paralel): tasarımsız
                // sepete ekle BİLİNÇLİ olsun. Native confirm — modal eklemeden
                // hızlı UX guard. Bilinçsiz "atlama" sonucu awaiting_upload
                // sipariş açılmasını önler. İptal → tasarım step'ine kaydır.
                const hasNoDesign = designs.length === 0;
                if (hasNoDesign) {
                  const confirmed = window.confirm(
                    "Tasarım yüklemeden devam etmek istiyor musun?\n\n" +
                      "Ödeme sonrası 'Tasarımını yükle' sayfasına yönlendirileceksin (3 gün süre, hatırlatma mail'i alacaksın).\n\n" +
                      "TAMAM = Sonra yükleyeceğim, sepete ekle\n" +
                      "İPTAL = Önce tasarımı yükleyeceğim (geri dön)"
                  );
                  if (!confirmed) {
                    const designStepId = stepIds.find((id) => id === 7);
                    if (designStepId !== undefined) {
                      scrollToStep(designStepId);
                    }
                    return;
                  }
                }

                // Sefa 20 May v68 (test): Native image/PSD/PDF için kalıcı
                // Supabase URL üret. design.generatedPreviewUrl varsa onu kullan
                // (DesignDropZone zaten Supabase'e yüklüyor), yoksa designs[0]
                // için persistDesignPreview ile yükle.
                let _resolvedPreviewUrl: string | undefined =
                  design?.generatedPreviewUrl;
                if (!_resolvedPreviewUrl && designs[0]) {
                  const { persistDesignPreview } = await import(
                    "@/lib/design-preview"
                  );
                  const url = await persistDesignPreview(
                    designs[0].file,
                    designs[0].id
                  );
                  _resolvedPreviewUrl = url ?? undefined;
                }

                const result = await addToCustomerCart({
                  product: "sticker",
                  title: `Sticker · ${matName} + ${finName}${titleSuffix}`,
                  config: `${shapeName} · ${width}×${height}mm · ${cutLabel}${cornerLabel}`,
                  width,
                  height,
                  qty: totalStickerCount, // tier × designCount
                  unit: parseFloat(currentUnit.toFixed(2)),
                  total: Math.round(total),
                  // Sefa 20 May v68: yeni shape/cut değerleri legacy enum'a
                  // map edilir. Cart config string'i ayrıca yeni etiketleri
                  // saklar (config field gerçek seçimi tutar).
                  shape: mapShapeToLegacy(shape),
                  cut: mapCutToLegacy(cutMode),
                  softCorners,
                  material,
                  finish,
                  hediyeAdet: overrunCount * designCount,
                  designTempId: design?.tempId,
                  // Sefa 20 May v68 (test geri bildirim "önizleme gözükmüyor"):
                  // Native image (PNG/JPG) için blob URL session-scope; sayfa
                  // refresh sonrası 404. _resolvedPreviewUrl yukarıda
                  // persistDesignPreview ile auth varsa kalıcı Supabase URL.
                  designPreviewUrl: _resolvedPreviewUrl,
                  designFileName: design?.fileName ?? designs[0]?.name,
                  designMimeType: design?.mimeType ?? designs[0]?.mimeType,
                  // Multi-design metadata (Sefa 15 May v5):
                  // Sticker'da PendingDesign local-only (Supabase upload yok)
                  // — sadece designCount metadata gönder + sipariş sonrası
                  // mail ile gerçek dosyalar yüklenecek.
                  designCount: designCount > 1 ? designCount : undefined,
                  additionalDesigns:
                    designs.length > 0
                      ? designs.map((d) => ({
                          // tempId yok (local-only) → name'i kullan
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
                // Sefa 20 May v68 test #3: Düzenle akışı — yeni item eklendi,
                // eski item'ı sepetten sil (replace pattern). editingItemId
                // null'a çek ki tekrar submit'te yeniden silmesin.
                if (editingItemId) {
                  await removeFromCustomerCart(editingItemId);
                  setEditingItemId(null);
                }
                // Sefa 18 May v60-v61: toast yerine modal popup; locale-aware
                const summary =
                  designs.length > 0
                    ? `${matName} · ${width}×${height} mm · ${designCount} ${locale === "en" ? "designs" : "tasarım"} × ${tier.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} = ${totalStickerCount.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} ${t.cart.unitSticker}`
                    : `${matName} · ${width}×${height} mm · ${tier.toLocaleString(locale === "en" ? "en-US" : "tr-TR")} ${t.cart.unitPiece}`;
                setCartSuccessSummary(summary);
                setCartSuccessOpen(true);

                // Tasarım state'ini sıfırla — yeni eklemede temiz başla
                setDesign(null);
                // Çoklu tasarım kullanıldıysa local preview'ları temizle
                if (designs.length > 0) {
                  designs.forEach((d) => URL.revokeObjectURL(d.previewUrl));
                  setDesigns([]);
                  setDesignCount(1);
                }
              }}
            />
            </div>
          </div>

          {/* RAIL — desktop only dikey stepper (Sefa 15 May v4) */}
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

      {/* Sefa 18 May v68: ProductInfoSection (3 feature söylemi) kaldırıldı.
          Yorumlar direkt gösterilir. */}
      <ProductReviews productType="sticker" limit={6} />

      {/* Sticky checkout bar — mobile-only (Sefa 15 May v4) */}
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
            {totalStickerCount.toLocaleString("tr-TR")} sticker · {width}×{height}mm · KDV dahil
          </div>
        </div>
        <Link
          href="#step-1"
          onClick={(e) => {
            e.preventDefault();
            scrollToStep(7);
          }}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5",
            "bg-pim-mercan text-white font-bold text-[14px]",
            "px-5 h-11 rounded-full shadow-1",
            "active:scale-[0.98] transition-transform"
          )}
        >
          Tamamla
          <Icon.ArrowR size={14} />
        </Link>
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
          {/* 2 col × 3 row asimetrik kontur (Pim karga tasarımcı görselle uyum için)
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
  // Sefa 16 May denetim #1: i18n
  const { t } = useT();
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
          {/* Sefa 18 May v68 (UX uzman 2.4): teknik terim '?' tooltip */}
          <div className="font-bold text-[14px] mb-0.5 inline-flex items-center gap-1.5">
            <span>{kind === "tabaka" ? t.sticker.cutTabaka : t.sticker.cutDieCut}</span>
            <InfoTooltip
              text={
                kind === "tabaka"
                  ? "Tabaka: Sticker'lar tek bir kağıt üzerine yarım kesimli olarak basılır, sen elle ayırırsın. Toplu dağıtım, etkinlik veya kırtasiye sticker'ı için ideal."
                  : "Die Cut (Kontur Kesim): Her sticker tasarımın silüetine göre tek tek kesilir. Profesyonel ürün ambalajı görüntüsü, her sticker hazır gelir."
              }
            />
          </div>
          <div className="text-[11.5px] text-gri-700 leading-snug">
            {kind === "tabaka"
              ? t.sticker.cutTabakaDesc
              : t.sticker.cutDieCutDesc}
          </div>
          <div className="text-[10.5px] text-gri-500 mt-1.5 tabular-nums">
            {kind === "tabaka" ? "6 mm gap" : "50 mm gap"}
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
  // Sefa 16 May denetim #1: i18n
  const { t } = useT();
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
            {kind === "sharp" ? t.sticker.cornerSharp : t.sticker.cornerSoft}
          </div>
          <div className="text-[10.5px] text-gri-700 leading-tight">
            {kind === "sharp"
              ? t.sticker.cornerSharpDesc
              : t.sticker.cornerSoftDesc}
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
  const { t } = useT();
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

  // Sefa kuralı (11 May): Kontur kesim modunda PNG yüklenince, malzeme
  // özelliğini ifade eden BELİRGİN kontur. Multi-stack drop-shadow ile
  // PNG'nin alpha siluetini takip eden halo.
  //   - vinil    : kalın beyaz outline (klasik die-cut görüntüsü)
  //   - transparan: checker pattern bg + ince dark shadow
  //   - holo     : holografik gradient renkli halo
  //   - simli    : beyaz outline + sıcak sim parıltısı
  const dieFilterByMaterial: Record<StickerMaterial, string> = {
    vinil:
      "drop-shadow(0 0 6px white) drop-shadow(0 0 6px white) drop-shadow(0 0 6px white) drop-shadow(0 8px 24px rgba(31,41,55,0.25)) drop-shadow(0 4px 8px rgba(31,41,55,0.12))",
    transparan:
      "drop-shadow(0 4px 12px rgba(31,41,55,0.2)) drop-shadow(0 2px 4px rgba(31,41,55,0.1))",
    holo:
      "drop-shadow(0 0 4px #FFB7E5) drop-shadow(0 0 4px #B7E8FF) drop-shadow(0 0 4px #FFE8B7) drop-shadow(0 0 6px white) drop-shadow(0 8px 16px rgba(31,41,55,0.2))",
    simli:
      "drop-shadow(0 0 6px white) drop-shadow(0 0 6px white) drop-shadow(0 0 10px rgba(255,232,183,0.7)) drop-shadow(0 0 14px rgba(255,183,229,0.5)) drop-shadow(0 8px 16px rgba(31,41,55,0.2))",
  };

  // Transparan malzeme için checker pattern — şeffaf zemini ifade eden
  // Figma/Photoshop standart transparent-layer görüntüsü
  const transparentCheckerBg =
    "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%), white";

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
      className="relative rounded-2xl p-5 md:p-8 min-h-[360px] md:min-h-[540px] overflow-hidden shadow-1"
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

      {/* Live indicator — Sefa 16 May UX denetim P1-5: etiket
          ile aynı i18n key (t.config.livePreviewBadge) */}
      <span className="absolute top-5 left-5 inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-full bg-white shadow-1 text-[12.5px] font-semibold">
        <span className="w-2 h-2 rounded-full bg-yesil" />
        {t.config.livePreviewBadge}
      </span>

      {/* Sticker */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{ transform: "translate(-50%, -50%) rotate(-6deg)" }}
      >
        {shape === "die" ? (
          // Kontur kesim: tasarım varsa onu göster (kontur müşteri tasarımına
          // göre kesilecek), yoksa Pim silüet placeholder.
          // Sefa kuralı: malzeme-bazlı belirgin kontur (dieFilterByMaterial).
          <div className="relative grid place-items-center">
            {/* Transparan malzeme + tasarım yüklü: checker pattern arkaplan
                (şeffaf zemini görsel olarak ifade eder). Diğer
                malzemelerde checker yok. */}
            {material === "transparan" && designUrl && (
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: transparentCheckerBg,
                  backgroundSize:
                    "16px 16px, 16px 16px, 16px 16px, 16px 16px",
                  backgroundPosition:
                    "0 0, 0 8px, 8px -8px, -8px 0px",
                  opacity: 0.5,
                  margin: -8,
                }}
              />
            )}
            <div
              className="relative grid place-items-center"
              style={{
                filter: designUrl
                  ? dieFilterByMaterial[material]
                  : // Tasarım yokken Pim için klasik halo
                    "drop-shadow(0 0 4px white) drop-shadow(0 0 4px white) drop-shadow(0 8px 24px rgba(31,41,55,0.25))",
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
                // Sefa 16 May UX denetim P2-4: Pim kargayı yerine
                // nötr placeholder (Pim sticker satıyor algısı kalkar)
                <div
                  className="grid place-items-center text-center"
                  style={{
                    width: Math.min(minDim * scale * 1.2, 360),
                    height: Math.min(minDim * scale * 1.2, 360),
                  }}
                  aria-label="Tasarım önizleme alanı"
                >
                  <div className="opacity-60">
                    <Icon.Plus
                      size={36}
                      className="mx-auto mb-2 text-lacivert"
                    />
                    <div className="text-[12.5px] font-semibold text-lacivert">
                      Tasarımını yükle
                    </div>
                    {/* Sefa 21 May v68 (site denetim P2 #11): üst metin
                        her zaman "Kontur kesim" diyordu, kare/yuvarlak
                        şekilde de yanlış görünüyordu. Şekle göre dinamik. */}
                    <div className="text-[10.5px] text-gri-700 mt-0.5">
                      {shape === "die" || shape === "die" + "cut"
                        ? "Kontur kesim · tasarımın silüetine kesilir"
                        : shape === "circle"
                          ? "Yuvarlak kesim · alanın dairesel kesilir"
                          : shape === "oval"
                            ? "Oval kesim"
                            : shape === "bumper"
                              ? "Bumper — uzun yatay kesim"
                              : shape === "rectangle"
                                ? "Dikdörtgen kesim"
                                : "Kare kesim"}
                    </div>
                  </div>
                </div>
              )}
              {/* Holografik / simli renk overlay — tasarım siluetinin
                  üstüne malzeme tonu yansıtır (kontur drop-shadow zaten
                  malzemeyi ifade ediyor, bu içeride ton verir) */}
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
                // Sefa 16 May UX denetim P2-4: Nötr placeholder
                <div
                  className="grid place-items-center text-center w-full h-full"
                  aria-label="Tasarım önizleme alanı"
                >
                  <div className="opacity-60">
                    <Icon.Plus
                      size={28}
                      className="mx-auto mb-1.5 text-lacivert"
                    />
                    <div className="text-[11.5px] font-semibold text-lacivert">
                      Tasarımını yükle
                    </div>
                  </div>
                </div>
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

      {/* Size badge — Sefa 16 May denetim #18: etiket ile aynı i18n key */}
      <div className="absolute bottom-5 left-5 px-3 py-2 bg-white rounded-lg shadow-1">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
          {t.config.dimensionBadge}
        </div>
        <div className="font-semibold text-sm">
          {width} × {height} mm
        </div>
      </div>

      {/* Pim chat bubble kaldırıldı (Sefa 15 May v4) — sağ alt floating
          PimChat tek persona kanalı. */}
    </div>
  );
}
