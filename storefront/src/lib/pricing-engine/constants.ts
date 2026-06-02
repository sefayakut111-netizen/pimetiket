/**
 * Sticker pricing — fiziksel sabit ve constraint'ler.
 *
 * Kaynak: docs/PRICING_SPEC.md §3, §12
 * Modül: sticker-fiyatlama.html v0.3 (Sefa Yakut, 2026-05-09)
 *
 * Bu sabitler matbaa ekipmanı + standart zarflara göre belirlenmiş;
 * değiştirilirken üretim hattıyla teyit edilmeli.
 */

// ============================================================
// Rulo (baskı malzemesi rulosu) fiziksel sınırları
// ============================================================

/** Plotter maksimum genişlik */
export const ROLL_W_MAX = 600;

/** Çalışılabilir minimum genişlik */
export const ROLL_W_MIN = 250;

/** Rulo boy — sabit fiziksel sınır */
export const ROLL_L = 1520;

/** Alt/üst kenar kesim markası (en yönü, her iki yan) */
export const ROLL_MARGIN_X = 30;

/** Sol başlangıçta plotter boşluğu (boy yönü) */
export const ROLL_START_MARGIN = 30;

/** Sağ uçta plotter boşluğu (boy yönü) */
export const ROLL_END_MARGIN = 80;

/** Die-cut rulo tabaka EN — SABİT 1500mm (Sefa 2 Haz). Tabaka akışı ROLL_L kullanır; DOKUNMA. */
export const DIECUT_EN = 1500;

// ============================================================
// Kiss-cut / tabaka — esnek iç tabaka (sticker yarım kesim)
// ============================================================

/** Dış tabaka üst sınırı — 23×31 cm */
export const TABAKA_OUTER_MAX_W = 230;
export const TABAKA_OUTER_MAX_H = 310;

/** Her kenarda 1 cm baskısız kenar payı */
export const TABAKA_EDGE_MARGIN = 10;

/** Kullanılabilir grid alanı (210×290 mm) */
export const TABAKA_USABLE_W =
  TABAKA_OUTER_MAX_W - 2 * TABAKA_EDGE_MARGIN; // 210
export const TABAKA_USABLE_H =
  TABAKA_OUTER_MAX_H - 2 * TABAKA_EDGE_MARGIN; // 290

/** Üretim adet fazlası tercih üst sınırı (%10) — min fire ile birlikte seçim */
export const OVERAGE_TARGET_MAX = 0.10;

// ============================================================
// Üretim toleransları
// ============================================================

/**
 * Ölçü yuvarlama adımı (mm).
 *
 * Sefa iş kuralı (11 May): "Müşteri 38x48 mm girdiğinde hesaplama
 * 40x50'ye yukarı yuvarlanır — her mm'de hesaplama yapma, 5 mm
 * katlarında yap." Bu hem hesaplama tutarlılığı hem matbaa kesim
 * paterni için doğru.
 */
export const SIZE_SNAP_STEP_MM = 5;

/** Tek bir ölçüyü 5 mm katına yukarı yuvarlar. */
export function snapSizeUp(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.ceil(mm / SIZE_SNAP_STEP_MM) * SIZE_SNAP_STEP_MM;
}

/** Tabaka modunda sticker'lar arası boşluk (yarım kesim) */
export const GAP_TABAKA = 3;

/** Die-cut modunda sticker'lar arası boşluk (tam kesim, direkt rulo) */
export const GAP_DIECUT = 20;

// ============================================================
// Adet kademeleri (tier sistemi) — sticker
// ============================================================

export interface StickerTier {
  qty: number;
  /** preTierSubtotal'a uygulanan çarpan */
  multiplier: number;
  /** UI gösterimi: zam %X / referans / indirim %X */
  label: string;
}

export const STICKER_TIERS: StickerTier[] = [
  { qty: 25, multiplier: 1.30, label: "+%30 zam" },
  { qty: 50, multiplier: 1.20, label: "+%20 zam" },
  { qty: 100, multiplier: 1.10, label: "+%10 zam" },
  { qty: 250, multiplier: 1.00, label: "referans" },
  { qty: 500, multiplier: 0.90, label: "−%10 indirim" },
  { qty: 1000, multiplier: 0.80, label: "−%20 indirim" },
];

/** Sticker minimum sipariş adedi */
export const STICKER_MIN_QTY = 25;

/** Sticker maksimum sipariş adedi (tek tasarım için) */
export const STICKER_MAX_QTY = 1000;

// ============================================================
// Sepet grup indirimi (aynı boyut çoklu tasarım)
// ============================================================

export interface GroupDiscountTier {
  /** Aynı boyutta minimum tasarım sayısı */
  minCount: number;
  /** İndirim oranı (0-1 arası) */
  rate: number;
}

/** Inclusive minCount eşikleri, en yüksek match seçilir */
export const GROUP_DISCOUNT_TIERS: GroupDiscountTier[] = [
  { minCount: 10, rate: 0.10 },
  { minCount: 6, rate: 0.08 },
  { minCount: 3, rate: 0.05 },
  { minCount: 2, rate: 0.03 },
];

// ============================================================
// Lot prefix
// ============================================================

export const LOT_PREFIX_STICKER = "A";
export const LOT_PREFIX_ETIKET = "B";

