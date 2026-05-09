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

/** Sağ + sol kenar kesim markası (her iki yanda) */
export const ROLL_MARGIN_X = 40;

/** Sol başlangıçta plotter boşluğu */
export const ROLL_MARGIN_Y = 50;

// ============================================================
// Tabaka boyutları
// ============================================================

/** Standart küçük tabaka — 24×32 cm zarfa 1cm marjla sığar */
export const SMALL_SHEET_W = 230;
export const SMALL_SHEET_H = 310;

/** Müşteri zarfı (küçük) */
export const SMALL_ENVELOPE_W = 240;
export const SMALL_ENVELOPE_H = 320;

/** Büyük tabaka — sticker > küçük tabaka olduğunda zorla die-cut */
export const BIG_SHEET_W = 400;
export const BIG_SHEET_H = 650;

// ============================================================
// Üretim toleransları
// ============================================================

/** Adet en fazla %3 aşılabilir (eksik üretim olmaz, fazla = hediye) */
export const QTY_TOLERANCE = 0.03;

/** Tabaka modunda sticker'lar arası boşluk (yarım kesim) */
export const GAP_TABAKA = 6;

/** Die-cut modunda sticker'lar arası boşluk (tam kesim) */
export const GAP_DIECUT = 50;

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
