/**
 * Sticker pricing — geometri optimizasyon (saf fonksiyon).
 *
 * Kaynak: docs/PRICING_SPEC.md §2-3
 * Modül: sticker-fiyatlama.html v0.3 — `findOptimalSheet`, `computeRollPlan`
 *
 * İki ana fonksiyon:
 *   - findOptimalSheet: sticker boyutu + adet → tabaka seçimi (küçük/büyük/red)
 *   - computeRollPlan: tabaka boyutu + sayısı → optimum rulo planı (fire min)
 *
 * Saf fonksiyon. DB / I/O yok. Test edilebilir.
 */

import {
  BIG_SHEET_H,
  BIG_SHEET_W,
  GAP_DIECUT,
  GAP_TABAKA,
  ROLL_L,
  ROLL_MARGIN_X,
  ROLL_MARGIN_Y,
  ROLL_W_MAX,
  ROLL_W_MIN,
  SMALL_SHEET_H,
  SMALL_SHEET_W,
  TABAKA_USABLE_W,
  TABAKA_USABLE_H,
  snapSizeUp,
} from "./constants";

// ============================================================
// Types
// ============================================================

export type CutType = "tabaka" | "diecut";
export type SheetMode = "small" | "big";

export interface SheetFit {
  mode: SheetMode;
  /** Sticker rotated mı (W↔H) */
  rotated: boolean;
  /** Rotated sonrası efektif sticker boyutu */
  stickerW: number;
  stickerH: number;
  /** Tabaka grid */
  cols: number;
  rows: number;
  perSheet: number;
  /** Tabaka boyutu (her zaman SMALL veya BIG sabitlerinden biri) */
  sheetW: number;
  sheetH: number;
  /** Stickerların kapladığı toplam alan (gap dahil, tabaka içinde) */
  usedW: number;
  usedH: number;
  /** Bu mod için kullanılan boşluk */
  gap: number;
  /** Kullanıcı tabaka istese bile büyük tabakada zorla die-cut */
  forcedDieCut: boolean;
  /** Hedeflenen adet için gerekli tabaka */
  sheetsNeeded: number;
  /** Üretilen toplam adet (sheetsNeeded × perSheet) */
  producedQty: number;
  /** producedQty / requestedQty - 1 (örn 0.024 = %2.4 fazla) */
  overrun: number;
}

export interface RollPlan {
  /** Algoritmanın seçtiği dinamik rulo eni */
  rollW: number;
  /** Rulo enine kaç tabaka yan yana */
  cols: number;
  /** Rulo boyuna kaç tabaka peş peşe (max) */
  rows: number;
  /** Bir rulonun max tabaka kapasitesi */
  sheetsPerRoll: number;
  /** Sipariş için gereken rulo sayısı */
  rollsNeeded: number;
  /** Son rulodaki tabaka sayısı */
  sheetsOnLastRoll: number;
  /** Son rulodaki kullanılan satır sayısı */
  lastRowsCount: number;
  /** Son rulonun kullanılan boyu */
  lastRollLengthMm: number;
  /** Tüm ruloların toplam boy uzunluğu */
  totalLengthMm: number;
  /** Toplam rulo alanı (mm²) — fire dahil */
  totalArea: number;
  /** Rulo eninin tabakaların kapladığı kısmı (gap'siz) */
  usableW: number;
  /** Rulo boyunun kullanılabilir kısmı (margin sonrası) */
  usableL: number;
  /** Rulo eninin extra boş kısmı (min eni dayandığında oluşur) */
  extraSidePad: number;
}

// ============================================================
// findOptimalSheet
// ============================================================

interface FindOptimalArgs {
  width: number;
  height: number;
  requestedCut: CutType;
  targetQty: number;
}

/**
 * Sticker boyutu ve hedef adete göre en iyi tabaka düzenini bulur.
 *
 * Algoritma:
 *  1. Küçük tabakaya (230×310) sığıyor mu — her iki rotasyonla dene
 *     → tabaka modunda gap=6mm, diecut modunda gap=50mm
 *     → en çok sticker sığan rotasyonu seç
 *  2. Sığmıyorsa büyük tabakaya (400×650) geç — gap=50mm zorla, forcedDieCut=true
 *  3. Hâlâ sığmıyorsa null (red, "büyük etiket servisi yakında")
 */