// ============================================================
// ETİKET — rulo etiket parametreleri (Yön 3)
// ============================================================

export const ETIKET_MIN_QTY = 1000;
// Sefa 20 May v68: max 50.000 → 25.000; Mig audit P0: pricebook 10K ile hizala.
export const ETIKET_MAX_QTY = 10000;
export const ETIKET_GAP_DEFAULT = 6;

/** Rulo etiket müşteri ebat sınırları — genişlik/yükseklik yönü sabit (döndürme yok). */
export const ETIKET_RULO_MIN_W = 15;
export const ETIKET_RULO_MIN_H = 25;
export const ETIKET_RULO_MAX_W = 300;
export const ETIKET_RULO_MAX_H = 500;

/**
 * Etiket rulo standart boyu (mm). Sticker'ın ROLL_L=1520 sabitinden
 * AYRI: gerçek etiket rulolarımız 50 metre (= 50000 mm) standardında.
 * Atölyenin rulo değişim sıklığını yansıtır (büyük partilerde gerçek
 * rulo sayısı = ceil(totalLength / 50000)).
 */
export const ETIKET_ROLL_L = 50000;

/** Etiket rulosu üst margin — rulo başlangıcı için boşluk (mm) */
export const ETIKET_ROLL_MARGIN_Y = 50;

export interface EtiketTier {
  qty: number;
  multiplier: number;
  label: string;
}

/** Etiket tier'ları — 5000 referans (sticker'da 250 referans) */
export const ETIKET_TIERS: EtiketTier[] = [
  { qty: 1000, multiplier: 1.10, label: "+%10 zam" },
  { qty: 2000, multiplier: 1.05, label: "+%5 zam" },
  { qty: 5000, multiplier: 1.00, label: "referans" },
  { qty: 10000, multiplier: 0.95, label: "−%5 indirim" },
  { qty: 15000, multiplier: 0.92, label: "−%8 indirim" },
  { qty: 20000, multiplier: 0.90, label: "−%10 indirim" },
  { qty: 25000, multiplier: 0.88, label: "−%12 indirim" },
];

/** Etiket malzemesi — fason rate multiplier */
export interface EtiketMaterial {
  id: string;
  name: string;
  desc: string;
  swatch: string;
  multiplier: number;
}

export const ETIKET_MATERIALS: EtiketMaterial[] = [
  { id: "kraft", name: "Kraft", desc: "Doğal, dokunsal", swatch: "#C9A47A", multiplier: 1.0 },
  { id: "beyaz", name: "Opak PP", desc: "Yırtılmaz, suya dayanıklı", swatch: "#F8F8F4", multiplier: 1.10 },
  // Sefa eklemesi (15 May): Kuşe — standart matbaa kaplamalı kağıdı.
  // Hem rulo hem tabaka modunda kullanılır. Kraft'tan biraz pahalı.
  { id: "kuse", name: "Kuşe", desc: "Pürüzsüz kâğıt etiket", swatch: "#FAFAF4", multiplier: 1.05 },
  // Sefa 18 May v42: Şeffaf etiket eklendi (ultra clear'dan biraz ucuz)
  { id: "seffaf", name: "Şeffaf Etiket", desc: "Arka planı gösteren saydam etiket", swatch: "linear-gradient(135deg,#F0F9FF,#FFFFFF,#E0F2FE)", multiplier: 1.25 },
  { id: "ultra", name: "Ultra Clear", desc: "Tamamen şeffaf görünmez film", swatch: "linear-gradient(135deg,#E0F2FE,#FFFFFF)", multiplier: 1.35 },
  { id: "metalik", name: "Metalize", desc: "Parlak metalik yüzey", swatch: "linear-gradient(135deg,#C0C7CD,#EFF2F6,#B2BAC2)", multiplier: 1.60 },
];

export interface EtiketCoating {
  id: string;
  name: string;
  desc: string;
  multiplier: number;
}

export const ETIKET_COATINGS: EtiketCoating[] = [
  { id: "yok", name: "Kaplamasız", desc: "Kâğıt dokusu kalsın", multiplier: 1.0 },
  { id: "mat", name: "Mat selefon", desc: "Yansımasız, premium", multiplier: 1.15 },
  { id: "parlak", name: "Parlak selefon", desc: "Canlı, temiz", multiplier: 1.15 },
  { id: "soft", name: "Soft touch", desc: "Velvet his", multiplier: 1.30 },
];

export interface EtiketCustomization {
  id: string;
  name: string;
  desc: string;
  multiplier: number;
}

/** Sefa: "özelleştirme % olarak ana ürüne eklenir" */
export const ETIKET_CUSTOMIZATIONS: EtiketCustomization[] = [
  { id: "yok", name: "Özelleştirme yok", desc: "Sade baskı (emboss/yaldız/spot UV yok)", multiplier: 1.0 },
  { id: "emboss", name: "Kabartma (emboss)", desc: "Logo / metin kabartması", multiplier: 1.30 },
  { id: "yaldiz", name: "Sıcak yaldız", desc: "Folyo baskı, premium parıltı", multiplier: 1.50 },
  { id: "spotuv", name: "Spot UV", desc: "Parlak nokta vurgu", multiplier: 1.25 },
];