export function findOptimalSheet(args: FindOptimalArgs): SheetFit | null {
  const { width: W, height: H, requestedCut, targetQty } = args;

  // ====== ÖNCE KÜÇÜK TABAKA — her iki rotasyon ======
  const gap = requestedCut === "tabaka" ? GAP_TABAKA : GAP_DIECUT;
  let smallFit: Omit<SheetFit, "sheetsNeeded" | "producedQty" | "overrun"> | null = null;

  for (const rotated of [false, true]) {
    const sw = rotated ? H : W;
    const sh = rotated ? W : H;

    // Sığmıyorsa sonraki rotasyon (Sefa kuralı 15 May v5: kullanılabilir
    // alan = SMALL_SHEET - 2× MARGIN, 190×270 mm sınırı).
    if (sw > TABAKA_USABLE_W || sh > TABAKA_USABLE_H) continue;

    const cols = Math.floor((TABAKA_USABLE_W + gap) / (sw + gap));
    const rows = Math.floor((TABAKA_USABLE_H + gap) / (sh + gap));

    if (cols < 1 || rows < 1) continue;

    const perSheet = cols * rows;
    const usedW = cols * sw + (cols - 1) * gap;
    const usedH = rows * sh + (rows - 1) * gap;

    if (!smallFit || perSheet > smallFit.perSheet) {
      smallFit = {
        mode: "small",
        rotated,
        stickerW: sw,
        stickerH: sh,
        cols,
        rows,
        perSheet,
        sheetW: SMALL_SHEET_W,
        sheetH: SMALL_SHEET_H,
        usedW,
        usedH,
        gap,
        forcedDieCut: false,
      };
    }
  }

  if (smallFit) {
    const sheetsNeeded = Math.ceil(targetQty / smallFit.perSheet);
    const producedQty = sheetsNeeded * smallFit.perSheet;
    return {
      ...smallFit,
      sheetsNeeded,
      producedQty,
      overrun: (producedQty - targetQty) / targetQty,
    };
  }

  // ====== BÜYÜK TABAKA — gap=50mm zorla, forcedDieCut=true ======
  let bigFit: Omit<SheetFit, "sheetsNeeded" | "producedQty" | "overrun"> | null = null;
  const bigGap = GAP_DIECUT;

  for (const rotated of [false, true]) {
    const sw = rotated ? H : W;
    const sh = rotated ? W : H;

    if (sw > BIG_SHEET_W || sh > BIG_SHEET_H) continue;

    const cols = Math.floor((BIG_SHEET_W + bigGap) / (sw + bigGap));
    const rows = Math.floor((BIG_SHEET_H + bigGap) / (sh + bigGap));

    if (cols < 1 || rows < 1) continue;

    const perSheet = cols * rows;
    const usedW = cols * sw + (cols - 1) * bigGap;
    const usedH = rows * sh + (rows - 1) * bigGap;

    if (!bigFit || perSheet > bigFit.perSheet) {
      bigFit = {
        mode: "big",
        rotated,
        stickerW: sw,
        stickerH: sh,
        cols,
        rows,
        perSheet,
        sheetW: BIG_SHEET_W,
        sheetH: BIG_SHEET_H,
        usedW,
        usedH,
        gap: bigGap,
        forcedDieCut: true,
      };
    }
  }

  if (bigFit) {
    const sheetsNeeded = Math.ceil(targetQty / bigFit.perSheet);
    const producedQty = sheetsNeeded * bigFit.perSheet;
    return {
      ...bigFit,
      sheetsNeeded,
      producedQty,
      overrun: (producedQty - targetQty) / targetQty,
    };
  }

  // 40×65 cm'e bile sığmıyor — RED
  return null;
}

// ============================================================
// computeRollPlan
// ============================================================

/**
 * Tabaka boyutu ve sayısı verilince en optimum rulo planını döndürür.
 *
 * Algoritma:
 *   - Rulo eni dinamik (250-600mm), boy sabit (1520mm)
 *   - cols=1..maxCols için her seçenek dene
 *   - Toplam alan (rollW × totalLength) en az olanı seç → fire minimum
 *
 * Pratik etki:
 *   - Az adet → dar rulo (310mm vs 600mm = %48 tasarruf)
 *   - Çok adet → geniş rulo (2-3 yan yana tabaka)
 */
export function computeRollPlan(
  sheetW: number,
  sheetH: number,
  sheetsNeeded: number
): RollPlan | null {
  const usableMaxW = ROLL_W_MAX - 2 * ROLL_MARGIN_X; // 520mm
  const usableMaxL = ROLL_L - ROLL_MARGIN_Y; // 1470mm

  // Tabaka rulodan büyükse imkansız
  if (sheetW > usableMaxW) return null;
  if (sheetH > usableMaxL) return null;

  const maxCols = Math.floor(usableMaxW / sheetW);
  if (maxCols < 1) return null;

  let best: RollPlan | null = null;

  for (let cols = 1; cols <= maxCols; cols++) {
    const usedWidth = cols * sheetW;
    let rollW = usedWidth + 2 * ROLL_MARGIN_X;

    // Minimum rulo eninin altına düşmesin
    if (rollW < ROLL_W_MIN) {
      rollW = ROLL_W_MIN;
    }
    if (rollW > ROLL_W_MAX) continue;

    const maxRowsPerRoll = Math.floor(usableMaxL / sheetH);
    if (maxRowsPerRoll < 1) continue;

    const sheetsPerRoll = cols * maxRowsPerRoll;
    const rollsNeeded = Math.ceil(sheetsNeeded / sheetsPerRoll);
    const sheetsOnLastRoll = sheetsNeeded - (rollsNeeded - 1) * sheetsPerRoll;

    const lastRowsCount = Math.ceil(sheetsOnLastRoll / cols);
    const lastRollLengthMm = ROLL_MARGIN_Y + lastRowsCount * sheetH;

    const fullRolls = rollsNeeded - 1;
    const totalLengthMm = fullRolls * ROLL_L + lastRollLengthMm;
    const totalArea = rollW * totalLengthMm;

    const candidate: RollPlan = {
      rollW,
      cols,
      rows: maxRowsPerRoll,
      sheetsPerRoll,
      rollsNeeded,
      sheetsOnLastRoll,
      lastRowsCount,
      lastRollLengthMm,
      totalLengthMm,
      totalArea,
      usableW: usedWidth,
      usableL: usableMaxL,
      extraSidePad: (rollW - usedWidth - 2 * ROLL_MARGIN_X) / 2,
    };

    if (!best || candidate.totalArea < best.totalArea) {
      best = candidate;
    }
  }

  return best;
}

// ============================================================
// Yardımcı: tek hesapta full geometri
// ============================================================

export interface GeometryResult {
  fit: SheetFit;
  roll: RollPlan;
  /** Toplam rulo alanı m² (fire dahil) */
  totalM2: number;
  /** Basılan tabakaların toplam alanı m² (sheetW×sheetH×adet, fire hariç) */
  sheetAreaM2: number;
  /** Stickerların kapladığı net alan m² (fire hariç) */
  stickerArea: number;
  /** Fire yüzdesi 0-100 */
  wastePct: number;
  /** Efektif kesim tipi (büyük tabakada zorla diecut) */
  effectiveCut: CutType;
}

/**
 * findOptimalSheet + computeRollPlan + m²/fire hesabı tek çağrıda.
 * cost.ts bunu input olarak alır.
 */
export function computeGeometry(args: {
  width: number;
  height: number;
  cut: CutType;
  qty: number;
}): GeometryResult | null {
  // Sefa kuralı 11 May: ölçüler 5 mm katlarına yukarı yuvarlanır.
  // Müşteri 38×48 girse de hesaplama 40×50 üzerinden yapılır.
  // UI'da bu yuvarlanmış değer "hesaplama: 40×50 mm" olarak gösterilmeli.
  const snapW = snapSizeUp(args.width);
  const snapH = snapSizeUp(args.height);

  const fit = findOptimalSheet({
    width: snapW,
    height: snapH,
    requestedCut: args.cut,
    targetQty: args.qty,
  });

  if (!fit) return null;

  const roll = computeRollPlan(fit.sheetW, fit.sheetH, fit.sheetsNeeded);
  if (!roll) return null;

  const totalM2 = (roll.rollW * roll.totalLengthMm) / 1_000_000;
  const sheetAreaM2 =
    (fit.sheetW * fit.sheetH * fit.sheetsNeeded) / 1_000_000;
  const stickerArea = (snapW * snapH * fit.producedQty) / 1_000_000;
  const wastePct =
    totalM2 > 0 ? ((totalM2 - stickerArea) / totalM2) * 100 : 0;

  const effectiveCut: CutType = fit.forcedDieCut ? "diecut" : args.cut;

  return {
    fit,
    roll,
    totalM2,
    sheetAreaM2,
    stickerArea,
    wastePct,
    effectiveCut,
  };
}
